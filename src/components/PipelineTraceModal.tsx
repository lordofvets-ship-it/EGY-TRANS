import React from "react";
import { CheckCircle2, ShieldCheck, Cpu, X, Layers, Sparkles, Hash, MinusCircle, XCircle, Clock } from "lucide-react";
import { PipelineStageInfo, TranscriptionResponse } from "../types";

interface PipelineTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TranscriptionResponse | null;
  language?: "ar" | "en";
}

const STATUS_UI: Record<string, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  completed: { label: "مكتمل", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50", Icon: CheckCircle2 },
  skipped: { label: "تم تخطّيها", cls: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700", Icon: MinusCircle },
  failed: { label: "فشلت", cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50", Icon: XCircle },
  in_progress: { label: "قيد التنفيذ", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50", Icon: Clock },
};

export const PipelineTraceModal: React.FC<PipelineTraceModalProps> = ({
  isOpen,
  onClose,
  result,
  language = "ar",
}) => {
  if (!isOpen) return null;

  // Only the trace recorded for this very analysis is shown — no invented default stages.
  const stages: PipelineStageInfo[] = result?.pipelineStages ?? [];
  const counts = {
    completed: stages.filter((s) => s.status === "completed").length,
    skipped: stages.filter((s) => s.status === "skipped").length,
    failed: stages.filter((s) => s.status === "failed").length,
  };

  const reviewMeta = result?.pipelineReviewMeta;
  const audioHash = result?.audioHash;
  const isCacheHit = Boolean(result?.cacheHit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C25E38]/10 text-[#C25E38] dark:bg-[#C25E38]/20 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-stone-900 dark:text-white">
                  مسار المعالجة الصوتي الموحد (Unified Pipeline)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/30">
                  15 مرحلة متكاملة
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                نظام تشغيلي متكامل يمنح كل مكتبة ومهارة تخصصاً حصرياً لمنع العشوائية وتحقيق أعلى درجات الدقة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="px-5 py-3 bg-stone-100/70 dark:bg-stone-900/90 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              منع العشوائية: Temperature = 0.0 + Prompts ثابتة
            </span>
            {reviewMeta && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                المراجعات: {reviewMeta.reviewCount} مراجعات (توافق: {reviewMeta.agreementScore}%)
              </span>
            )}
            {audioHash && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 font-mono text-[11px]">
                <Hash className="w-3 h-3" />
                SHA-256: {audioHash.slice(0, 10)}... {isCacheHit ? "⚡ كاش فوري" : "💾 محفوظ"}
              </span>
            )}
          </div>
          <span className="text-stone-500 dark:text-stone-400 font-medium" data-testid="trace-summary">
            {stages.length > 0
              ? `${counts.completed} مرحلة نُفّذت • ${counts.skipped} تم تخطّيها • ${counts.failed} فشلت`
              : "لا يوجد مسار مسجّل"}
          </span>
        </div>

        {/* Pipeline Stages List */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {stages.length === 0 && (
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300" data-testid="trace-empty">
              هذه المكالمة حُلّلت بإصدار سابق ولا تحمل مساراً فعلياً مسجّلاً. أعد رفع نفس التسجيل لإنتاج مسار دقيق.
            </div>
          )}
          {stages.map((st) => (
            <div
              key={st.step}
              className="flex items-start gap-3.5 p-3 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-[#C25E38]/40 transition-all shadow-xs"
            >
              {/* Step Badge */}
              <div className="w-7 h-7 rounded-lg bg-[#C25E38]/10 text-[#C25E38] font-bold text-xs flex items-center justify-center shrink-0 border border-[#C25E38]/20 mt-0.5">
                {st.step}
              </div>

              {/* Stage Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-stone-900 dark:text-white">
                      {st.nameArabic}
                    </h4>
                    <span className="text-[11px] font-mono text-stone-400 dark:text-stone-500">
                      ({st.name})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-[#C25E38]" />
                      {st.tool}
                    </span>
                    {(() => {
                      const ui = STATUS_UI[st.status] || STATUS_UI.completed;
                      return (
                        <span data-testid={`stage-status-${st.step}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${ui.cls}`}>
                          <ui.Icon className="w-3 h-3" />
                          {ui.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {st.details && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                    {st.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-950/50">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            الهدف الأساسي: <strong className="text-stone-700 dark:text-stone-300">ACCURACY + CONSISTENCY + RELIABILITY</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
