/**
 * Verifies that your Gemini key works with THIS app, step by step. Never prints the key.
 *
 *   GEMINI_API_KEY=... npx tsx scripts/verify-gemini.ts                # connectivity + audio + JSON mode
 *   GEMINI_API_KEY=... npx tsx scripts/verify-gemini.ts --full call.mp3 # + full pipeline through a RUNNING server
 *
 * Optional: GEMINI_USE_VERTEX=true|false to force the mode, VERIFY_BASE=http://localhost:3000, VERIFY_PASSWORD=<app password>.
 */
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY || "";
if (!key) { console.error("✘ GEMINI_API_KEY is not set"); process.exit(2); }
const MODEL = process.env.GEMINI_VERIFY_MODEL || "gemini-2.5-flash";
const redact = (s: string) => s.split(key).join("[KEY]");
const ok = (m: string) => console.log("✔", m);
const bad = (m: string) => console.error("✘", redact(m));

const mk = (vertex: boolean) => new GoogleGenAI({ apiKey: key, ...(vertex ? { vertexai: true } : {}) });

async function pickMode(): Promise<{ ai: GoogleGenAI; mode: string } | null> {
  const forced = process.env.GEMINI_USE_VERTEX;
  const order = forced === "true" ? [true] : forced === "false" ? [false] : key.startsWith("AQ.") ? [true, false] : [false, true];
  for (const vertex of order) {
    const mode = vertex ? "Vertex AI (API key)" : "Gemini Developer API";
    const t0 = Date.now();
    try {
      const ai = mk(vertex);
      const r = await ai.models.generateContent({ model: MODEL, contents: "Reply with exactly: pong" });
      ok(`[${mode}] text round-trip in ${Date.now() - t0} ms → "${(r.text || "").trim().slice(0, 30)}"`);
      return { ai, mode };
    } catch (e: any) {
      bad(`[${mode}] ${String(e?.message || e).split("\n")[0].slice(0, 220)}`);
    }
  }
  return null;
}

async function main() {
  const picked = await pickMode();
  if (!picked) {
    console.error("\nNo working mode. Check: network access to generativelanguage.googleapis.com / aiplatform.googleapis.com, key restrictions, billing/quota.");
    process.exit(1);
  }
  const { ai, mode } = picked;
  console.log(`   → set GEMINI_USE_VERTEX=${mode.startsWith("Vertex")} if you want to pin this mode.\n`);

  // 2) audio understanding (inline audio, as the app does)
  const wav = path.join(__dirname, "..", "tests", "assets", "speech_60s.wav");
  if (fs.existsSync(wav)) {
    const t0 = Date.now();
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: fs.readFileSync(wav).toString("base64") } }, { text: "Transcribe the first two sentences verbatim, nothing else." }] }],
      config: { temperature: 0 },
    });
    const txt = (r.text || "").trim();
    txt.length > 10 ? ok(`inline audio understood in ${Date.now() - t0} ms → "${txt.slice(0, 90).replace(/\s+/g, " ")}…"`) : bad("audio returned no text");
  }

  // 3) JSON mode + the app's own schema validator
  const r2 = await ai.models.generateContent({
    model: MODEL,
    contents: 'Return JSON: {"greetingAnalysis":{"isGreetingUsed":true},"transcript":[{"timeStart":"00:00","timeEnd":"00:03","speaker":"موظف خدمة العملاء","text":"أهلاً"}]}',
    config: { responseMimeType: "application/json", temperature: 0 },
  });
  try {
    const { validateAndSanitizeQAResult } = await import("../src/utils/pydanticValidator");
    const v = validateAndSanitizeQAResult(JSON.parse(r2.text || "{}"));
    v.isValid ? ok("JSON mode output passes the app's schema validator") : bad("JSON parsed but schema coerced: " + (v.errors || []).join("; "));
  } catch (e: any) { bad("JSON mode failed: " + e?.message); }

  // 4) optional: full pipeline through a running server
  const i = process.argv.indexOf("--full");
  if (i > -1) {
    const file = process.argv[i + 1];
    if (!file || !fs.existsSync(file)) { bad("--full needs an audio file path"); process.exit(1); }
    const base = process.env.VERIFY_BASE || "http://localhost:3000";
    let token = "";
    if (process.env.VERIFY_PASSWORD) {
      const lr = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: process.env.VERIFY_PASSWORD }) });
      token = (await lr.json()).token || "";
    }
    const mime = /\.wav$/i.test(file) ? "audio/wav" : /\.m4a$/i.test(file) ? "audio/mp4" : "audio/mpeg";
    const t0 = Date.now();
    const res = await fetch(`${base}/api/transcribe`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ audioBytes: fs.readFileSync(file).toString("base64"), mimeType: mime, processingMode: "transcription_with_analysis" }) });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) { bad(`server returned ${res.status}: ${JSON.stringify(body).slice(0, 300)}`); process.exit(1); }
    const stages: any[] = body.pipelineStages || [];
    const count = (s: string) => stages.filter((x) => x.status === s).length;
    ok(`full pipeline finished in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(`   turns=${body.transcript?.length} | VAD=${body.sileroVad?.engine} (neural=${body.sileroVad?.neural}) | reviews=${body.pipelineReviewMeta?.reviewCount} | stages: ${count("completed")} done / ${count("skipped")} skipped / ${count("failed")} failed`);
    const problems: string[] = [];
    if (!(body.transcript?.length > 0)) problems.push("empty transcript");
    if (body.isBenchmark !== undefined) problems.push("phantom isBenchmark flag present");
    if (stages.length !== 15) problems.push(`trace has ${stages.length} stages`);
    if (body.analysisVersion === undefined) problems.push("analysisVersion missing");
    problems.length ? (bad("checks failed: " + problems.join(", ")), process.exit(1)) : ok("end-to-end checks passed (transcript, no phantom flag, honest 15-stage trace, versioned)");
  }
  console.log("\nAll requested checks passed.");
}

main().catch((e) => { bad(String(e?.message || e)); process.exit(1); });
