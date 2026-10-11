/** Browser/Node client for POST /api/transcribe, shared by the batch uploader (and testable without React). */

export interface TranscribeOptions {
  processingMode: string;
  baseUrl?: string;
  signal?: AbortSignal;
  /** retries for "server starting" / 502-504 / unparsable replies (the original single-file flow used 10 × 3 s) */
  maxRetries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  durationTimeoutMs?: number;
}

/** Largest file we accept: the server body limit is 100 MB of JSON and base64 adds ~33 %. */
export const MAX_AUDIO_BYTES = 70 * 1024 * 1024;

export async function fileToBase64(file: Blob): Promise<string> {
  if (typeof (file as any).arrayBuffer === "function") {
    const bytes = new Uint8Array(await (file as any).arrayBuffer());
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[]);
    return btoa(bin);
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("تعذّرت قراءة الملف"));
    r.readAsDataURL(file);
  });
}

/** Audio length in seconds, or 0 when it cannot be determined within the timeout. */
export function getAudioDuration(file: File, timeoutMs = 5000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof Audio === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return resolve(0);
    let url = "";
    const done = (v: number) => { try { if (url) URL.revokeObjectURL(url); } catch {} resolve(v); };
    try {
      url = URL.createObjectURL(file);
      const a = new Audio();
      a.preload = "metadata";
      a.src = url;
      a.onloadedmetadata = () => done(a.duration && isFinite(a.duration) ? Math.round(a.duration) : 0);
      a.onerror = () => done(0);
      setTimeout(() => done(0), timeoutMs);
    } catch { done(0); }
  });
}

export async function transcribeFile(file: File, opt: TranscribeOptions): Promise<any> {
  const doFetch = opt.fetchImpl || fetch;
  const maxRetries = opt.maxRetries ?? 10;
  const delay = opt.retryDelayMs ?? 3000;
  if (file.size > MAX_AUDIO_BYTES) throw new Error(`الملف أكبر من الحد المسموح (${Math.round(MAX_AUDIO_BYTES / 1048576)}MB)`);
  const [audioBytes, audioDuration] = await Promise.all([fileToBase64(file), getAudioDuration(file, opt.durationTimeoutMs)]);
  const body = JSON.stringify({ audioBytes, mimeType: file.type || "audio/webm", audioDuration: audioDuration || undefined, fileName: file.name, processingMode: opt.processingMode });

  let lastError = "تعذّر الاتصال بالخادم";
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (opt.signal?.aborted) throw new DOMException("aborted", "AbortError");
    let res: Response;
    try {
      res = await doFetch((opt.baseUrl || "") + "/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: opt.signal });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      lastError = String(e?.message || e);
      if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, delay)); continue; }
      throw new Error(lastError);
    }
    const raw = await res.text();
    const starting = /Starting Server/i.test(raw) || /^\s*<(!doctype|html)/i.test(raw);
    if ((starting || [502, 503, 504].includes(res.status)) && attempt < maxRetries) { await new Promise((r) => setTimeout(r, delay)); continue; }
    let data: any;
    try { data = JSON.parse(raw); } catch {
      lastError = starting ? "الخادم قيد التشغيل، حاول بعد قليل" : "رد غير صالح من الخادم";
      if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, delay)); continue; }
      throw new Error(lastError);
    }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }
  throw new Error(lastError);
}
