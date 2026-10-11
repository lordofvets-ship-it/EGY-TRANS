import type { PipelineStageInfo } from "../types";

/**
 * Bump this whenever the prompt, the post-processing rules or the scoring logic change.
 * Cached analyses carrying a different version are treated as stale and re-analysed
 * the next time the same audio is uploaded (the old record stays until overwritten).
 */
export const ANALYSIS_VERSION = "2026.10-r2";

/* -------------------------------------------------------------------------- */
/* Phantom benchmark flag                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The model used to copy `isBenchmark: true` from the prompt's JSON example into real calls.
 * Only the dedicated /api/benchmark-call response may carry the flag.
 */
export function stripPhantomBenchmark<T extends Record<string, any>>(result: T, isRealBenchmark = false): T {
  if (!result || isRealBenchmark) return result;
  delete (result as any).isBenchmark;
  delete (result as any).benchmarkNotes;
  return result;
}

/* -------------------------------------------------------------------------- */
/* Honest pipeline trace – derived from facts, never from literals            */
/* -------------------------------------------------------------------------- */

export interface TraceFacts {
  bufferBytes: number;
  mime: string;
  /** null when VAD was not run or not available */
  vad: { engine?: string; speechRatio?: number; musicRatio?: number; neural?: boolean } | null;
  vadUnavailableReason?: string;
  whisperUsed: boolean;
  qwenUsed: boolean;
  emotionUsed: boolean;
  geminiModel: string;
  processingMode: string;
  reviewMeta: {
    reviewCount: number;
    consensusStatus?: string;
    agreementScore?: number;
    skippedReason?: string;
    arbiterUsed?: boolean;
  };
  validationValid: boolean;
  audioHash: string;
  saved: boolean;
}

export function buildPipelineStages(f: TraceFacts): PipelineStageInfo[] {
  const analysisOn = f.processingMode !== "transcription_only";
  const reviewed = f.reviewMeta.reviewCount >= 2;
  const arbiter = Boolean(f.reviewMeta.arbiterUsed) || f.reviewMeta.reviewCount >= 3;

  const asrTools = [
    f.whisperUsed ? "OpenAI Whisper-1 (مرجع)" : null,
    f.qwenUsed ? "QwenCleo-ASR (مرجع)" : null,
    `Gemini ${f.geminiModel}`,
  ].filter(Boolean) as string[];

  const stages: PipelineStageInfo[] = [
    { step: 1, name: "audio_input", nameArabic: "استلام وتدقيق مدخلات الصوت", tool: "Express Audio Controller", status: "completed", details: `حجم الملف: ${(f.bufferBytes / 1024).toFixed(1)} KB` },
    { step: 2, name: "audio_validation", nameArabic: "التحقق من سلامة البايتات وصيغة الصوت", tool: "MIME & Stream Validator", status: "completed", details: `الصيغة: ${f.mime}` },
    {
      step: 3, name: "audio_preprocessing", nameArabic: "المعالجة الأولية واستخراج الإشارات", tool: "FFmpeg PCM 16kHz",
      status: f.vad ? "completed" : "failed",
      details: f.vad ? "تم فك الترميز وتحويله إلى PCM 16kHz أحادي" : (f.vadUnavailableReason || "لم يتم فك ترميز الصوت"),
    },
    {
      step: 4, name: "voice_activity_detection", nameArabic: "كشف النشاط الصوتي وفترات الصمت",
      tool: f.vad?.engine || "Energy+ZCR VAD",
      status: f.vad ? "completed" : "failed",
      details: f.vad
        ? (f.vad.neural
            ? `نموذج Silero VAD v5 العصبي — كلام ${(((f.vad.speechRatio ?? 0) * 100)).toFixed(1)}% • موسيقى/نغمات ${(((f.vad.musicRatio ?? 0) * 100)).toFixed(1)}%`
            : `نسبة الكلام: ${(((f.vad.speechRatio ?? 0) * 100)).toFixed(1)}% (تقدير طاقي بديل — لا يفرّق بين الكلام والموسيقى)`)
        : "بيانات VAD غير متاحة — لم تُستخدم كدليل في التحليل",
    },
    { step: 5, name: "speaker_processing", nameArabic: "فصل المتحدثين (الزميل vs العميل)", tool: `Gemini ${f.geminiModel} (من الصوت مباشرة)`, status: "completed", details: "الفصل يتم بواسطة النموذج وليس بنموذج Diarization مستقل" },
    { step: 6, name: "primary_transcription", nameArabic: "التفريغ الصوتي", tool: asrTools.join(" + "), status: "completed", details: f.whisperUsed || f.qwenUsed ? "استُخدمت مسودات ASR كنص مرجعي للنموذج" : "التفريغ من Gemini فقط (Whisper/Qwen لم يُستخدما في هذه المكالمة)" },
    { step: 7, name: "transcript_cleaning", nameArabic: "تنظيف النص وتطبيع الأسماء والألقاب", tool: "قواعد برمجية (Normalizer)", status: "completed", details: "تطبيع الأسماء وحذف الضوضاء" },
    { step: 8, name: "transcript_validation", nameArabic: "التحقق من تسلسل التوقيتات والأدوار", tool: "قواعد برمجية (Timeline Verifier)", status: "completed", details: "مطابقة التوقيتات وتغطية التفريغ" },
    { step: 9, name: "call_analysis", nameArabic: "تحليل سياق المكالمة", tool: `Gemini ${f.geminiModel}`, status: analysisOn ? "completed" : "skipped", details: analysisOn ? "تحليل الطلبات بناءً على النص الفعلي" : "وضع «تفريغ فقط» — لم يُشغَّل التحليل" },
    { step: 10, name: "qa_criteria_evaluation", nameArabic: "تقييم معايير الجودة", tool: `Gemini ${f.geminiModel} + قواعد برمجية`, status: analysisOn ? "completed" : "skipped", details: analysisOn ? "تقييم المعايير مع تصحيح القواعد الصارمة" : "وضع «تفريغ فقط»" },
    { step: 11, name: "evidence_extraction", nameArabic: "استخراج الأدلة والتوقيتات", tool: "Gemini + قواعد برمجية", status: analysisOn ? "completed" : "skipped", details: analysisOn ? "توثيق التوقيت والنص لكل معيار" : "وضع «تفريغ فقط»" },
    {
      step: 12, name: "independent_verification", nameArabic: "المراجعة المستقلة الثانية (Review 2)", tool: `Gemini ${f.geminiModel}`,
      status: reviewed ? "completed" : "skipped",
      details: reviewed ? `اتفاق ${f.reviewMeta.agreementScore ?? "—"}%` : (f.reviewMeta.skippedReason || "لم تُنفَّذ مراجعة ثانية لهذه المكالمة"),
    },
    {
      step: 13, name: "conflict_resolution", nameArabic: "فض النزاع (Review 3)", tool: "Gemini (محكّم)",
      status: arbiter ? "completed" : "skipped",
      details: arbiter ? "حُسمت الخلافات بمراجعة ثالثة" : (reviewed ? "لا يوجد خلاف يستدعي التحكيم" : "غير مطلوب — لم تُنفَّذ مراجعة ثانية"),
    },
    { step: 14, name: "final_result_validation", nameArabic: "التحقق الهيكلي النهائي", tool: "Zod Schema Validator", status: "completed", details: f.validationValid ? "اجتاز التحقق دون تعديل" : "عُدِّلت بعض الحقول تلقائياً (coerced with warnings)" },
    { step: 15, name: "save_final_result", nameArabic: "الحفظ المفهرس بالبصمة الصوتية", tool: "SHA-256 Audio Hash Storage", status: f.saved ? "completed" : "failed", details: f.saved ? `بصمة: ${f.audioHash.slice(0, 12)}…` : "تعذّر الحفظ" },
  ];
  return stages;
}

/* -------------------------------------------------------------------------- */
/* PII redaction                                                              */
/* -------------------------------------------------------------------------- */

const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;
const toLatinDigits = (s: string) =>
  s.replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660));

export function redactPII(input: string): string {
  if (!input) return input;
  let s = toLatinDigits(String(input));
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[بريد محذوف]");
  s = s.replace(/(?<!\d)[23](?:[\s-]?\d){13}(?!\d)/g, "[رقم قومي محذوف]");
  s = s.replace(/(?<!\d)(?:\+?20[\s-]?|0[\s-]?)?1[\s-]?[0125](?:[\s-]?\d){8}(?!\d)/g, "[رقم هاتف محذوف]");
  return s;
}

export function redactTranscript<T extends Record<string, any>>(result: T): T {
  if (!result || !Array.isArray(result.transcript)) return result;
  (result as any).transcript = result.transcript.map((t: any) => ({ ...t, text: redactPII(String(t?.text ?? "")) }));
  (result as any).piiRedacted = true;
  return result;
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                     */
/* -------------------------------------------------------------------------- */

export interface AlertDecision {
  shouldAlert: boolean;
  reasons: string[];
}

export function evaluateAlert(result: any, score: number, threshold = 70): AlertDecision {
  const reasons: string[] = [];
  if (Number.isFinite(score) && score < threshold) reasons.push(`درجة الجودة ${score}% أقل من الحد ${threshold}%`);
  if (result?.unprofessionalWordsAnalysis?.hasUnprofessionalWords) reasons.push("رُصدت كلمات غير مهنية من الزميل");
  if (result?.customerComplaintAnalysis?.hasComplaint) reasons.push("العميل قدّم شكوى");
  const alerts = Array.isArray(result?.complianceAlerts) ? result.complianceAlerts : [];
  if (alerts.length > 0) reasons.push(`${alerts.length} تنبيه امتثال`);
  return { shouldAlert: reasons.length > 0 && (score < threshold || reasons.length >= 2), reasons };
}

export function buildAlertPayload(result: any, score: number, reasons: string[]) {
  const agent = String(result?.agentName || "الزميل");
  const hash = String(result?.audioHash || "").slice(0, 10);
  return {
    // Slack/Teams-compatible "text" plus structured fields for custom receivers
    text: `🚨 تنبيه جودة مكالمة — ${agent} — الدرجة ${score}%\n• ${reasons.join("\n• ")}\n(بصمة: ${hash})`,
    agent,
    score,
    reasons,
    audioHash: result?.audioHash,
    savedAt: new Date().toISOString(),
  };
}

export async function sendAlertWebhook(url: string, payload: unknown, timeoutMs = 8000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
