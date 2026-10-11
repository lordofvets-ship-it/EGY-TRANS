import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { speechProbabilities, probsToSegments, loadSilero, sileroLoadError, WINDOW, SAMPLE_RATE } from "./sileroNeural";

export interface SpeechSegment {
  start: number; // seconds
  end: number;   // seconds
  confidence: number;
  /** "speech" = human voice, "music" = sustained non-speech sound (hold music / tones). Absent in legacy records. */
  kind?: "speech" | "music";
}

export interface SilenceSegment {
  timeStart: string; // MM:SS
  timeEnd: string;   // MM:SS
  duration: number;  // seconds
  fromSpeaker?: string;
  toSpeaker?: string;
  description?: string;
}

export interface SileroVadResult {
  /** false when the audio could not be decoded; all numeric fields are then zero and MUST NOT be used as evidence. */
  available: boolean;
  unavailableReason?: string;
  engine: string;
  /** true when the real Silero neural model produced the result */
  neural?: boolean;
  /**
   * "Acoustic activity" segments (human speech ∪ sustained music). This keeps the legacy semantics that the
   * hold/silence rules rely on; use `kind` (or humanSpeechSegments / musicSegments) to tell them apart.
   */
  speechSegments: SpeechSegment[];
  humanSpeechSegments?: SpeechSegment[];
  musicSegments?: SpeechSegment[];
  musicRatio?: number;
  silenceSegments: SilenceSegment[];
  speechRatio: number;
  totalAudioDuration: number;
  speechDuration: number;
  silenceDuration: number;
}

/**
 * Extracts 16kHz mono 16-bit signed PCM audio from any container format using ffmpeg.
 */
async function extractPcmWithFfmpeg(buffer: Buffer): Promise<Int16Array | null> {
  const tmpInput = path.join(os.tmpdir(), `vad_in_${Date.now()}_${Math.random().toString(36).slice(2)}.raw`);
  try {
    await fs.promises.writeFile(tmpInput, buffer);

    return await new Promise<Int16Array | null>((resolve) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y",
        "-i", tmpInput,
        "-ac", "1",
        "-ar", "16000",
        "-f", "s16le",
        "-",
      ]);

      const chunks: Buffer[] = [];
      ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
      ffmpeg.stderr.on("data", () => {}); // silence logs

      ffmpeg.on("close", (code) => {
        if (code === 0 && chunks.length > 0) {
          const totalBuffer = Buffer.concat(chunks);
          const samples = new Int16Array(
            totalBuffer.buffer,
            totalBuffer.byteOffset,
            totalBuffer.length / 2
          );
          resolve(samples);
        } else {
          resolve(null);
        }
      });

      ffmpeg.on("error", () => resolve(null));
    });
  } catch (err) {
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpInput)) {
        await fs.promises.unlink(tmpInput);
      }
    } catch (_) {}
  }
}

/**
 * Decides whether a segment is hold-music-like. Legacy records (no `kind`) keep the old duration+confidence rule;
 * new records are classified by the neural model, so long continuous human speech is no longer mistaken for music.
 */
export function isMusicBlock(seg: any, minConfidence: number): boolean {
  const dur = Number(seg?.end) - Number(seg?.start);
  if (!(dur >= 12)) return false;
  if (seg?.kind === "speech") return false;
  return Number(seg?.confidence || 0) >= minConfidence;
}

export function unavailableResult(reason: string): SileroVadResult {
  return {
    available: false,
    unavailableReason: reason,
    engine: "VAD (غير متاح)",
    speechSegments: [],
    silenceSegments: [],
    speechRatio: 0,
    totalAudioDuration: 0,
    speechDuration: 0,
    silenceDuration: 0,
  };
}

const fmtTime = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, "0")}:${Math.floor(secs % 60).toString().padStart(2, "0")}`;

/** Silence = gaps (>1 s) not covered by ANY acoustic activity (speech or music). */
function gapsToSilence(activity: SpeechSegment[], totalDuration: number, label: string): SilenceSegment[] {
  const out: SilenceSegment[] = [];
  let lastEnd = 0;
  const push = (from: number, to: number, tail: boolean) => {
    const dur = Number((to - from).toFixed(1));
    out.push({
      timeStart: fmtTime(from), timeEnd: fmtTime(to), duration: dur,
      fromSpeaker: "موظف خدمة العملاء", toSpeaker: "موظف خدمة العملاء",
      description: `فترة صمت${tail ? " ختامية" : ""} تم رصدها بواسطة ${label} (${dur} ثانية)`,
    });
  };
  for (const seg of activity) {
    if (seg.start > lastEnd + 1.0) push(lastEnd, seg.start, false);
    lastEnd = Math.max(lastEnd, seg.end);
  }
  if (totalDuration > lastEnd + 1.0) push(lastEnd, totalDuration, true);
  return out;
}

/** Frame RMS + adaptive noise floor (shared by both engines). */
function frameEnergies(pcm: Int16Array) {
  const numFrames = Math.floor(pcm.length / WINDOW);
  const energies = new Float64Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    let sumSq = 0;
    const off = i * WINDOW;
    for (let j = 0; j < WINDOW; j++) { const v = pcm[off + j] / 32768.0; sumSq += v * v; }
    energies[i] = Math.sqrt(sumSq / WINDOW);
  }
  const sorted = Array.from(energies).sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(numFrames * 0.15)] || 0.005;
  return { energies, noiseFloor, numFrames };
}

/**
 * Real Silero VAD v5. Speech comes from the neural model; sustained non-speech sound (hold music, tones) is found by
 * energy in the frames the model rejected; what remains is true silence.
 */
async function analyzeNeural(pcm: Int16Array): Promise<SileroVadResult | null> {
  const probs = await speechProbabilities(pcm);
  if (!probs) return null;
  const totalDuration = pcm.length / SAMPLE_RATE;
  const human: SpeechSegment[] = probsToSegments(probs, pcm.length, { threshold: 0.5, minSpeechMs: 250, minSilenceMs: 300, speechPadMs: 100 })
    .map((s) => ({ ...s, kind: "speech" as const }));

  // frames covered by human speech
  const { energies, noiseFloor, numFrames } = frameEnergies(pcm);
  const frameSec = WINDOW / SAMPLE_RATE;
  const isSpeechFrame = new Uint8Array(numFrames);
  for (const s of human) {
    for (let f = Math.floor(s.start / frameSec); f <= Math.min(numFrames - 1, Math.ceil(s.end / frameSec)); f++) isSpeechFrame[f] = 1;
  }
  const soundThreshold = Math.max(0.012, noiseFloor * 3.5);
  const bridgeFrames = Math.round(0.5 / frameSec); // music has quiet passages
  const music: SpeechSegment[] = [];
  let start = -1, lastSound = -1;
  const closeBlock = () => {
    if (start >= 0) {
      const dur = (lastSound - start + 1) * frameSec;
      if (dur >= 3) {
        music.push({
          start: Number((start * frameSec).toFixed(2)), end: Number(((lastSound + 1) * frameSec).toFixed(2)),
          confidence: Number(Math.min(0.95, 0.7 + 0.25 * Math.min(1, dur / 30)).toFixed(3)), kind: "music",
        });
      }
    }
    start = -1; lastSound = -1;
  };
  for (let f = 0; f < numFrames; f++) {
    const sound = !isSpeechFrame[f] && energies[f] > soundThreshold;
    if (sound) { if (start < 0) start = f; lastSound = f; }
    else if (start >= 0 && f - lastSound > bridgeFrames) closeBlock();
  }
  closeBlock();

  const activity = [...human, ...music].sort((a, b) => a.start - b.start);
  const speechSec = human.reduce((a, s) => a + (s.end - s.start), 0);
  const musicSec = music.reduce((a, s) => a + (s.end - s.start), 0);
  const label = "Silero VAD v5";
  return {
    available: true,
    neural: true,
    engine: "Silero VAD v5 (ONNX)",
    speechSegments: activity,
    humanSpeechSegments: human,
    musicSegments: music,
    silenceSegments: gapsToSilence(activity, totalDuration, label),
    speechRatio: totalDuration > 0 ? Number((speechSec / totalDuration).toFixed(3)) : 0,
    musicRatio: totalDuration > 0 ? Number((musicSec / totalDuration).toFixed(3)) : 0,
    totalAudioDuration: Number(totalDuration.toFixed(1)),
    speechDuration: Number(speechSec.toFixed(1)),
    silenceDuration: Number(Math.max(0, totalDuration - speechSec - musicSec).toFixed(1)),
  };
}

/** Public entry point: neural Silero when available, otherwise the (honestly labelled) energy heuristic. */
export async function runSileroVad(buffer: Buffer): Promise<SileroVadResult> {
  const pcm = await extractPcmWithFfmpeg(buffer);
  // Fail loudly: never fabricate speech/silence statistics when the audio cannot be decoded.
  if (!pcm || pcm.length === 0) return unavailableResult("تعذّر فك ترميز الصوت عبر ffmpeg؛ لا توجد بيانات VAD موثوقة لهذه المكالمة.");
  try {
    const neural = await analyzeNeural(pcm);
    if (neural) return neural;
  } catch (e: any) {
    console.warn("[VAD] neural analysis failed, falling back to the energy heuristic:", e?.message || e);
  }
  return analyzeEnergy(pcm);
}

export async function describeVadEngine(): Promise<{ engine: string; neural: boolean; reason?: string }> {
  const rt = await loadSilero();
  return rt ? { engine: "Silero VAD v5 (ONNX)", neural: true } : { engine: "Energy+ZCR VAD (تقريبي)", neural: false, reason: sileroLoadError() };
}

/**
 * Energy + zero-crossing-rate voice activity detection (fallback; NOT the Silero neural model).
 * It cannot tell speech from music — everything loud counts as "speech".
 */
async function analyzeEnergy(pcm: Int16Array): Promise<SileroVadResult> {
  const sampleRate = 16000;
  const frameSize = 512; // 32ms frames at 16kHz
  const numFrames = Math.floor(pcm.length / frameSize);
  const frameDuration = frameSize / sampleRate; // ~0.032 seconds
  const totalDuration = pcm.length / sampleRate;

  // Frame energies and zero-crossing rates
  const speechProbabilities: number[] = new Array(numFrames);

  // Compute adaptive noise floor from the lowest 10% energy frames
  const energies: number[] = [];
  for (let i = 0; i < numFrames; i++) {
    let sumSq = 0;
    const offset = i * frameSize;
    for (let j = 0; j < frameSize; j++) {
      const s = pcm[offset + j] / 32768.0;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    energies.push(rms);
  }

  const sortedEnergies = [...energies].sort((a, b) => a - b);
  const noiseFloor = sortedEnergies[Math.floor(numFrames * 0.15)] || 0.005;
  const speechThreshold = Math.max(0.012, noiseFloor * 3.5);

  // Silero-grade probability computation per frame
  for (let i = 0; i < numFrames; i++) {
    const rms = energies[i];
    const offset = i * frameSize;

    // Zero crossing rate
    let zcr = 0;
    for (let j = 1; j < frameSize; j++) {
      if ((pcm[offset + j] >= 0 && pcm[offset + j - 1] < 0) || (pcm[offset + j] < 0 && pcm[offset + j - 1] >= 0)) {
        zcr++;
      }
    }
    const zcrRate = zcr / frameSize;

    // Speech probability: boosted by moderate ZCR (human speech phonemes) and energy above noise floor
    let prob = 0;
    if (rms > speechThreshold) {
      const snr = Math.min(1.0, (rms - speechThreshold) / (speechThreshold * 4.0));
      const zcrScore = (zcrRate > 0.04 && zcrRate < 0.45) ? 1.0 : 0.6;
      prob = Math.min(0.99, 0.5 + snr * 0.45 * zcrScore);
    } else {
      prob = Math.max(0.01, (rms / speechThreshold) * 0.4);
    }
    speechProbabilities[i] = prob;
  }

  // State machine for speech segment extraction:
  // min_speech_duration_ms: 250ms (~8 frames)
  // min_silence_duration_ms: 300ms (~10 frames)
  // speech_pad_ms: 200ms (~6 frames)
  const minSpeechFrames = 8;
  const minSilenceFrames = 10;
  const padFrames = 6;

  let inSpeech = false;
  let speechStartFrame = 0;
  let silenceFramesCounter = 0;

  const rawSegments: { startFrame: number; endFrame: number; avgConf: number }[] = [];

  for (let i = 0; i < numFrames; i++) {
    const isSpeechFrame = speechProbabilities[i] >= 0.5;

    if (isSpeechFrame) {
      if (!inSpeech) {
        inSpeech = true;
        speechStartFrame = Math.max(0, i - padFrames);
      }
      silenceFramesCounter = 0;
    } else {
      if (inSpeech) {
        silenceFramesCounter++;
        if (silenceFramesCounter >= minSilenceFrames || i === numFrames - 1) {
          inSpeech = false;
          const endFrame = Math.min(numFrames - 1, i - silenceFramesCounter + padFrames);
          if (endFrame - speechStartFrame >= minSpeechFrames) {
            let confSum = 0;
            for (let k = speechStartFrame; k <= endFrame; k++) confSum += speechProbabilities[k];
            rawSegments.push({
              startFrame: speechStartFrame,
              endFrame,
              avgConf: confSum / (endFrame - speechStartFrame + 1),
            });
          }
          silenceFramesCounter = 0;
        }
      }
    }
  }

  // Convert raw frames to SpeechSegments
  const speechSegments: SpeechSegment[] = rawSegments.map((s) => ({
    start: Number((s.startFrame * frameDuration).toFixed(2)),
    end: Number((s.endFrame * frameDuration).toFixed(2)),
    confidence: Number(s.avgConf.toFixed(3)),
  }));

  // Find silence segments between speech segments
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const silenceSegments: SilenceSegment[] = [];
  let lastEnd = 0;

  for (const seg of speechSegments) {
    if (seg.start > lastEnd + 1.0) {
      const dur = Number((seg.start - lastEnd).toFixed(1));
      silenceSegments.push({
        timeStart: formatTime(lastEnd),
        timeEnd: formatTime(seg.start),
        duration: dur,
        fromSpeaker: "موظف خدمة العملاء",
        toSpeaker: "موظف خدمة العملاء",
        description: `فترة صمت تم رصدها بكاشف النشاط الصوتي التقريبي (${dur} ثانية)`,
      });
    }
    lastEnd = Math.max(lastEnd, seg.end);
  }

  if (totalDuration > lastEnd + 1.0) {
    const dur = Number((totalDuration - lastEnd).toFixed(1));
    silenceSegments.push({
      timeStart: formatTime(lastEnd),
      timeEnd: formatTime(totalDuration),
      duration: dur,
      fromSpeaker: "موظف خدمة العملاء",
      toSpeaker: "موظف خدمة العملاء",
      description: `فترة صمت ختامية تم رصدها بكاشف النشاط الصوتي التقريبي (${dur} ثانية)`,
    });
  }

  const totalSpeechSec = speechSegments.reduce((acc, s) => acc + (s.end - s.start), 0);
  const speechRatio = totalDuration > 0 ? Number((totalSpeechSec / totalDuration).toFixed(3)) : 1.0;

  return {
    available: true,
    engine: "Energy+ZCR VAD (تقريبي — ليس نموذج Silero)",
    neural: false,
    speechSegments,
    silenceSegments,
    speechRatio,
    totalAudioDuration: Number(totalDuration.toFixed(1)),
    speechDuration: Number(totalSpeechSec.toFixed(1)),
    silenceDuration: Number(Math.max(0, totalDuration - totalSpeechSec).toFixed(1)),
  };
}
