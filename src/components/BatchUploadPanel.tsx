import React, { useCallback, useMemo, useRef, useState } from "react";
import { Layers, Upload, Play, Square, RotateCcw, Trash2, CheckCircle2, AlertTriangle, Loader2, Clock, ChevronDown, Zap } from "lucide-react";
import type { Language } from "../utils/translations";
import { addFiles, runBatch, summarize, type BatchItem } from "../utils/batchQueue";
import { transcribeFile } from "../utils/transcribeClient";
import { buildAnalyzedCallRecord } from "../utils/callRecordBuilder";

interface Props {
  processingMode: string;
  language?: Language;
  /** test seam */
  transcribe?: typeof transcribeFile;
}

const T = {
  ar: {
    title: "رفع دفعي لعدة مكالمات", subtitle: "حلّل عشرات المكالمات تباعاً وتظهر تلقائياً في التقارير وتحليلات الأداء",
    pick: "اختر ملفات صوتية أو اسحبها هنا", pickHint: "يمكن اختيار عدة ملفات دفعة واحدة", speed: "عدد المكالمات المتوازية",
    start: "بدء التحليل", stop: "إيقاف", retry: "إعادة محاولة الفاشلة", clear: "مسح المنتهي", skipped: "تم تجاهل ملفات مكررة:",
    queued: "في الانتظار", analyzing: "قيد التحليل", done: "تم", failed: "فشل", cancelled: "أُلغي", cached: "من الكاش",
    summary: "اكتمل", of: "من", avg: "متوسط الجودة", score: "الدرجة", agent: "الزميل", stopNote: "الإيقاف يمنع بدء مكالمات جديدة؛ التحليل الجاري في الخادم يكتمل ويُحفظ.",
  },
  en: {
    title: "Batch upload", subtitle: "Analyse many calls in sequence; they appear automatically in reports and analytics",
    pick: "Choose audio files or drop them here", pickHint: "You can select several files at once", speed: "Parallel calls",
    start: "Start analysis", stop: "Stop", retry: "Retry failed", clear: "Clear finished", skipped: "Duplicate files ignored:",
    queued: "Queued", analyzing: "Analysing", done: "Done", failed: "Failed", cancelled: "Cancelled", cached: "cached",
    summary: "Finished", of: "of", avg: "Average quality", score: "Score", agent: "Agent", stopNote: "Stopping prevents new calls from starting; an analysis already running on the server completes and is saved.",
  },
} as const;

const scoreOf = (r: any): number | undefined => {
  try { const v = buildAnalyzedCallRecord(r).overallScore; return Number.isFinite(v) ? v : undefined; } catch { return undefined; }
};
const agentOf = (r: any): string => { try { return buildAnalyzedCallRecord(r).agentName || ""; } catch { return ""; } };
const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const BatchUploadPanel: React.FC<Props> = ({ processingMode, language = "ar", transcribe = transcribeFile }) => {
  const t = T[language === "en" ? "en" : "ar"];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const [skipped, setSkipped] = useState(0);
  const [drag, setDrag] = useState(false);
  const itemsRef = useRef<BatchItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = useCallback((next: BatchItem[]) => { itemsRef.current = next; setItems(next); }, []);

  const onFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list || []).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|webm|aac)$/i.test(f.name));
    if (!files.length) return;
    const { items: next, skipped: sk } = addFiles(itemsRef.current, files);
    setSkipped(sk);
    commit(next);
    setOpen(true);
  };

  const start = async () => {
    if (running) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    const working = itemsRef.current.map((i) => ({ ...i }));
    commit(working.map((i) => ({ ...i })));
    try {
      await runBatch(working, {
        concurrency,
        signal: ctrl.signal,
        onUpdate: (u) => {
          commit(itemsRef.current.map((p) => (p.id === u.id ? u : p)));
          if (u.status === "done") window.dispatchEvent(new Event("qa-calls-changed"));
        },
        run: async (item, signal) => {
          const result = await transcribe(item.file, { processingMode, signal });
          return { result, cached: Boolean(result?.cacheHit) };
        },
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const retryFailed = () => {
    commit(itemsRef.current.map((i) => (i.status === "failed" || i.status === "cancelled" ? { ...i, status: "queued" as const, error: undefined } : i)));
    setTimeout(start, 0);
  };
  const clearFinished = () => commit(itemsRef.current.filter((i) => i.status === "queued" || i.status === "analyzing"));

  const sum = useMemo(() => summarize(items, scoreOf), [items]);
  const pct = sum.total ? Math.round((sum.finished / sum.total) * 100) : 0;
  const hasQueued = items.some((i) => i.status === "queued");
  const hasRetry = items.some((i) => i.status === "failed" || i.status === "cancelled");

  const badge = (i: BatchItem) => {
    const m: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
      queued: { cls: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700", icon: <Clock className="w-3 h-3" />, label: t.queued },
      analyzing: { cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50", icon: <Loader2 className="w-3 h-3 animate-spin" />, label: t.analyzing },
      done: { cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50", icon: <CheckCircle2 className="w-3 h-3" />, label: t.done },
      failed: { cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50", icon: <AlertTriangle className="w-3 h-3" />, label: t.failed },
      cancelled: { cls: "bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200 dark:border-stone-700", icon: <Square className="w-3 h-3" />, label: t.cancelled },
    };
    const x = m[i.status];
    return <span data-testid={`batch-status-${i.name}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${x.cls}`}>{x.icon}{x.label}</span>;
  };

  return (
    <section className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 shadow-xs transition-colors" data-testid="batch-panel" aria-label={t.title}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full p-4 flex items-center justify-between gap-3 text-start cursor-pointer">
        <span className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center"><Layers className="w-5 h-5" /></span>
          <span>
            <span className="block text-sm font-black text-stone-900 dark:text-stone-100">{t.title}</span>
            <span className="block text-[11px] text-stone-500 dark:text-stone-400">{t.subtitle}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {items.length > 0 && <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20">{sum.finished}/{sum.total}</span>}
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-4 border-t border-[#EAE3D9] dark:border-stone-800">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer?.files || null); }}
            onClick={() => inputRef.current?.click()}
            className={`mt-4 p-5 rounded-xl border-2 border-dashed flex flex-col items-center gap-1 cursor-pointer transition-all ${drag ? "border-[#C25E38] bg-[#C25E38]/5" : "border-[#EAE3D9] dark:border-stone-700 hover:border-[#C25E38]/40 bg-[#FAF8F5]/60 dark:bg-stone-900/40"}`}
          >
            <Upload className="w-5 h-5 text-stone-500 dark:text-stone-400" />
            <span className="text-xs font-bold text-stone-800 dark:text-stone-100">{t.pick}</span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">{t.pickHint}</span>
            <input ref={inputRef} data-testid="batch-input" type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {skipped > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-400" data-testid="batch-skipped">{t.skipped} {skipped}</p>}

          {items.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={start} disabled={running || !hasQueued} className="py-2 px-3.5 bg-[#C25E38] hover:bg-[#A94E2C] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Play className="w-3.5 h-3.5" />{t.start}</button>
                <button type="button" onClick={stop} disabled={!running} className="py-2 px-3.5 bg-stone-100 dark:bg-stone-800 disabled:opacity-50 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Square className="w-3.5 h-3.5" />{t.stop}</button>
                <button type="button" onClick={retryFailed} disabled={running || !hasRetry} className="py-2 px-3.5 bg-stone-100 dark:bg-stone-800 disabled:opacity-50 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />{t.retry}</button>
                <button type="button" onClick={clearFinished} disabled={running} className="py-2 px-3.5 bg-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Trash2 className="w-3.5 h-3.5" />{t.clear}</button>
                <label className="ms-auto flex items-center gap-2 text-[11px] font-bold text-stone-600 dark:text-stone-300">
                  {t.speed}
                  <select value={concurrency} disabled={running} onChange={(e) => setConcurrency(Number(e.target.value))} aria-label={t.speed} className="py-1 px-2 rounded-lg border border-[#EAE3D9] dark:border-stone-700 bg-white dark:bg-stone-900 text-xs">
                    {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300 mb-1.5" data-testid="batch-summary">
                  <span>{t.summary} {sum.finished} {t.of} {sum.total} • ✓ {sum.done} • ✗ {sum.failed}{sum.cached ? ` • ⚡ ${sum.cached} ${t.cached}` : ""}</span>
                  {sum.avgScore !== undefined && <span className="font-mono font-bold">{t.avg}: {sum.avgScore}%</span>}
                </div>
                <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-[#C25E38] transition-all" style={{ width: `${pct}%` }} />
                </div>
                {running && <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5">{t.stopNote}</p>}
              </div>

              <ul className="space-y-2 max-h-80 overflow-y-auto" data-testid="batch-list">
                {items.map((i) => {
                  const sc = i.status === "done" ? scoreOf(i.result) : undefined;
                  return (
                    <li key={i.id} className="p-2.5 rounded-xl border border-[#EAE3D9] dark:border-stone-800 bg-[#FAF8F5]/60 dark:bg-stone-900/40 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-stone-900 dark:text-stone-100 truncate" dir="ltr">{i.name}</span>
                        <span className="flex items-center gap-2 shrink-0"><span className="font-mono text-[10px] text-stone-500">{fmtSize(i.size)}</span>{badge(i)}</span>
                      </div>
                      {i.status === "done" && (
                        <div className="text-[11px] text-stone-600 dark:text-stone-300 flex items-center gap-3">
                          {sc !== undefined && <span>{t.score}: <b className="font-mono">{sc}%</b></span>}
                          {agentOf(i.result) && <span>{t.agent}: <b>{agentOf(i.result)}</b></span>}
                          {i.cached && <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400"><Zap className="w-3 h-3" />{t.cached}</span>}
                        </div>
                      )}
                      {i.status === "failed" && <p className="text-[11px] text-rose-700 dark:text-rose-400">{i.error}</p>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
};
