import { describe, it, expect, vi } from "vitest";
import { addFiles, runBatch, summarize, itemKey, type BatchItem } from "../src/utils/batchQueue";
import { transcribeFile, fileToBase64, MAX_AUDIO_BYTES } from "../src/utils/transcribeClient";

const mkFile = (name: string, bytes = 10, type = "audio/mpeg") => new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("addFiles", () => {
  it("queues new files and skips exact duplicates", () => {
    const a = addFiles([], [mkFile("a.mp3"), mkFile("b.mp3")]);
    expect(a.items.map((i) => i.status)).toEqual(["queued", "queued"]);
    const b = addFiles(a.items, [mkFile("a.mp3"), mkFile("c.mp3")]);
    expect(b.skipped).toBe(1);
    expect(b.items.map((i) => i.name)).toEqual(["a.mp3", "b.mp3", "c.mp3"]);
  });
  it("same name but different size is a different file", () => {
    expect(addFiles(addFiles([], [mkFile("a.mp3", 10)]).items, [mkFile("a.mp3", 11)]).skipped).toBe(0);
  });
  it("itemKey is stable", () => expect(itemKey({ name: "x", size: 1, lastModified: 2 })).toBe("x|1|2"));
});

describe("runBatch", () => {
  const fresh = (n: number) => addFiles([], Array.from({ length: n }, (_, i) => mkFile(`f${i}.mp3`, i + 1))).items;

  it("processes everything in order with concurrency 1", async () => {
    const items = fresh(4);
    const order: string[] = [];
    let active = 0, maxActive = 0;
    await runBatch(items, {
      concurrency: 1, signal: new AbortController().signal, onUpdate: () => {},
      run: async (it) => { active++; maxActive = Math.max(maxActive, active); order.push(it.name); await sleep(5); active--; return { result: { ok: it.name } }; },
    });
    expect(order).toEqual(["f0.mp3", "f1.mp3", "f2.mp3", "f3.mp3"]);
    expect(maxActive).toBe(1);
    expect(items.every((i) => i.status === "done")).toBe(true);
  });

  it("never exceeds the requested concurrency but does use it", async () => {
    const items = fresh(8);
    let active = 0, maxActive = 0;
    await runBatch(items, { concurrency: 3, signal: new AbortController().signal, onUpdate: () => {}, run: async () => { active++; maxActive = Math.max(maxActive, active); await sleep(15); active--; return { result: 1 }; } });
    expect(maxActive).toBe(3);
  });

  it("caps absurd concurrency values", async () => {
    const items = fresh(10);
    let active = 0, maxActive = 0;
    await runBatch(items, { concurrency: 99, signal: new AbortController().signal, onUpdate: () => {}, run: async () => { active++; maxActive = Math.max(maxActive, active); await sleep(10); active--; return { result: 1 }; } });
    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it("isolates failures: one bad file does not stop the others", async () => {
    const items = fresh(3);
    await runBatch(items, { concurrency: 1, signal: new AbortController().signal, onUpdate: () => {}, run: async (it) => { if (it.name === "f1.mp3") throw new Error("boom"); return { result: 1 }; } });
    expect(items.map((i) => i.status)).toEqual(["done", "failed", "done"]);
    expect(items[1].error).toBe("boom");
  });

  it("marks cached results", async () => {
    const items = fresh(2);
    await runBatch(items, { concurrency: 1, signal: new AbortController().signal, onUpdate: () => {}, run: async (it) => ({ result: 1, cached: it.name === "f0.mp3" }) });
    expect(items.map((i) => i.cached)).toEqual([true, false]);
  });

  it("stops starting new work when aborted and cancels what is left", async () => {
    const items = fresh(5);
    const ctrl = new AbortController();
    await runBatch(items, { concurrency: 1, signal: ctrl.signal, onUpdate: () => {}, run: async (it, signal) => { if (it.name === "f1.mp3") ctrl.abort(); return { result: 1 }; } });
    expect(items.map((i) => i.status)).toEqual(["done", "done", "cancelled", "cancelled", "cancelled"]);
  });

  it("an in-flight request aborted by the signal is 'cancelled', not 'failed'", async () => {
    const items = fresh(2);
    const ctrl = new AbortController();
    await runBatch(items, { concurrency: 1, signal: ctrl.signal, onUpdate: () => {}, run: (it, signal) => new Promise((_, rej) => { signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))); setTimeout(() => ctrl.abort(), 5); }) });
    expect(items.map((i) => i.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("only touches queued items (finished ones are left alone)", async () => {
    const items = fresh(3);
    items[0].status = "done";
    const run = vi.fn(async () => ({ result: 1 }));
    await runBatch(items, { concurrency: 1, signal: new AbortController().signal, onUpdate: () => {}, run });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("emits an update for every status change", async () => {
    const items = fresh(1);
    const seen: string[] = [];
    await runBatch(items, { concurrency: 1, signal: new AbortController().signal, onUpdate: (i) => seen.push(i.status), run: async () => ({ result: 1 }) });
    expect(seen).toEqual(["analyzing", "done"]);
  });
});

describe("summarize", () => {
  it("counts statuses and averages scores of finished items", () => {
    const items: BatchItem[] = ["done", "done", "failed", "queued", "cancelled"].map((s, i) => ({ id: String(i), file: mkFile("x"), name: "x", size: 1, status: s as any, result: { s: i === 0 ? 80 : 90 }, cached: i === 1 }));
    const s = summarize(items, (r) => r.s);
    expect(s).toMatchObject({ total: 5, done: 2, failed: 1, queued: 1, cancelled: 1, cached: 1, finished: 4, avgScore: 85 });
  });
  it("has no average when nothing finished", () => expect(summarize([], () => 1).avgScore).toBeUndefined());
});

describe("transcribeFile (client)", () => {
  const res = (body: any, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  const opts = { processingMode: "transcription_with_analysis", retryDelayMs: 1, durationTimeoutMs: 1 };

  it("encodes the file and posts the documented payload", async () => {
    const f = vi.fn(async (_u: any, init: any) => { const b = JSON.parse(init.body); expect(b).toMatchObject({ mimeType: "audio/mpeg", fileName: "call.mp3", processingMode: "transcription_with_analysis" }); expect(Buffer.from(b.audioBytes, "base64")).toHaveLength(10); return res({ transcript: [1], cacheHit: true }); });
    const out = await transcribeFile(mkFile("call.mp3"), { ...opts, fetchImpl: f as any });
    expect(out.cacheHit).toBe(true);
    expect(f.mock.calls[0][0]).toBe("/api/transcribe");
  });
  it("retries while the server is starting (HTML page / 502 / 503 / 504) and then succeeds", async () => {
    const seq = [res("<!doctype html><title>Starting Server</title>"), res("x", 502), res("x", 503), res("x", 504), res({ ok: true })];
    const f = vi.fn(async () => seq.shift()!);
    expect((await transcribeFile(mkFile("a.mp3"), { ...opts, fetchImpl: f as any })).ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(5);
  });
  it("retries network errors then gives up with the error message", async () => {
    const f = vi.fn(async () => { throw new Error("ECONNRESET"); });
    await expect(transcribeFile(mkFile("a.mp3"), { ...opts, maxRetries: 3, fetchImpl: f as any })).rejects.toThrow("ECONNRESET");
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("does NOT retry a real application error and surfaces the server message", async () => {
    const f = vi.fn(async () => res({ error: "لم يتم العثور على بيانات صوتية" }, 400));
    await expect(transcribeFile(mkFile("a.mp3"), { ...opts, fetchImpl: f as any })).rejects.toThrow("لم يتم العثور");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("rejects files over the size limit without sending anything", async () => {
    const f = vi.fn();
    const big = new File([new Uint8Array(1)], "big.mp3", { type: "audio/mpeg" });
    Object.defineProperty(big, "size", { value: MAX_AUDIO_BYTES + 1 });
    await expect(transcribeFile(big, { ...opts, fetchImpl: f as any })).rejects.toThrow("أكبر من الحد");
    expect(f).not.toHaveBeenCalled();
  });
  it("propagates aborts as AbortError", async () => {
    const ctrl = new AbortController();
    const f = vi.fn(async (_u: any, init: any) => new Promise((_, rej) => { init.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))); setTimeout(() => ctrl.abort(), 5); }));
    await expect(transcribeFile(mkFile("a.mp3"), { ...opts, signal: ctrl.signal, fetchImpl: f as any })).rejects.toMatchObject({ name: "AbortError" });
  });
  it("fileToBase64 round-trips arbitrary bytes", async () => {
    const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i % 251);
    expect(Buffer.from(await fileToBase64(new Blob([bytes])), "base64").equals(Buffer.from(bytes))).toBe(true);
  });
});
