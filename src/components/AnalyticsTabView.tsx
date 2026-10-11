import React, { useMemo, useState } from "react";
import { BarChart3, Users, Target, TrendingUp, ArrowRight, Calculator, GraduationCap, AlertTriangle, PhoneCall, Clock, Upload } from "lucide-react";
import type { AnalyzedCallRecord } from "../types";
import type { Language } from "../utils/translations";
import { computeDashboardStats, buildCoachingPlan, computeRoi, DEFAULT_ROI, type RoiInputs } from "../utils/dashboardStats";

interface Props {
  calls: AnalyzedCallRecord[];
  language?: Language;
  onBackToHome: () => void;
  onGoToTranscription: () => void;
}

const DICT = {
  ar: {
    title: "تحليلات الأداء", subtitle: "نظرة شاملة على جودة المكالمات وأداء الزملاء بناءً على كل المكالمات المحللة",
    back: "الرئيسية", empty: "لا توجد مكالمات محللة بعد", emptyDesc: "حلّل مكالمة واحدة على الأقل لتظهر المؤشرات والرسوم هنا.", goUpload: "تفريغ مكالمة الآن",
    total: "المكالمات المحللة", avg: "متوسط الجودة", pass: "نسبة النجاح", below: "تحت الحد", passHint: "الحد", avgDur: "متوسط المدة", complaints: "مكالمات بشكاوى", holds: "مكالمات بهولد",
    trend: "اتجاه الجودة اليومي", trendOne: "يلزم يومان على الأقل من البيانات لعرض الاتجاه.", calls: "مكالمة",
    leaderboard: "ترتيب الزملاء", agent: "الزميل", callsCol: "المكالمات", scoreCol: "المتوسط", pick: "اضغط على زميل لعرض خطة التدريب",
    criteria: "أكثر البنود فشلاً", failedOf: "من", coaching: "خطة التدريب المقترحة", coachingFor: "للزميل", noFails: "لا توجد ملاحظات متكررة على هذا الزميل. أداء ممتاز.",
    evidence: "دليل من مكالمة", tip: "التوصية", failedIn: "فشل في",
    roi: "حاسبة العائد على الاستثمار", roiDesc: "افتراضات قابلة للتعديل — غيّر الأرقام لتطابق عميلك.",
    callsMonth: "مكالمات شهرياً", callMin: "متوسط المكالمة (دقيقة)", sample: "نسبة المراجعة اليدوية الحالية %", salary: "تكلفة محلل الجودة شهرياً", hours: "ساعات عمل المحلل شهرياً", perCall: "تكلفة المكالمة الآلية",
    r1: "محللون مطلوبون لمراجعة 100%", r2: "تكلفة المراجعة اليدوية الكاملة", r3: "تكلفة التحليل الآلي", r4: "الوفر الشهري", r5: "زيادة التغطية", currency: "ج.م",
    reviewMin: "دقيقة لمراجعة المكالمة الواحدة يدوياً", unit: "محلل",
  },
  en: {
    title: "Performance Analytics", subtitle: "A complete view of call quality and agent performance across all analysed calls",
    back: "Home", empty: "No analysed calls yet", emptyDesc: "Analyse at least one call to see indicators and charts here.", goUpload: "Transcribe a call now",
    total: "Analysed calls", avg: "Average quality", pass: "Pass rate", below: "Below threshold", passHint: "Threshold", avgDur: "Average duration", complaints: "Calls with complaints", holds: "Calls with hold",
    trend: "Daily quality trend", trendOne: "At least two days of data are needed to show a trend.", calls: "calls",
    leaderboard: "Agent leaderboard", agent: "Agent", callsCol: "Calls", scoreCol: "Average", pick: "Click an agent to see the coaching plan",
    criteria: "Most-failed criteria", failedOf: "of", coaching: "Suggested coaching plan", coachingFor: "for", noFails: "No recurring issues for this agent. Excellent performance.",
    evidence: "Evidence from call", tip: "Recommendation", failedIn: "Failed in",
    roi: "ROI calculator", roiDesc: "Editable assumptions — adjust the numbers to match your customer.",
    callsMonth: "Calls per month", callMin: "Average call (minutes)", sample: "Current manual review %", salary: "QA analyst monthly cost", hours: "Analyst hours per month", perCall: "Automated cost per call",
    r1: "Analysts needed for 100% review", r2: "Full manual review cost", r3: "Automated analysis cost", r4: "Monthly saving", r5: "Coverage gain", currency: "EGP",
    reviewMin: "minutes to review one call manually", unit: "analysts",
  },
} as const;

const PASS = 80;
const scoreColor = (s: number) => (s >= 85 ? "bg-emerald-500" : s >= PASS ? "bg-amber-500" : "bg-rose-500");
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const card = "bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 shadow-xs transition-colors";

export const AnalyticsTabView: React.FC<Props> = ({ calls, language = "ar", onBackToHome, onGoToTranscription }) => {
  const t = DICT[language === "en" ? "en" : "ar"];
  const en = language === "en";
  const stats = useMemo(() => computeDashboardStats(calls, PASS), [calls]);
  const [pickedAgent, setPickedAgent] = useState<string>("");
  const [roi, setRoi] = useState<RoiInputs>(DEFAULT_ROI);
  const agent = pickedAgent || stats.agents[0]?.agent || "";
  const plan = useMemo(() => (agent ? buildCoachingPlan(calls, agent) : []), [calls, agent]);
  const roiOut = useMemo(() => computeRoi(roi), [roi]);

  const Header = (
    <div className={`${card} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0"><BarChart3 className="w-6 h-6" /></div>
        <div>
          <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">{t.title}</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{t.subtitle}</p>
        </div>
      </div>
      <button type="button" onClick={onBackToHome} className="self-start sm:self-auto py-2 px-3.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
        <ArrowRight className={`w-3.5 h-3.5 ${en ? "rotate-180" : ""}`} /><span>{t.back}</span>
      </button>
    </div>
  );

  if (stats.totalCalls === 0) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-2" data-testid="analytics-empty">
        {Header}
        <div className={`${card} p-10 text-center space-y-3`}>
          <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{t.empty}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{t.emptyDesc}</p>
          <button type="button" onClick={onGoToTranscription} className="mt-2 py-2.5 px-4 bg-[#C25E38] hover:bg-[#A94E2C] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"><Upload className="w-4 h-4" />{t.goUpload}</button>
        </div>
      </div>
    );
  }

  const kpis = [
    { icon: PhoneCall, label: t.total, value: String(stats.totalCalls), tone: "text-stone-900 dark:text-stone-100" },
    { icon: Target, label: t.avg, value: `${stats.avgScore}%`, tone: stats.avgScore >= PASS ? "text-emerald-600" : "text-amber-600" },
    { icon: TrendingUp, label: `${t.pass} (≥${PASS}%)`, value: `${stats.passRate}%`, tone: "text-emerald-600" },
    { icon: AlertTriangle, label: t.below, value: String(stats.belowThreshold), tone: stats.belowThreshold ? "text-rose-600" : "text-stone-900 dark:text-stone-100" },
  ];

  const maxDay = Math.max(100, ...stats.byDay.map((d) => d.avgScore));
  const barW = 100 / Math.max(1, stats.byDay.length);

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2" data-testid="analytics-root">
      {Header}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} p-4 space-y-1`}>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 font-medium"><k.icon className="w-3.5 h-3.5 text-[#C25E38]" />{k.label}</div>
            <div className={`text-2xl font-black font-mono ${k.tone}`} data-testid={`kpi-${k.label}`}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[{ i: Clock, l: t.avgDur, v: fmtDur(stats.avgDurationSec) }, { i: AlertTriangle, l: t.complaints, v: String(stats.complaints) }, { i: PhoneCall, l: t.holds, v: String(stats.withHold) }].map((m) => (
          <div key={m.l} className={`${card} p-3`}><div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1"><m.i className="w-3 h-3" />{m.l}</div><div className="text-base font-black font-mono text-stone-900 dark:text-stone-100 mt-0.5">{m.v}</div></div>
        ))}
      </div>

      {/* Trend */}
      <div className={`${card} p-5 space-y-3`}>
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#C25E38]" />{t.trend}</h3>
        {stats.byDay.length < 2 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center">{t.trendOne}</p>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="w-full h-44 min-w-[420px]" role="img" aria-label={t.trend}>
              <line x1="0" x2="100" y1={40 - (PASS / maxDay) * 36} y2={40 - (PASS / maxDay) * 36} stroke="#C25E38" strokeDasharray="1.5 1.5" strokeWidth="0.3" opacity="0.6" />
              {stats.byDay.map((d, i) => {
                const h = (d.avgScore / maxDay) * 36;
                return <rect key={d.day} x={i * barW + barW * 0.18} y={40 - h} width={barW * 0.64} height={h} rx="0.8" className={d.avgScore >= PASS ? "fill-emerald-500" : "fill-rose-500"} opacity="0.85"><title>{`${d.day}: ${d.avgScore}% (${d.calls} ${t.calls})`}</title></rect>;
              })}
            </svg>
            <div className="flex justify-between text-[10px] font-mono text-stone-500 dark:text-stone-400 min-w-[420px]">
              {stats.byDay.map((d) => <span key={d.day}>{d.day.slice(5)}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className={`${card} p-5 space-y-3`}>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><Users className="w-4 h-4 text-[#C25E38]" />{t.leaderboard}</h3>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">{t.pick}</p>
          <ul className="space-y-2" data-testid="leaderboard">
            {stats.agents.map((a, i) => (
              <li key={a.agent}>
                <button type="button" onClick={() => setPickedAgent(a.agent)} className={`w-full text-start p-2.5 rounded-xl border transition-all cursor-pointer ${agent === a.agent ? "border-[#C25E38] bg-[#C25E38]/5" : "border-[#EAE3D9] dark:border-stone-800 hover:border-[#C25E38]/40"}`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-stone-900 dark:text-stone-100 truncate">{i + 1}. {a.agent}</span>
                    <span className="font-mono text-stone-500 dark:text-stone-400 shrink-0">{a.calls} {t.calls} • <b className="text-stone-900 dark:text-stone-100">{a.avgScore}%</b></span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden"><div className={`h-full ${scoreColor(a.avgScore)}`} style={{ width: `${Math.min(100, a.avgScore)}%` }} /></div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Criteria */}
        <div className={`${card} p-5 space-y-3`}>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#C25E38]" />{t.criteria}</h3>
          <ul className="space-y-2.5" data-testid="criteria-list">
            {stats.criteria.filter((c) => c.applicable > 0).map((c) => (
              <li key={c.key} className="text-xs">
                <div className="flex justify-between gap-2"><span className="font-bold text-stone-800 dark:text-stone-200">{en ? c.en : c.ar}</span><span className="font-mono text-stone-500 dark:text-stone-400">{c.failed} {t.failedOf} {c.applicable} • {c.failRate}%</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden"><div className={`h-full ${c.failRate >= 50 ? "bg-rose-500" : c.failRate >= 25 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${c.failRate}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Coaching */}
      <div className={`${card} p-5 space-y-3`} data-testid="coaching">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#C25E38]" />{t.coaching} <span className="text-stone-500 dark:text-stone-400 font-medium">{t.coachingFor} {agent}</span></h3>
        {plan.length === 0 ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">{t.noFails}</p>
        ) : (
          <ol className="space-y-3">
            {plan.map((p, i) => (
              <li key={p.key} className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900/50 border border-[#EAE3D9] dark:border-stone-800 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2"><b className="text-stone-900 dark:text-stone-100">{i + 1}. {en ? p.en : p.ar}</b><span className="font-mono text-rose-600">{t.failedIn} {p.failedCalls}/{p.ofCalls}</span></div>
                <p className="text-stone-700 dark:text-stone-300"><b>{t.tip}:</b> {en ? p.tipEn : p.tipAr}</p>
                {p.evidence && <p className="text-stone-500 dark:text-stone-400 leading-relaxed"><b>{t.evidence} {p.evidenceCallDate}:</b> {p.evidence}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ROI */}
      <div className={`${card} p-5 space-y-4`} data-testid="roi">
        <div>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><Calculator className="w-4 h-4 text-[#C25E38]" />{t.roi}</h3>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">{t.roiDesc}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {([["callsPerMonth", t.callsMonth], ["avgCallMinutes", t.callMin], ["manualSamplePct", t.sample], ["analystMonthlyCost", t.salary], ["analystHours", t.hours], ["costPerAutoCall", t.perCall]] as [keyof RoiInputs, string][]).map(([k, label]) => (
            <label key={k} className="text-[11px] font-bold text-stone-600 dark:text-stone-300 space-y-1">
              {label}
              <input type="number" min={0} value={roi[k]} onChange={(e) => setRoi({ ...roi, [k]: Math.max(0, Number(e.target.value) || 0) })} className="w-full py-2 px-2.5 rounded-lg border border-[#EAE3D9] dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-900 text-sm font-mono text-stone-900 dark:text-stone-100 outline-none focus:border-[#C25E38]" />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-center">
          {[
            { l: t.r1, v: `${roiOut.analystsFor100} ${t.unit}` },
            { l: t.r2, v: `${roiOut.manualCost100.toLocaleString()} ${t.currency}` },
            { l: t.r3, v: `${roiOut.autoCost.toLocaleString()} ${t.currency}` },
            { l: t.r4, v: `${roiOut.savingsVs100.toLocaleString()} ${t.currency}`, strong: true },
            { l: t.r5, v: `+${roiOut.coverageGain}%` },
          ].map((m) => (
            <div key={m.l} className={`p-3 rounded-xl border ${m.strong ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40" : "bg-[#FAF8F5] dark:bg-stone-900/50 border-[#EAE3D9] dark:border-stone-800"}`}>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">{m.l}</div>
              <div className={`text-sm font-black font-mono mt-1 ${m.strong ? "text-emerald-700 dark:text-emerald-400" : "text-stone-900 dark:text-stone-100"}`} data-testid={m.strong ? "roi-savings" : undefined}>{m.v}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-stone-500 dark:text-stone-400">≈ {roiOut.manualMinutesPerCall} {t.reviewMin}</p>
      </div>
    </div>
  );
};
