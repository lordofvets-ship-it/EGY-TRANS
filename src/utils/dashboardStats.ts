import type { AnalyzedCallRecord, TranscriptionResponse } from "../types";

export type CriterionKey =
  | "greeting" | "customerName" | "customerTitle" | "apology" | "holdTime"
  | "silence" | "furtherAssistance" | "callEnding" | "unprofessionalWords" | "agentTone";

export interface CriterionMeta {
  key: CriterionKey;
  ar: string;
  en: string;
  tipAr: string;
  tipEn: string;
  /** returns undefined when the criterion does not apply to the call */
  failed: (r: TranscriptionResponse) => boolean | undefined;
  evidence: (r: TranscriptionResponse) => string;
}

const unknownName = (v?: string) => !v || v === "لم يذكر" || v === "غير محدد";

export const CRITERIA: CriterionMeta[] = [
  {
    key: "greeting", ar: "الترحيب", en: "Greeting",
    tipAr: "ابدأ كل مكالمة بعبارة الترحيب المعتمدة قبل أي سؤال.", tipEn: "Open every call with the approved greeting before any question.",
    failed: (r) => (r.greetingAnalysis ? !r.greetingAnalysis.isGreetingUsed : undefined),
    evidence: (r) => r.greetingAnalysis?.evaluation || "",
  },
  {
    key: "customerName", ar: "ذكر اسم العميل", en: "Customer name",
    tipAr: "اسأل عن الاسم مبكراً وناده به مرة على الأقل أثناء المكالمة.", tipEn: "Ask for the name early and use it at least once.",
    failed: (r) => {
      const a = r.customerNameAnalysis;
      if (!a || unknownName(a.customerNameDetected)) return undefined;
      return !a.isMentionedByAgent;
    },
    evidence: (r) => r.customerNameAnalysis?.evaluation || "",
  },
  {
    key: "customerTitle", ar: "لقب العميل", en: "Customer title",
    tipAr: "استخدم اللقب المناسب (أستاذ/أستاذة/دكتور) عند مخاطبة العميل.", tipEn: "Use the appropriate title when addressing the customer.",
    failed: (r) => {
      const a = r.customerTitleAnalysis;
      if (!a || unknownName(a.titleDetected)) return undefined;
      return !a.isTitleUsedByAgent;
    },
    evidence: (r) => r.customerTitleAnalysis?.evaluation || "",
  },
  {
    key: "apology", ar: "الاعتذار عند اللزوم", en: "Apology when needed",
    tipAr: "اعتذر بوضوح عند التأخير أو عدم توفر الصنف أو أي إزعاج للعميل.", tipEn: "Apologise clearly for delays, stock-outs or inconvenience.",
    failed: (r) => (r.agentApologyAnalysis?.isApologyNeeded ? !r.agentApologyAnalysis.isApologyUsedByAgent : undefined),
    evidence: (r) => r.agentApologyAnalysis?.evaluation || "",
  },
  {
    key: "holdTime", ar: "الالتزام بقواعد الهولد", en: "Hold compliance",
    tipAr: "استأذن العميل قبل الهولد، وشغّل موسيقى الانتظار، ولا تتجاوز المدة المسموحة.", tipEn: "Ask permission before hold, play hold music and respect the time limit.",
    failed: (r) => {
      const h = r.holdTimeSummary;
      if (!h || !(h.holdCount > 0)) return undefined;
      return !h.isMusicCriterionCompliant || String(h.overallClassification || "").includes("بدون داعي");
    },
    evidence: (r) => r.holdTimeSummary?.auditNotes || "",
  },
  {
    key: "silence", ar: "الصمت غير المبرر", en: "Dead air",
    tipAr: "املأ فترات الصمت بعبارة مثل «لحظة من فضلك» بدل ترك الخط صامتاً.", tipEn: "Fill pauses with a short holding phrase instead of dead air.",
    failed: (r) => (r.agentSilenceSummary ? (r.agentSilenceSummary.silenceCount || 0) > 0 : undefined),
    evidence: (r) => `عدد فترات الصمت: ${r.agentSilenceSummary?.silenceCount ?? 0} — إجمالي ${r.agentSilenceSummary?.totalSilenceSeconds ?? 0} ثانية`,
  },
  {
    key: "furtherAssistance", ar: "عرض خدمات أخرى", en: "Further assistance",
    tipAr: "اختم بسؤال «تحب أساعدك في حاجة تانية؟» قبل إنهاء المكالمة.", tipEn: "Close by asking whether there is anything else you can help with.",
    failed: (r) => (r.furtherAssistanceAnalysis ? !r.furtherAssistanceAnalysis.isAssistanceOffered : undefined),
    evidence: (r) => r.furtherAssistanceAnalysis?.evaluation || "",
  },
  {
    key: "callEnding", ar: "عبارة إنهاء المكالمة", en: "Call ending phrase",
    tipAr: "استخدم عبارة الإنهاء المعتمدة وانتظر رد العميل قبل إغلاق الخط.", tipEn: "Use the approved closing phrase and wait for the customer's reply.",
    failed: (r) => (r.callEndingAnalysis ? !r.callEndingAnalysis.isEndingPhraseUsed : undefined),
    evidence: (r) => r.callEndingAnalysis?.evaluation || "",
  },
  {
    key: "unprofessionalWords", ar: "الألفاظ غير المهنية", en: "Unprofessional words",
    tipAr: "تجنّب العبارات العامية غير الرسمية واستبدلها بصيغ مهذبة معتمدة.", tipEn: "Avoid informal phrasing; use the approved polite alternatives.",
    failed: (r) => (r.unprofessionalWordsAnalysis ? Boolean(r.unprofessionalWordsAnalysis.hasUnprofessionalWords) : undefined),
    evidence: (r) => r.unprofessionalWordsAnalysis?.evaluation || "",
  },
  {
    key: "agentTone", ar: "نبرة الصوت", en: "Voice tone",
    tipAr: "حافظ على نبرة هادئة ومبتسمة وبطء مناسب في الحديث.", tipEn: "Keep a calm, smiling tone and a comfortable pace.",
    failed: (r) => {
      const s = r.agentToneAnalysis?.score;
      return s === undefined || s === null || !Number.isFinite(Number(s)) ? undefined : Number(s) < 6;
    },
    evidence: (r) => r.agentToneAnalysis?.smileEvaluation || "",
  },
];

export interface CriterionStat { key: CriterionKey; ar: string; en: string; applicable: number; failed: number; failRate: number }
export interface AgentStat {
  agent: string;
  calls: number;
  avgScore: number;
  lastAt: string;
  failures: Partial<Record<CriterionKey, number>>;
}
export interface DayStat { day: string; calls: number; avgScore: number }
export interface DashboardStats {
  totalCalls: number;
  avgScore: number;
  passRate: number;
  belowThreshold: number;
  avgDurationSec: number;
  complaints: number;
  withHold: number;
  byDay: DayStat[];
  agents: AgentStat[];
  criteria: CriterionStat[];
}

export const durationToSeconds = (d?: string): number => {
  const p = String(d || "0:00").split(":").map((x) => Number(x) || 0);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
};

const dayKey = (c: AnalyzedCallRecord): string => {
  const iso = c.savedAt || c.fullResult?.savedAt;
  const t = iso ? new Date(iso) : null;
  return t && !isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : "غير مؤرخ";
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeDashboardStats(calls: AnalyzedCallRecord[], passScore = 80): DashboardStats {
  const list = (calls || []).filter((c) => Number.isFinite(c.overallScore));
  const n = list.length;
  const empty: DashboardStats = { totalCalls: 0, avgScore: 0, passRate: 0, belowThreshold: 0, avgDurationSec: 0, complaints: 0, withHold: 0, byDay: [], agents: [], criteria: CRITERIA.map((c) => ({ key: c.key, ar: c.ar, en: c.en, applicable: 0, failed: 0, failRate: 0 })) };
  if (n === 0) return empty;

  const dayMap = new Map<string, { sum: number; n: number }>();
  const agentMap = new Map<string, { sum: number; n: number; last: string; failures: Partial<Record<CriterionKey, number>> }>();
  const crit = new Map<CriterionKey, { applicable: number; failed: number }>(CRITERIA.map((c) => [c.key, { applicable: 0, failed: 0 }]));

  for (const c of list) {
    const d = dayKey(c);
    const dm = dayMap.get(d) || { sum: 0, n: 0 };
    dm.sum += c.overallScore; dm.n++; dayMap.set(d, dm);

    const name = (c.agentName || "غير محدد").trim();
    const am = agentMap.get(name) || { sum: 0, n: 0, last: "", failures: {} };
    am.sum += c.overallScore; am.n++;
    const when = c.savedAt || c.fullResult?.savedAt || "";
    if (when > am.last) am.last = when;

    const r = c.fullResult;
    if (r) {
      for (const meta of CRITERIA) {
        const f = meta.failed(r);
        if (f === undefined) continue;
        const cs = crit.get(meta.key)!;
        cs.applicable++;
        if (f) { cs.failed++; am.failures[meta.key] = (am.failures[meta.key] || 0) + 1; }
      }
    }
    agentMap.set(name, am);
  }

  return {
    totalCalls: n,
    avgScore: round1(list.reduce((a, c) => a + c.overallScore, 0) / n),
    passRate: Math.round((list.filter((c) => c.overallScore >= passScore).length / n) * 100),
    belowThreshold: list.filter((c) => c.overallScore < passScore).length,
    avgDurationSec: Math.round(list.reduce((a, c) => a + durationToSeconds(c.duration), 0) / n),
    complaints: list.filter((c) => c.hasComplaint).length,
    withHold: list.filter((c) => c.hasHold).length,
    byDay: [...dayMap.entries()].map(([day, v]) => ({ day, calls: v.n, avgScore: round1(v.sum / v.n) })).sort((a, b) => a.day.localeCompare(b.day)),
    agents: [...agentMap.entries()]
      .map(([agent, v]) => ({ agent, calls: v.n, avgScore: round1(v.sum / v.n), lastAt: v.last, failures: v.failures }))
      .sort((a, b) => b.avgScore - a.avgScore || b.calls - a.calls),
    criteria: CRITERIA.map((c) => {
      const s = crit.get(c.key)!;
      return { key: c.key, ar: c.ar, en: c.en, applicable: s.applicable, failed: s.failed, failRate: s.applicable ? Math.round((s.failed / s.applicable) * 100) : 0 };
    }).sort((a, b) => b.failRate - a.failRate),
  };
}

export interface CoachingItem { key: CriterionKey; ar: string; en: string; failedCalls: number; ofCalls: number; tipAr: string; tipEn: string; evidence: string; evidenceCallDate?: string }

/** Deterministic coaching plan (no LLM): the agent's most frequent failures with evidence from their latest failing call. */
export function buildCoachingPlan(calls: AnalyzedCallRecord[], agent: string, max = 3): CoachingItem[] {
  const mine = (calls || []).filter((c) => (c.agentName || "غير محدد").trim() === agent && c.fullResult);
  const latestFirst = [...mine].sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
  const items: CoachingItem[] = [];
  for (const meta of CRITERIA) {
    let applicable = 0, failed = 0, evidence = "", date: string | undefined;
    for (const c of latestFirst) {
      const f = meta.failed(c.fullResult!);
      if (f === undefined) continue;
      applicable++;
      if (f) {
        failed++;
        if (!evidence) { evidence = meta.evidence(c.fullResult!); date = c.callDate; }
      }
    }
    if (failed > 0) items.push({ key: meta.key, ar: meta.ar, en: meta.en, failedCalls: failed, ofCalls: applicable, tipAr: meta.tipAr, tipEn: meta.tipEn, evidence, evidenceCallDate: date });
  }
  return items.sort((a, b) => b.failedCalls / b.ofCalls - a.failedCalls / a.ofCalls || b.failedCalls - a.failedCalls).slice(0, max);
}

/* ------------------------------ ROI calculator ------------------------------ */

export interface RoiInputs {
  callsPerMonth: number;
  avgCallMinutes: number;
  /** share of calls a human QA team can realistically review today (0-100) */
  manualSamplePct: number;
  analystMonthlyCost: number;
  /** productive hours per analyst per month */
  analystHours: number;
  costPerAutoCall: number;
}

export const DEFAULT_ROI: RoiInputs = { callsPerMonth: 3000, avgCallMinutes: 6, manualSamplePct: 2, analystMonthlyCost: 12000, analystHours: 130, costPerAutoCall: 3 };

export function computeRoi(i: RoiInputs) {
  // a manual review takes roughly 1.5x the call length (listening, pausing, filling a form) + 4 minutes of paperwork
  const manualMinutesPerCall = i.avgCallMinutes * 1.5 + 4;
  const hoursFor100 = (i.callsPerMonth * manualMinutesPerCall) / 60;
  const analystsFor100 = hoursFor100 / Math.max(1, i.analystHours);
  const manualCost100 = analystsFor100 * i.analystMonthlyCost;
  const currentSampleCalls = Math.round((i.callsPerMonth * i.manualSamplePct) / 100);
  const currentCost = ((currentSampleCalls * manualMinutesPerCall) / 60 / Math.max(1, i.analystHours)) * i.analystMonthlyCost;
  const autoCost = i.callsPerMonth * i.costPerAutoCall;
  return {
    manualMinutesPerCall: round1(manualMinutesPerCall),
    analystsFor100: round1(analystsFor100),
    manualCost100: Math.round(manualCost100),
    currentSampleCalls,
    currentCost: Math.round(currentCost),
    autoCost: Math.round(autoCost),
    savingsVs100: Math.round(manualCost100 - autoCost),
    coverageGain: Math.round(100 - i.manualSamplePct),
  };
}
