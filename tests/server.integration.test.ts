/**
 * Runs the REAL bundled server (dist/server.cjs) in a throw-away working directory seeded with the 17 real analysed calls.
 * Needs `npm run build` first (done automatically below if the bundle is missing).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, execSync, ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { GOLDEN_DIR } from "./helpers";

const ROOT = path.join(__dirname, "..");
const BUNDLE = path.join(ROOT, "dist", "server.cjs");
const PORT = 39100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let cwd = "";
let proc: ChildProcess;
let logs = "";
const tokens: Record<string, string> = {};

const api = (p: string, init: any = {}, token?: string) =>
  fetch(BASE + p, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
const goldenFiles = () => fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json")).sort();

beforeAll(async () => {
  if (!fs.existsSync(BUNDLE)) execSync("npm run build", { cwd: ROOT, stdio: "ignore" });
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "qa-int-"));
  fs.mkdirSync(path.join(cwd, "data", "audio_cache"), { recursive: true });
  for (const f of goldenFiles()) fs.copyFileSync(path.join(GOLDEN_DIR, f), path.join(cwd, "data", "audio_cache", f));
  fs.copyFileSync(path.join(ROOT, "data", "hindsight_memory_bank.json"), path.join(cwd, "data", "hindsight_memory_bank.json"));
  proc = spawn("node", [BUNDLE], {
    cwd,
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), APP_ADMIN_PASSWORD: "adm-pass", APP_ANALYST_PASSWORD: "ana-pass", AUTH_SECRET: "test-secret", GEMINI_API_KEY: "dummy-key" },
  });
  proc.stdout!.on("data", (d) => (logs += d));
  proc.stderr!.on("data", (d) => (logs += d));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const login = async (pw: string) => (await (await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password: pw }) })).json()).token;
  tokens.admin = await login("adm-pass");
  tokens.analyst = await login("ana-pass");
}, 60000);

afterAll(() => { proc?.kill("SIGKILL"); try { fs.rmSync(cwd, { recursive: true, force: true }); } catch {} });

describe("authentication", () => {
  it("serves health publicly with hardened headers", async () => {
    const r = await fetch(BASE + "/api/health");
    expect(r.status).toBe(200);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-powered-by")).toBeNull();
  });
  it("reports that auth is required", async () => {
    const s = await (await api("/api/auth/status")).json();
    expect(s).toMatchObject({ authRequired: true, authenticated: false });
    const s2 = await (await api("/api/auth/status", {}, tokens.analyst)).json();
    expect(s2).toMatchObject({ authenticated: true, role: "analyst" });
  });
  it("rejects API calls without a token and with a forged token", async () => {
    expect((await api("/api/analyzed-calls")).status).toBe(401);
    expect((await api("/api/analyzed-calls", {}, "forged.token")).status).toBe(401);
  });
  it("rejects a wrong password", async () => {
    expect((await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password: "nope" }) })).status).toBe(401);
  });
  it("issues role-bearing tokens", () => { expect(tokens.admin).toBeTruthy(); expect(tokens.analyst).toBeTruthy(); expect(tokens.admin).not.toBe(tokens.analyst); });
});

describe("analyzed calls registry", () => {
  it("lists the 17 real calls and no longer exposes phantom benchmark flags", async () => {
    const d = await (await api("/api/analyzed-calls", {}, tokens.analyst)).json();
    expect(d.calls).toHaveLength(17);
    for (const c of d.calls) {
      expect(c.fullResult.isBenchmark).toBeUndefined();
      expect(c.agentName).not.toMatch(/المعيارية المعتمدة/);
    }
  });
  it("analysts cannot delete; admins can", async () => {
    const d = await (await api("/api/analyzed-calls", {}, tokens.admin)).json();
    const id = d.calls[0].audioHash || d.calls[0].id;
    expect((await api(`/api/analyzed-calls/${id}`, { method: "DELETE" }, tokens.analyst)).status).toBe(403);
    expect((await api("/api/analyzed-calls", { method: "DELETE" }, tokens.analyst)).status).toBe(403);
    expect(fs.existsSync(path.join(cwd, "data", "audio_cache", `${id}.json`))).toBe(true);
    const del = await (await api(`/api/analyzed-calls/${id}`, { method: "DELETE" }, tokens.admin)).json();
    expect(del.success).toBe(true);
    expect(fs.existsSync(path.join(cwd, "data", "audio_cache", `${id}.json`))).toBe(false);
    expect((await (await api("/api/analyzed-calls", {}, tokens.admin)).json()).calls).toHaveLength(16);
  });
  it("analysts can still rename", async () => {
    const d = await (await api("/api/analyzed-calls", {}, tokens.analyst)).json();
    const id = d.calls[0].audioHash || d.calls[0].id;
    const r = await (await api(`/api/analyzed-calls/${id}`, { method: "PATCH", body: JSON.stringify({ agentName: "سارة" }) }, tokens.analyst)).json();
    expect(r.success).toBe(true);
  });
});

describe("hindsight memory governance over HTTP", () => {
  const good = { category: "world_facts", title: "قاعدة اختبار", content: "يجب ذكر اسم الصيدلية في الترحيب.", importance: "medium" };
  it("analysts cannot write, delete or reset", async () => {
    expect((await api("/api/hindsight/retain", { method: "POST", body: JSON.stringify(good) }, tokens.analyst)).status).toBe(403);
    expect((await api("/api/hindsight/reset", { method: "POST" }, tokens.analyst)).status).toBe(403);
    expect((await api("/api/hindsight/memories/mem-dir-001", { method: "DELETE" }, tokens.analyst)).status).toBe(403);
  });
  it("rejects developer-style and call-specific critical memories with reasons (422)", async () => {
    const dev = await api("/api/hindsight/retain", { method: "POST", body: JSON.stringify({ category: "mental_models", title: "تحديث", content: "تم تحديث حالة result.transcript في App.tsx", importance: "critical" }) }, tokens.admin);
    expect(dev.status).toBe(422);
    expect((await dev.json()).reasons.length).toBeGreaterThan(0);
    const spec = await api("/api/hindsight/retain", { method: "POST", body: JSON.stringify({ category: "mental_models", title: "اسم", content: "اسم العميلة في هذه المكالمة هو 'فاطمة'", importance: "critical" }) }, tokens.admin);
    expect(spec.status).toBe(422);
  });
  it("accepts a legitimate memory and lets an admin remove it", async () => {
    const ok = await api("/api/hindsight/retain", { method: "POST", body: JSON.stringify(good) }, tokens.admin);
    expect(ok.status).toBe(200);
    const { memory } = await ok.json();
    const list = await (await api("/api/hindsight/memories", {}, tokens.analyst)).json();
    expect(list.memories.some((m: any) => m.id === memory.id)).toBe(true);
    expect((await (await api(`/api/hindsight/memories/${memory.id}`, { method: "DELETE" }, tokens.admin)).json()).success).toBe(true);
  });
  it("the served bank is the cleaned one (no developer/UI/call-specific directives injected)", async () => {
    const { memories } = await (await api("/api/hindsight/memories", {}, tokens.admin)).json();
    const ids = memories.map((m: any) => m.id);
    for (const gone of ["mem-dir-004", "mem-dir-011", "mem-dir-014"]) expect(ids).not.toContain(gone);
    expect(memories.find((m: any) => m.id === "mem-dir-015").importance).toBe("medium");
  });
});

describe("backup", () => {
  it("is admin-only and returns a real gzip archive of data/", async () => {
    expect((await api("/api/download-backup", {}, tokens.analyst)).status).toBe(403);
    const r = await api("/api/download-backup", {}, tokens.admin);
    expect(r.status).toBe(200);
    const buf = Buffer.from(await r.arrayBuffer());
    expect([buf[0], buf[1]]).toEqual([0x1f, 0x8b]);
    expect(buf.length).toBeGreaterThan(10000);
  });
});

describe("engine status", () => {
  it("reports the neural Silero VAD as active (model + onnxruntime resolved from the bundle location)", async () => {
    const st = await (await api("/api/engine-status", {}, tokens.analyst)).json();
    expect(st.vad).toMatchObject({ neural: true, engine: "Silero VAD v5 (ONNX)" });
    expect(st.engines ?? st.activeEngines ?? []).toBeDefined();
  });
  it("logged which VAD is active at start-up", () => expect(logs).toContain("[VAD] Silero VAD v5 (ONNX) ready."));
});

describe("stored recordings", () => {
  const hash = "b".repeat(64);
  beforeAll(() => {
    fs.mkdirSync(path.join(cwd, "data", "audio_files"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "data", "audio_files", `${hash}.wav`), Buffer.alloc(4096, 7));
  });
  it("404s for an unknown recording", async () => expect((await api(`/api/audio/${"c".repeat(64)}`, {}, tokens.analyst)).status).toBe(404));
  it("requires a token (header or ?token= for the audio endpoint only)", async () => {
    expect((await fetch(`${BASE}/api/audio/${hash}`)).status).toBe(401);
    expect((await fetch(`${BASE}/api/audio/${hash}?token=${tokens.analyst}`)).status).toBe(200);
    expect((await fetch(`${BASE}/api/analyzed-calls?token=${tokens.analyst}`)).status).toBe(401);
  });
  it("supports HTTP Range so the browser can seek", async () => {
    const r = await fetch(`${BASE}/api/audio/${hash}?token=${tokens.analyst}`, { headers: { Range: "bytes=100-199" } });
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 100-199/4096");
    expect((await r.arrayBuffer()).byteLength).toBe(100);
  });
  it("rejects path traversal in the hash", async () => {
    const r = await fetch(`${BASE}/api/audio/..%2F..%2Fpackage?token=${tokens.analyst}`);
    expect(r.status).toBe(404);
  });
});

describe("transcribe pipeline (without calling Gemini)", () => {
  const makeTone = (secs: number) => {
    const f = path.join(cwd, `tone_${secs}.wav`);
    execSync(`ffmpeg -y -f lavfi -i "sine=frequency=440:duration=${secs}" -ar 8000 -ac 1 "${f}"`, { stdio: "ignore" });
    return fs.readFileSync(f);
  };
  const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
  const post = (buf: Buffer, ms = 20000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return api("/api/transcribe", { method: "POST", signal: ctrl.signal, body: JSON.stringify({ audioBytes: buf.toString("base64"), mimeType: "audio/wav", processingMode: "transcription_with_analysis" }) }, tokens.analyst).finally(() => clearTimeout(t));
  };

  it("stores the recording under its SHA-256 before analysing", async () => {
    const tone = makeTone(5);
    const p = post(tone, 8000).catch(() => null);
    const file = path.join(cwd, "data", "audio_files", `${sha(tone)}.wav`);
    for (let i = 0; i < 40 && !fs.existsSync(file); i++) await new Promise((r) => setTimeout(r, 250));
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file).equals(tone)).toBe(true);
    await p;
  });

  it("serves a cache hit only when the analysis version is current, and flags hasAudioFile", async () => {
    const tone = makeTone(30);
    const h = sha(tone);
    const real = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, goldenFiles()[0]), "utf-8"));
    const { ANALYSIS_VERSION } = await import("../src/utils/qaIntegrity");
    // current version → reused
    fs.writeFileSync(path.join(cwd, "data", "audio_cache", `${h}.json`), JSON.stringify({ ...real, audioHash: h, analysisVersion: ANALYSIS_VERSION }));
    const hit = await post(tone, 30000);
    expect(hit.status).toBe(200);
    const body = await hit.json();
    expect(body.cacheHit).toBe(true);
    expect(body.transcript.length).toBe(real.transcript.length);
    expect(body.isBenchmark).toBeUndefined();
  });

  it("treats a cache entry from an older analysis version as stale (not served)", async () => {
    const tone = makeTone(31);
    const h = sha(tone);
    const real = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, goldenFiles()[1]), "utf-8"));
    fs.writeFileSync(path.join(cwd, "data", "audio_cache", `${h}.json`), JSON.stringify({ ...real, audioHash: h })); // no analysisVersion
    const outcome = await post(tone, 12000).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })).catch(() => ({ status: 0, body: {} as any }));
    expect((outcome.body as any).cacheHit).not.toBe(true);
    expect(logs).toContain(`Cached analysis for ${h.slice(0, 12)}`);
    expect(logs).toContain("re-analysing");
  });
});

describe("batch upload through the real HTTP API", () => {
  const tone = (hz: number, secs: number) => {
    const f = path.join(cwd, `batch_${hz}_${secs}.wav`);
    execSync(`ffmpeg -y -f lavfi -i "sine=frequency=${hz}:duration=${secs}" -ar 8000 -ac 1 "${f}"`, { stdio: "ignore" });
    return fs.readFileSync(f);
  };
  const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

  it("runs a mixed batch end-to-end: cached calls succeed, an invalid file fails alone, nothing else is disturbed", async () => {
    const { runBatch, addFiles, summarize } = await import("../src/utils/batchQueue");
    const { transcribeFile } = await import("../src/utils/transcribeClient");
    const { ANALYSIS_VERSION } = await import("../src/utils/qaIntegrity");
    const real = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, goldenFiles()[2]), "utf-8"));

    const bufA = tone(500, 20), bufB = tone(600, 21);
    for (const b of [bufA, bufB]) fs.writeFileSync(path.join(cwd, "data", "audio_cache", `${sha(b)}.json`), JSON.stringify({ ...real, audioHash: sha(b), analysisVersion: ANALYSIS_VERSION }));
    const files = [
      new File([bufA], "call-A.wav", { type: "audio/wav", lastModified: 1 }),
      new File([new Uint8Array(0)], "empty.wav", { type: "audio/wav", lastModified: 1 }),
      new File([bufB], "call-B.wav", { type: "audio/wav", lastModified: 1 }),
    ];
    const { items } = addFiles([], files);
    await runBatch(items, {
      concurrency: 2,
      signal: new AbortController().signal,
      onUpdate: () => {},
      run: async (item, signal) => {
        const result = await transcribeFile(item.file, { processingMode: "transcription_with_analysis", baseUrl: BASE, signal, retryDelayMs: 10, maxRetries: 2, fetchImpl: ((u: any, i: any) => fetch(u, { ...i, headers: { ...i.headers, Authorization: `Bearer ${tokens.analyst}` } })) as any });
        return { result, cached: Boolean(result.cacheHit) };
      },
    });
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(byName["call-A.wav"].status).toBe("done");
    expect(byName["call-A.wav"].cached).toBe(true);
    expect(byName["call-A.wav"].result.transcript.length).toBe(real.transcript.length);
    expect(byName["call-B.wav"].status).toBe("done");
    expect(byName["empty.wav"].status).toBe("failed");
    expect(byName["empty.wav"].error).toBeTruthy();
    const sum = summarize(items, () => undefined);
    expect(sum).toMatchObject({ total: 3, done: 2, failed: 1, cached: 2, finished: 3 });
  });

  it("rejects batch calls without a valid token (the batch client cannot bypass auth)", async () => {
    const { transcribeFile } = await import("../src/utils/transcribeClient");
    await expect(transcribeFile(new File([new Uint8Array(50)], "x.wav", { type: "audio/wav" }), { processingMode: "x", baseUrl: BASE, retryDelayMs: 1, maxRetries: 1 })).rejects.toThrow(/تسجيل الدخول|401/);
  });
});
