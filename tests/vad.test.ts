import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { probsToSegments, WINDOW, SAMPLE_RATE, resolveModelPath, loadSilero, __resetSileroForTests } from "../src/utils/sileroNeural";
import { runSileroVad, isMusicBlock, describeVadEngine } from "../src/utils/vadEngine";

const ASSET = path.join(__dirname, "assets", "speech_60s.wav");
const win = (sec: number) => Math.round((sec * SAMPLE_RATE) / WINDOW);
const probsFrom = (spec: Array<[number, number]>) => Float32Array.from(spec.flatMap(([p, sec]) => new Array(win(sec)).fill(p)));

describe("probsToSegments (port of silero get_speech_timestamps)", () => {
  it("finds a single speech block and pads it", () => {
    const probs = probsFrom([[0.01, 1], [0.95, 2], [0.01, 1]]);
    const seg = probsToSegments(probs, probs.length * WINDOW, { speechPadMs: 100 });
    expect(seg).toHaveLength(1);
    expect(seg[0].start).toBeCloseTo(0.9, 1);
    expect(seg[0].end).toBeCloseTo(3.1, 1);
    expect(seg[0].confidence).toBeGreaterThan(0.9);
  });
  it("ignores bursts shorter than the minimum speech duration", () => {
    expect(probsToSegments(probsFrom([[0.01, 1], [0.95, 0.1], [0.01, 1]]), 30 * WINDOW * 3, {})).toHaveLength(0);
  });
  it("merges speech separated by a pause shorter than min silence, splits when longer", () => {
    const short = probsFrom([[0.95, 1], [0.01, 0.15], [0.95, 1]]);
    expect(probsToSegments(short, short.length * WINDOW, { minSilenceMs: 300 })).toHaveLength(1);
    const long = probsFrom([[0.95, 1], [0.01, 0.8], [0.95, 1]]);
    expect(probsToSegments(long, long.length * WINDOW, { minSilenceMs: 300 })).toHaveLength(2);
  });
  it("keeps hysteresis: probabilities between neg-threshold and threshold do not end speech", () => {
    const probs = probsFrom([[0.95, 1], [0.4, 2], [0.95, 1]]);
    expect(probsToSegments(probs, probs.length * WINDOW, {})).toHaveLength(1);
  });
  it("closes speech that runs to the end of the audio", () => {
    const probs = probsFrom([[0.01, 1], [0.95, 2]]);
    const seg = probsToSegments(probs, probs.length * WINDOW, {});
    expect(seg[0].end).toBeCloseTo((probs.length * WINDOW) / SAMPLE_RATE, 1);
  });
  it("returns nothing for pure silence", () => expect(probsToSegments(probsFrom([[0.01, 5]]), 5 * SAMPLE_RATE, {})).toEqual([]));
});

describe("isMusicBlock (rule shared by all hold/silence heuristics)", () => {
  it("classified music passes the legacy thresholds", () => expect(isMusicBlock({ start: 26, end: 41, confidence: 0.825, kind: "music" }, 0.78)).toBe(true));
  it("classified human speech is NEVER music, however long and confident", () => expect(isMusicBlock({ start: 0, end: 30, confidence: 0.95, kind: "speech" }, 0.55)).toBe(false));
  it("blocks shorter than 12 s are not hold music", () => expect(isMusicBlock({ start: 0, end: 11, confidence: 0.99, kind: "music" }, 0.55)).toBe(false));
  it("legacy cached records (no kind) keep the old duration+confidence rule", () => {
    expect(isMusicBlock({ start: 0, end: 20, confidence: 0.8 }, 0.78)).toBe(true);
    expect(isMusicBlock({ start: 0, end: 20, confidence: 0.6 }, 0.78)).toBe(false);
  });
});

const hasRuntime = !!resolveModelPath() && (() => { try { require.resolve("onnxruntime-node"); return true; } catch { return false; } })();
const hasFfmpeg = (() => { try { execSync("ffmpeg -version", { stdio: "ignore" }); return true; } catch { return false; } })();

describe.skipIf(!hasRuntime || !hasFfmpeg)("real Silero VAD v5 on real audio", () => {
  let mix: Buffer;
  let speechOnly: Buffer;
  beforeAll(() => {
    speechOnly = fs.readFileSync(ASSET);
    const out = path.join(os.tmpdir(), `vad_mix_${process.pid}.wav`);
    // speech 0-20 | silence 6 s | synthetic hold music 15 s | silence 5 s | speech 30-45   →  speech 0-20, silence 20-26, music 26-41, silence 41-46, speech 46-61
    execSync(
      `ffmpeg -y -v error -i "${ASSET}" -f lavfi -i "anullsrc=r=16000:cl=mono" ` +
        `-f lavfi -i "aevalsrc='0.25*sin(2*PI*440*t)*(0.6+0.4*sin(2*PI*2*t))+0.15*sin(2*PI*660*t)+0.1*sin(2*PI*880*t*(1+0.02*sin(2*PI*0.5*t)))':s=16000:d=15" ` +
        `-filter_complex "[0:a]atrim=0:20,asetpts=N/SR/TB[s1];[0:a]atrim=30:45,asetpts=N/SR/TB[s2];[1:a]atrim=0:6,asetpts=N/SR/TB[q1];[1:a]atrim=0:5,asetpts=N/SR/TB[q2];[s1][q1][2:a][q2][s2]concat=n=5:v=0:a=1[o]" ` +
        `-map "[o]" -ar 16000 -ac 1 "${out}"`
    );
    mix = fs.readFileSync(out);
    fs.unlinkSync(out);
  });

  it("the model and onnxruntime load", async () => {
    __resetSileroForTests();
    expect(await loadSilero()).not.toBeNull();
    expect(await describeVadEngine()).toMatchObject({ neural: true, engine: "Silero VAD v5 (ONNX)" });
  });

  it("finds human speech in a real speech recording", async () => {
    const r = await runSileroVad(speechOnly);
    expect(r.available).toBe(true);
    expect(r.neural).toBe(true);
    expect(r.totalAudioDuration).toBeCloseTo(60, 0);
    expect(r.speechRatio).toBeGreaterThan(0.4);
    expect(r.humanSpeechSegments!.length).toBeGreaterThan(3);
    expect(r.musicRatio ?? 0).toBeLessThan(0.05);
    for (const s of r.humanSpeechSegments!) expect(s.confidence).toBeGreaterThan(0.5);
  });

  describe("speech + silence + hold music", () => {
    it("labels the music as music, not speech, at the right place", async () => {
      const r = await runSileroVad(mix);
      const music = r.musicSegments!;
      expect(music).toHaveLength(1);
      expect(music[0].start).toBeGreaterThan(25);
      expect(music[0].start).toBeLessThan(27);
      expect(music[0].end).toBeGreaterThan(40);
      expect(music[0].end).toBeLessThan(42);
      expect(music[0].kind).toBe("music");
      expect(isMusicBlock(music[0], 0.78)).toBe(true);
    });
    it("never reports human speech inside the music window or the silences", async () => {
      const r = await runSileroVad(mix);
      for (const s of r.humanSpeechSegments!) {
        expect(s.end <= 26.5 || s.start >= 45.5, `speech ${s.start}-${s.end} overlaps the music/silence region`).toBe(true);
      }
    });
    it("covers the real speech windows", async () => {
      const r = await runSileroVad(mix);
      const cov = (a: number, b: number) => r.humanSpeechSegments!.reduce((acc, s) => acc + Math.max(0, Math.min(b, s.end) - Math.max(a, s.start)), 0) / (b - a);
      expect(cov(0, 20)).toBeGreaterThan(0.75);
      expect(cov(46, 61)).toBeGreaterThan(0.75);
    });
    it("separates speech ratio from music ratio and finds the true silences", async () => {
      const r = await runSileroVad(mix);
      expect(r.speechRatio).toBeGreaterThan(0.40);
      expect(r.speechRatio).toBeLessThan(0.58);
      expect(r.musicRatio).toBeGreaterThan(0.2);
      expect(r.musicRatio).toBeLessThan(0.3);
      const inGap = (a: number, b: number) => r.silenceSegments.some((g) => { const [m1, s1] = g.timeStart.split(":").map(Number); const [m2, s2] = g.timeEnd.split(":").map(Number); return m1 * 60 + s1 <= a + 1 && m2 * 60 + s2 >= b - 1; });
      expect(inGap(41.5, 45)).toBe(true);
      // the music window must NOT be reported as silence
      expect(r.silenceSegments.some((g) => { const [m1, s1] = g.timeStart.split(":").map(Number); return m1 * 60 + s1 >= 27 && m1 * 60 + s1 <= 40; })).toBe(false);
    });
    it("is fast enough for production (real-time factor well under 0.5)", async () => {
      const t0 = Date.now();
      await runSileroVad(mix);
      expect((Date.now() - t0) / 1000 / 61).toBeLessThan(0.5);
    });
  });

  describe("fallbacks", () => {
    it("falls back to the honestly-labelled energy heuristic when VAD_ENGINE=energy (and over-counts speech because it cannot tell music apart)", async () => {
      const neural = await runSileroVad(mix);
      process.env.VAD_ENGINE = "energy";
      __resetSileroForTests();
      try {
        const e = await runSileroVad(mix);
        expect(e.neural).toBe(false);
        expect(e.engine).toContain("ليس نموذج Silero");
        expect(e.speechSegments.every((s) => s.kind === undefined)).toBe(true);
        expect(e.speechRatio).toBeGreaterThan(neural.speechRatio + 0.1);
      } finally {
        delete process.env.VAD_ENGINE;
        __resetSileroForTests();
      }
    });
    it("reports 'unavailable' (with no fabricated numbers) for audio that cannot be decoded", async () => {
      const r = await runSileroVad(Buffer.from("this is not audio at all"));
      expect(r.available).toBe(false);
      expect(r.speechRatio).toBe(0);
      expect(r.totalAudioDuration).toBe(0);
      expect(r.speechSegments).toEqual([]);
      expect(r.unavailableReason).toBeTruthy();
    });
  });
});
