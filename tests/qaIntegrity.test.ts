import { describe, it, expect } from "vitest";
import http from "http";
import { stripPhantomBenchmark, buildPipelineStages, redactPII, redactTranscript, evaluateAlert, buildAlertPayload, sendAlertWebhook, ANALYSIS_VERSION } from "../src/utils/qaIntegrity";

const facts = (o: any = {}) => ({
  bufferBytes: 2048, mime: "audio/mp3", vad: { engine: "Energy+ZCR VAD", speechRatio: 0.7 }, whisperUsed: false, qwenUsed: false, emotionUsed: true,
  geminiModel: "2.5-flash", processingMode: "transcription_with_analysis", reviewMeta: { reviewCount: 1, skippedReason: "مدة المكالمة (420 ث) تتجاوز الحد" },
  validationValid: true, audioHash: "a".repeat(64), saved: true, ...o,
});

describe("phantom benchmark flag", () => {
  it("is removed from real calls", () => {
    const r: any = stripPhantomBenchmark({ isBenchmark: true, benchmarkNotes: "x", audioHash: "h" });
    expect(r.isBenchmark).toBeUndefined();
    expect(r.benchmarkNotes).toBeUndefined();
  });
  it("is kept for the dedicated benchmark call", () => {
    expect(stripPhantomBenchmark({ isBenchmark: true }, true).isBenchmark).toBe(true);
  });
});

describe("honest pipeline trace", () => {
  it("returns 15 stages", () => expect(buildPipelineStages(facts())).toHaveLength(15));
  it("marks Review 2 / 3 as skipped with the real reason when only one review ran", () => {
    const s = buildPipelineStages(facts());
    expect(s[11].status).toBe("skipped");
    expect(s[11].details).toContain("420");
    expect(s[12].status).toBe("skipped");
  });
  it("marks Review 2 completed and Review 3 skipped when reviews agreed", () => {
    const s = buildPipelineStages(facts({ reviewMeta: { reviewCount: 2, agreementScore: 100 } }));
    expect(s[11].status).toBe("completed");
    expect(s[12].status).toBe("skipped");
  });
  it("marks the arbiter completed only when a third review ran", () => {
    expect(buildPipelineStages(facts({ reviewMeta: { reviewCount: 3, arbiterUsed: true } }))[12].status).toBe("completed");
  });
  it("skips analysis stages in transcription-only mode", () => {
    const s = buildPipelineStages(facts({ processingMode: "transcription_only" }));
    expect([s[8], s[9], s[10]].map((x) => x.status)).toEqual(["skipped", "skipped", "skipped"]);
  });
  it("reports VAD as failed (not completed) when unavailable", () => {
    const s = buildPipelineStages(facts({ vad: null, vadUnavailableReason: "ffmpeg failed" }));
    expect(s[2].status).toBe("failed");
    expect(s[3].status).toBe("failed");
  });
  it("does not claim Whisper/Qwen/Silero when they did not run", () => {
    const text = JSON.stringify(buildPipelineStages(facts()));
    expect(text).not.toMatch(/Whisper-1|QwenCleo-ASR \(|Silero-VAD v4/);
  });
  it("names Whisper/Qwen when they were used", () => {
    expect(buildPipelineStages(facts({ whisperUsed: true, qwenUsed: true }))[5].tool).toMatch(/Whisper.*Qwen/);
  });
  it("reports a save failure", () => expect(buildPipelineStages(facts({ saved: false }))[14].status).toBe("failed"));
  it("reports coerced validation", () => expect(buildPipelineStages(facts({ validationValid: false }))[13].details).toContain("coerced"));
});

describe("PII redaction", () => {
  it.each([
    ["رقمي 01012345678 كلمني", "[رقم هاتف محذوف]"],
    ["رقمي ٠١٠١٢٣٤٥٦٧٨ كلمني", "[رقم هاتف محذوف]"],
    ["رقمي +20 101 234 5678", "[رقم هاتف محذوف]"],
    ["الرقم 0 1 1 1 2 2 3 3 4 4 5", "[رقم هاتف محذوف]"],
    ["ابعت على mona.ali@example.com", "[بريد محذوف]"],
    ["الرقم القومي 29801011234567 ", "[رقم قومي محذوف]"],
  ])("redacts %s", (input, token) => expect(redactPII(input)).toContain(token));
  it("leaves ordinary numbers and drug quantities alone", () => {
    expect(redactPII("عايز 3 علب وسعرها 250 جنيه")).toBe("عايز 3 علب وسعرها 250 جنيه");
  });
  it("redacts transcript text and flags the record", () => {
    const r: any = redactTranscript({ transcript: [{ text: "رقمي 01234567890", speaker: "العميل" }] });
    expect(r.transcript[0].text).toContain("[رقم هاتف محذوف]");
    expect(r.piiRedacted).toBe(true);
  });
});

describe("alerts", () => {
  it("alerts on low score", () => expect(evaluateAlert({}, 55, 70).shouldAlert).toBe(true));
  it("does not alert on a clean high score", () => expect(evaluateAlert({}, 95, 70).shouldAlert).toBe(false));
  it("alerts on unprofessional words + complaint even with a good score", () => {
    const d = evaluateAlert({ unprofessionalWordsAnalysis: { hasUnprofessionalWords: true }, customerComplaintAnalysis: { hasComplaint: true } }, 90, 70);
    expect(d.shouldAlert).toBe(true);
    expect(d.reasons).toHaveLength(2);
  });
  it("builds a Slack-compatible payload", () => {
    const p = buildAlertPayload({ agentName: "آية", audioHash: "abcdef1234567890" }, 61, ["سبب"]);
    expect(p.text).toContain("آية");
    expect(p.text).toContain("61%");
  });
  it("delivers the webhook to a real HTTP receiver and survives a dead one", async () => {
    let received: any = null;
    const srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { received = JSON.parse(b); res.end("ok"); }); });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as any).port;
    expect(await sendAlertWebhook(`http://127.0.0.1:${port}/hook`, { text: "hi" })).toBe(true);
    expect(received.text).toBe("hi");
    srv.close();
    expect(await sendAlertWebhook(`http://127.0.0.1:${port}/hook`, { text: "x" }, 1500)).toBe(false);
  });
});

it("exposes a non-empty analysis version", () => expect(ANALYSIS_VERSION).toMatch(/^\d{4}\.\d{2}-r\d+$/));

describe("VAD wording in the trace", () => {
  it("describes the neural model when it ran", () => {
    const s = buildPipelineStages(facts({ vad: { engine: "Silero VAD v5 (ONNX)", speechRatio: 0.49, musicRatio: 0.25, neural: true } }));
    expect(s[3].details).toContain("Silero VAD v5");
    expect(s[3].details).toContain("49.0%");
    expect(s[3].details).toContain("25.0%");
  });
  it("warns that the fallback cannot separate speech from music", () => {
    const s = buildPipelineStages(facts({ vad: { engine: "Energy+ZCR VAD", speechRatio: 0.7, neural: false } }));
    expect(s[3].details).toContain("لا يفرّق بين الكلام والموسيقى");
  });
});
