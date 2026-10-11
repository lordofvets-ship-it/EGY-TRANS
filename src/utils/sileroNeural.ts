import fs from "fs";
import path from "path";

/**
 * Real Silero VAD v5 (snakers4/silero-vad, MIT licence) running on onnxruntime-node.
 * Model signature (verified): input[1,64+512] float32, state[2,1,128] float32, sr int64 scalar
 *                           → output[1,1] speech probability, stateN[2,1,128].
 */

export const SAMPLE_RATE = 16000;
export const WINDOW = 512; // 32 ms
export const CONTEXT = 64; // samples carried over between windows (v5 requirement at 16 kHz)

export interface NeuralOptions {
  threshold?: number;
  negThreshold?: number;
  minSpeechMs?: number;
  minSilenceMs?: number;
  speechPadMs?: number;
}
export interface NeuralSegment { start: number; end: number; confidence: number }

let runtime: Promise<{ ort: any; session: any } | null> | null = null;
let lastLoadError = "";

export function resolveModelPath(): string | null {
  const argvDir = path.dirname(process.argv[1] || ".");
  const candidates = [
    process.env.SILERO_MODEL_PATH,
    path.join(process.cwd(), "models", "silero_vad.onnx"),
    path.join(argvDir, "models", "silero_vad.onnx"),
    path.join(argvDir, "..", "models", "silero_vad.onnx"),
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Loads the ONNX session once. Resolves to null (never throws) when the runtime or the model is missing. */
export function loadSilero(): Promise<{ ort: any; session: any } | null> {
  if (!runtime) {
    runtime = (async () => {
      if (process.env.VAD_ENGINE === "energy") { lastLoadError = "VAD_ENGINE=energy"; return null; }
      const model = resolveModelPath();
      if (!model) { lastLoadError = "silero_vad.onnx not found (set SILERO_MODEL_PATH or place it in ./models)"; return null; }
      try {
        const modName = "onnxruntime-node"; // non-literal: the package is an optional dependency
        const mod: any = await import(modName);
        const ort = mod.default?.InferenceSession ? mod.default : mod;
        const session = await ort.InferenceSession.create(model, { executionProviders: ["cpu"], graphOptimizationLevel: "all", intraOpNumThreads: 1 });
        return { ort, session };
      } catch (e: any) {
        lastLoadError = `onnxruntime-node unavailable: ${String(e?.message || e).split("\n")[0]}`;
        return null;
      }
    })();
  }
  return runtime;
}

export const sileroLoadError = () => lastLoadError;
/** test helper */
export function __resetSileroForTests() { runtime = null; lastLoadError = ""; }

/** Per-window speech probabilities for 16 kHz mono PCM. Returns null if the neural runtime is unavailable. */
export async function speechProbabilities(pcm: Int16Array): Promise<Float32Array | null> {
  const rt = await loadSilero();
  if (!rt) return null;
  const { ort, session } = rt;
  const n = Math.ceil(pcm.length / WINDOW);
  const probs = new Float32Array(n);
  const input = new Float32Array(CONTEXT + WINDOW);
  const state = new Float32Array(2 * 1 * 128);
  const sr = new ort.Tensor("int64", BigInt64Array.from([BigInt(SAMPLE_RATE)]), []);
  for (let i = 0; i < n; i++) {
    // context = last CONTEXT samples of the previous input (zeros for the first window)
    if (i > 0) input.copyWithin(0, WINDOW, WINDOW + CONTEXT);
    else input.fill(0, 0, CONTEXT);
    const off = i * WINDOW;
    for (let j = 0; j < WINDOW; j++) input[CONTEXT + j] = (off + j < pcm.length ? pcm[off + j] : 0) / 32768;
    const out = await session.run({
      input: new ort.Tensor("float32", input, [1, CONTEXT + WINDOW]),
      state: new ort.Tensor("float32", state, [2, 1, 128]),
      sr,
    });
    probs[i] = out.output.data[0] as number;
    state.set(out.stateN.data as Float32Array);
  }
  return probs;
}

/** Port of silero-vad `get_speech_timestamps` (reference implementation), returning seconds. */
export function probsToSegments(probs: ArrayLike<number>, totalSamples: number, opt: NeuralOptions = {}): NeuralSegment[] {
  const threshold = opt.threshold ?? 0.5;
  const negThreshold = opt.negThreshold ?? Math.max(threshold - 0.15, 0.01);
  const minSpeech = ((opt.minSpeechMs ?? 250) * SAMPLE_RATE) / 1000;
  const minSilence = ((opt.minSilenceMs ?? 300) * SAMPLE_RATE) / 1000;
  const pad = ((opt.speechPadMs ?? 100) * SAMPLE_RATE) / 1000;

  type S = { start: number; end: number; conf: number };
  const meanProb = (a: number, b: number) => {
    const i0 = Math.floor(a / WINDOW), i1 = Math.max(i0 + 1, Math.min(probs.length, Math.ceil(b / WINDOW)));
    let sum = 0;
    for (let i = i0; i < i1; i++) sum += probs[i];
    return sum / (i1 - i0);
  };
  const speeches: S[] = [];
  let triggered = false;
  let cur: S | null = null;
  let tempEnd = 0;

  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    const at = WINDOW * i;
    if (p >= threshold && tempEnd) tempEnd = 0;
    if (p >= threshold && !triggered) {
      triggered = true;
      cur = { start: at, end: at, conf: 0 };
    }
    if (p < negThreshold && triggered && cur) {
      if (!tempEnd) tempEnd = at;
      if (at - tempEnd < minSilence) continue;
      cur.end = tempEnd;
      if (cur.end - cur.start > minSpeech) { cur.conf = meanProb(cur.start, cur.end); speeches.push(cur); }
      cur = null; tempEnd = 0; triggered = false;
    }
  }
  if (cur && totalSamples - cur.start > minSpeech) { cur.end = totalSamples; cur.conf = meanProb(cur.start, cur.end); speeches.push(cur); }

  // padding, merging overlaps exactly as the reference does
  for (let i = 0; i < speeches.length; i++) {
    const s = speeches[i];
    if (i === 0) s.start = Math.max(0, s.start - pad);
    if (i !== speeches.length - 1) {
      const next = speeches[i + 1];
      const gap = next.start - s.end;
      if (gap < 2 * pad) { s.end += Math.floor(gap / 2); next.start = Math.max(0, next.start - Math.floor(gap / 2)); }
      else { s.end = Math.min(totalSamples, s.end + pad); next.start = Math.max(0, next.start - pad); }
    } else {
      s.end = Math.min(totalSamples, s.end + pad);
    }
  }
  return speeches.map((s) => ({
    start: Number((s.start / SAMPLE_RATE).toFixed(2)),
    end: Number((s.end / SAMPLE_RATE).toFixed(2)),
    confidence: Number(s.conf.toFixed(3)),
  }));
}
