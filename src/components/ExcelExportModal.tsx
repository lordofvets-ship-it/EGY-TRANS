import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  Download, 
  X, 
  CheckCircle2, 
  Layers, 
  FileText, 
  Clock, 
  Stethoscope, 
  Receipt, 
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TranscriptionResponse, MeasurementItemId } from "../types";
import { exportEvaluationToExcel } from "../utils/exportToExcel";

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TranscriptionResponse | null;
  isMeasurementVisible?: (id: MeasurementItemId) => boolean;
}

type SheetTab = "summary" | "silence" | "medical" | "receipt" | "transcript";

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  result,
  isMeasurementVisible
}) => {
  const [activeTab, setActiveTab] = useState<SheetTab>("summary");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen || !result) return null;

  const handleDownload = () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const callDate = new Date().toISOString().slice(0, 10);
      const filename = `QA_Evaluation_Report_${callDate}.xlsx`;
      exportEvaluationToExcel(result, filename, isMeasurementVisible);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error("Error triggering Excel download:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const sheetsMeta = [
    {
      id: "summary" as SheetTab,
      label: "ملخص التقييم العام",
      icon: FileSpreadsheet,
      desc: "درجات الـ KPI ونبرة الصوت والهولد والتوصيات الشاملة",
      badge: "الرئيسي"
    },
    {
      id: "silence" as SheetTab,
      label: "فترات الصمت والهولد",
      icon: Clock,
      desc: "جدول فترات الصمت وDead Air ومبررات الهولد واستئذان العميل",
      badge: `${(result.agentSilenceSummary?.silenceSegments?.length || 0) + (result.holdTimeSummary?.holdSegments?.length || 0)} فترة`
    },
    {
      id: "medical" as SheetTab,
      label: "الاستشارة والمعرفة العلمية",
      icon: Stethoscope,
      desc: "خطوات الاستشارة الطبية الـ 8 وتدقيق Medscape للأصناف والتداخلات",
      badge: result.medicalConsultationAnalysis?.isMedicalConsultationPresent ? "استشارة مفعلة" : "معرفة عامة"
    },
    {
      id: "receipt" as SheetTab,
      label: "تدقيق الريسيت وموافقة العميل",
      icon: Receipt,
      desc: "مطابقة أصناف الفاتورة وتوثيق استئذان العميل",
      badge: result.receiptAudit ? `${result.receiptAudit.fulfillmentRatePercentage}% توفير` : "غير مرفوع"
    },
    {
      id: "transcript" as SheetTab,
      label: "تفريغ المكالمة بالكامل",
      icon: FileText,
      desc: "سجل الحوار الصوتي الكامل مع التوقيت والمتحدث بالعامية المصرية",
      badge: `${result.transcript?.length || 0} مقطع`
    }
  ];

  return (
    <AnimatePresence>
      <div 
        id="excel-export-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          id="excel-export-modal-container"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="w-full max-w-5xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  تصدير تقرير التقييم إلى إكسيل (Excel Export)
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                    .XLSX متعدد الأوراق
                  </span>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  توليد ملف إكسيل احترافي يتضمن 5 أوراق عمل مفصلة لكافة مؤشرات الجودة، الصمت، الهولد، الاستشارة الطبية، وتدقيق الريسيت.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-trigger-excel-download"
                onClick={handleDownload}
                disabled={isExporting}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? "جارٍ التوليد..." : "تحميل ملف Excel الآن"}</span>
              </button>
              <button
                id="btn-close-excel-modal"
                onClick={onClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {exportSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-950/70 border-b border-emerald-800 px-5 py-3 flex items-center justify-between text-emerald-200 text-xs font-semibold"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم تجهيز وبدء تحميل ملف الإكسيل الشامل بنجاح إلى جهازك!</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">SheetJS • 5 Sheets Ready</span>
            </motion.div>
          )}

          {/* Sheet Selector Tabs */}
          <div className="px-4 pt-3 border-b border-neutral-800 bg-neutral-950 flex items-center gap-2 overflow-x-auto scrollbar-thin">
            {sheetsMeta.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-excel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2.5 px-3.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-t border-x shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-neutral-900 text-emerald-400 border-neutral-700 border-b-2 border-b-emerald-500 shadow-sm"
                      : "bg-neutral-950/40 text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-neutral-900/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-neutral-500"}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-400"
                  }`}>
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Modal Tab Content Area */}
          <div className="p-5 overflow-y-auto flex-1 bg-neutral-950 text-neutral-300 text-xs space-y-4">
            
            {/* TAB 1: SUMMARY PREVIEW */}
            {activeTab === "summary" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      معاينة ورقة العمل 1: ملخص التقييم العام (Executive QA Summary)
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      تحتوي على جدول قياسي متكامل لكافة المعايير الـ 15 وملاحظات الجودة ودرجات التقييم.
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير هذا التقرير كـ Excel</span>
                  </button>
                </div>

                <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/30">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-300 font-bold text-xs">
                        <th className="p-3 w-1/4">معيار التقييم (KPI)</th>
                        <th className="p-3 w-1/4">النتيجة / الحالة</th>
                        <th className="p-3 w-1/3">التقييم الفني والملاحظات</th>
                        <th className="p-3">الإحصائية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {(!isMeasurementVisible || isMeasurementVisible("greeting")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">1. الترحيب بالمقدمة</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.greetingAnalysis?.isGreetingUsed ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {result.greetingAnalysis?.isGreetingUsed ? "مستوفى" : "غير مستوفى"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.greetingAnalysis?.evaluation || "-"}</td>
                          <td className="p-3 font-mono text-neutral-300">
                            {result.greetingAnalysis?.agentStartSecond ? `بداية الزميل: ${result.greetingAnalysis.agentStartSecond}` : (result.greetingAnalysis?.detectedGreetingPhrases?.join(", ") || "-")}
                          </td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("agentTone")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">2. نبرة الصوت والابتسامة</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.agentToneAnalysis?.hasSmile ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                            }`}>
                              {result.agentToneAnalysis?.hasSmile ? "بها ابتسامة" : "ينقصها الابتسامة"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.agentToneAnalysis?.smileEvaluation || "-"}</td>
                          <td className="p-3 font-mono text-emerald-400 font-bold">{result.agentToneAnalysis?.score ?? "-"}/10</td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("customerName")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">3. ذكر اسم العميل</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.customerNameAnalysis?.isMentionedByAgent ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-400"
                            }`}>
                              {result.customerNameAnalysis?.isMentionedByAgent ? "تم ذكره" : "لم يُذكر"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.customerNameAnalysis?.customerNameDetected ? `اسم العميل: ${result.customerNameAnalysis.customerNameDetected}` : "لم يُذكر اسم"}</td>
                          <td className="p-3 font-mono text-neutral-300">{result.customerNameAnalysis?.mentionCount || 0} مرات</td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("empathy")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">4. التعاطف والدعم</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.empathyAnalysis?.isEmpathyUsed ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {result.empathyAnalysis?.isEmpathyUsed ? "مستوفى" : "لم يتم التعاطف"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.empathyAnalysis?.evaluation || "-"}</td>
                          <td className="p-3 font-mono text-neutral-300">{result.empathyAnalysis?.detectedEmpathyPhrases?.join(", ") || "-"}</td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("furtherAssistance")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">5. تقديم المساعدة الإضافية</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.furtherAssistanceAnalysis?.isAssistanceOffered ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {result.furtherAssistanceAnalysis?.isAssistanceOffered ? "تم العرض" : "لم يتم العرض"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.furtherAssistanceAnalysis?.evaluation || "-"}</td>
                          <td className="p-3 font-mono text-neutral-300">{result.furtherAssistanceAnalysis?.detectedAssistancePhrases?.join(", ") || "-"}</td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("callEnding")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">6. إنهاء المكالمة والوداع</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.callEndingAnalysis?.isEndingPhraseUsed ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {result.callEndingAnalysis?.isEndingPhraseUsed ? "مستوفى" : "غير مستوفى"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.callEndingAnalysis?.evaluation || "-"}</td>
                          <td className="p-3 font-mono text-neutral-300">
                            {result.callEndingAnalysis?.remainingTimeBeforeEnd ? `المتبقي: ${result.callEndingAnalysis.remainingTimeBeforeEnd}` : (result.callEndingAnalysis?.detectedEndingPhrases?.join(", ") || "-")}
                          </td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("silence")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">6. فترات صمت الموظف (Dead Air)</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-800 text-neutral-300 font-mono">
                              {result.agentSilenceSummary?.silenceRatio || 0}% صمت
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">إجمالي مدة الصمت {result.agentSilenceSummary?.totalSilenceSeconds || 0} ثانية</td>
                          <td className="p-3 font-mono text-neutral-300">{result.agentSilenceSummary?.silenceCount || 0} فترات</td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("holdTime")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">7. معيار الهولد والانتظار (مرتبط بوجود موسيقى)</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.holdTimeSummary?.holdCount === 0 
                                ? "bg-neutral-800 text-neutral-300"
                                : result.holdTimeSummary?.unjustifiedHoldCount === 0
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {result.holdTimeSummary?.overallClassification || "بدون هولد"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.holdTimeSummary?.auditNotes || "تدقيق شروط الاستئذان والشكر"}</td>
                          <td className="p-3 font-mono text-neutral-300">{result.holdTimeSummary?.holdCount || 0} مرات هولد</td>
                        </tr>
                      )}

                      {(!isMeasurementVisible || isMeasurementVisible("unprofessionalWords")) && (
                        <tr className="hover:bg-neutral-900/40">
                          <td className="p-3 font-semibold text-white">8. الألفاظ غير الاحترافية</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.unprofessionalWordsAnalysis?.hasUnprofessionalWords ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {result.unprofessionalWordsAnalysis?.hasUnprofessionalWords ? `تم رصد (${result.unprofessionalWordsAnalysis.totalUnprofessionalWordsCount})` : "خالٍ من الألفاظ"}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400">{result.unprofessionalWordsAnalysis?.evaluation || "تدقيق الكلمات والألفاظ الدارجة"}</td>
                          <td className="p-3 font-mono text-neutral-300">
                            {result.unprofessionalWordsAnalysis?.detectedWords?.length 
                              ? result.unprofessionalWordsAnalysis.detectedWords.map(w => `${w.word} (${w.count})`).join(", ")
                              : "لا توجد ألفاظ غير احترافية"}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-neutral-900/40">
                        <td className="p-3 font-semibold text-white">9. تدقيق ريسيت الفاتورة</td>
                        <td className="p-3">
                          {result.receiptAudit ? (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              result.receiptAudit.isFullyCompliant ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {result.receiptAudit.fulfillmentRatePercentage}% توفير
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-neutral-800 text-neutral-400">لم يُرفع بعد</span>
                          )}
                        </td>
                        <td className="p-3 text-neutral-400">{result.receiptAudit?.auditSummary || "التحقق من موافقة العميل على البدائل"}</td>
                        <td className="p-3 font-mono text-neutral-300">
                          {result.receiptAudit ? `مطلوب: ${result.receiptAudit.totalRequestedItemsCount} | متوفر: ${result.receiptAudit.fulfilledItemsCount}` : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: SILENCE & HOLD PREVIEW */}
            {activeTab === "silence" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    معاينة ورقة العمل 2: فترات الصمت والهولد
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    توثيق كامل لكل فترة هولد أو صمت مع التوقيت والسبب والتأكد من استئذان العميل وشكره بعد العودة.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    فترات صمت الموظف (Dead Air):
                  </h4>
                  <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/30">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-300 font-bold text-xs">
                          <th className="p-2.5">م</th>
                          <th className="p-2.5">البداية</th>
                          <th className="p-2.5">النهاية</th>
                          <th className="p-2.5">المدة</th>
                          <th className="p-2.5">الوصف والسبب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 text-xs font-mono">
                        {result.agentSilenceSummary?.silenceSegments && result.agentSilenceSummary.silenceSegments.length > 0 ? (
                          result.agentSilenceSummary.silenceSegments.map((seg, i) => (
                            <tr key={i} className="hover:bg-neutral-900/40">
                              <td className="p-2.5 text-neutral-400 font-sans">{i + 1}</td>
                              <td className="p-2.5 text-rose-400">{seg.timeStart}</td>
                              <td className="p-2.5 text-rose-400">{seg.timeEnd}</td>
                              <td className="p-2.5 font-bold text-white">{seg.duration} ثانية</td>
                              <td className="p-2.5 font-sans text-neutral-300">{seg.description}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-4 text-center font-sans text-neutral-500">لا توجد فترات صمت ملحوظة بالمكالمة</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-bold text-xs text-neutral-300 flex items-center gap-1.5 mt-4">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    فترات الهولد والانتظار - معيار الهولد مرتبط بوجود موسيقى (Hold Time):
                  </h4>
                  <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/30">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-300 font-bold text-xs">
                          <th className="p-2.5">م</th>
                          <th className="p-2.5">البداية - النهاية</th>
                          <th className="p-2.5">المدة</th>
                          <th className="p-2.5">التصنيف</th>
                          <th className="p-2.5">الاستئذان والموافقة</th>
                          <th className="p-2.5">الشكر بعد العودة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 text-xs">
                        {result.holdTimeSummary?.holdSegments && result.holdTimeSummary.holdSegments.length > 0 ? (
                          result.holdTimeSummary.holdSegments.map((h, i) => (
                            <tr key={i} className="hover:bg-neutral-900/40">
                              <td className="p-2.5 text-neutral-400">{i + 1}</td>
                              <td className="p-2.5 font-mono text-amber-300">{h.timeStart} - {h.timeEnd}</td>
                              <td className="p-2.5 font-bold text-white font-mono">{h.duration} ث</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  h.classification === "بداعي" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                                }`}>
                                  {h.classification || "بداعي"}
                                </span>
                              </td>
                              <td className="p-2.5 text-neutral-300">
                                {h.holdPhraseSnippet ? `✓ استأذن: "${h.holdPhraseSnippet}"` : "✗ لم يستأذن صراحة"}
                              </td>
                              <td className="p-2.5 text-neutral-300">
                                {h.thankingSnippet ? `✓ شكر: "${h.thankingSnippet}"` : (h.didThankAfterHold ? "✓ شكر" : "✗ لم يشكر")}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-neutral-500">لم يخرج الموظف في أي فترة هولد</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MEDICAL & SCIENCE PREVIEW */}
            {activeTab === "medical" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-emerald-400" />
                    معاينة ورقة العمل 3: بروتوكول الاستشارة الطبية والتدقيق العلمي (Medscape)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    التحقق من الخطوات الـ 8 الإلزامية في حال الاستشارات وتدقيق المواد الفعالة والبدائل والمثائل والتداخلات الدوائية.
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/30">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-300 font-bold text-xs">
                        <th className="p-2.5">م</th>
                        <th className="p-2.5">الخطوة الإلزامية</th>
                        <th className="p-2.5">السؤال المعياري</th>
                        <th className="p-2.5">الالتزام</th>
                        <th className="p-2.5">العبارة المنطوقة والتوقيت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {result.medicalConsultationAnalysis?.steps && result.medicalConsultationAnalysis.steps.length > 0 ? (
                        result.medicalConsultationAnalysis.steps.map((st, i) => (
                          <tr key={i} className="hover:bg-neutral-900/40">
                            <td className="p-2.5 text-neutral-400">{i + 1}</td>
                            <td className="p-2.5 font-bold text-white">{st.stepTitle}</td>
                            <td className="p-2.5 text-neutral-400">{st.standardQuestion}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                st.wasAsked ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                              }`}>
                                {st.wasAsked ? "نعم ✓" : "لا ✗"}
                              </span>
                            </td>
                            <td className="p-2.5 text-neutral-300 font-mono">
                              {st.questionSnippet ? `"${st.questionSnippet}" (${st.timestamp || ""})` : "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-neutral-500">لا توجد استشارة طبية مسجلة لهذه المكالمة</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: RECEIPT AUDIT PREVIEW */}
            {activeTab === "receipt" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-teal-400" />
                      معاينة ورقة العمل 4: مطابقة ريسيت الفاتورة واستئذان العميل
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      جدول الأصناف المقارنة بين طلب العميل والفاتورة وحالة الموافقة ونصوص الاستئذان المقتبسة.
                    </p>
                  </div>
                  {result.receiptAudit && (
                    <div className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 text-xs font-bold font-mono shrink-0">
                      نسبة التوفير المعتمد: {result.receiptAudit.fulfillmentRatePercentage}%
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/30">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-300 font-bold text-xs">
                        <th className="p-2.5">م</th>
                        <th className="p-2.5">الصنف المطلوب</th>
                        <th className="p-2.5">الصنف بالفاتورة</th>
                        <th className="p-2.5">حالة التوفير</th>
                        <th className="p-2.5">موافقة العميل الصريحة</th>
                        <th className="p-2.5">ملاحظات التدقيق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-xs">
                      {result.receiptAudit?.itemsAudit && result.receiptAudit.itemsAudit.length > 0 ? (
                        result.receiptAudit.itemsAudit.map((item, i) => (
                          <tr key={i} className="hover:bg-neutral-900/40">
                            <td className="p-2.5 text-neutral-400">{i + 1}</td>
                            <td className="p-2.5 font-bold text-white">{item.customerRequestedItem}</td>
                            <td className="p-2.5 text-neutral-300">{item.receiptItem || "(ناقص)"}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                item.status === "matched_exact" 
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : item.hasCustomerConsent
                                    ? "bg-teal-500/20 text-teal-300"
                                    : "bg-rose-500/20 text-rose-300"
                              }`}>
                                {item.statusArabic}
                              </span>
                            </td>
                            <td className="p-2.5 text-neutral-300">
                              {item.consentSnippet ? `✓ وافق: "${item.consentSnippet}"` : (item.status === "matched_exact" ? "صنف أصلي مطابق" : "✗ لم يستأذن العميل")}
                            </td>
                            <td className="p-2.5 text-neutral-400">{item.auditNotes}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-neutral-500">
                            لم يتم تدقيق ريسيت الفاتورة بعد. يمكنك رفع صورة الريسيت من زر "تدقيق ريسيت الفاتورة".
                          </td>
                        </tr>
                      )}
                      {result.receiptAudit?.deliveryServiceAudit && (
                        <tr className="bg-sky-950/30 border-t border-sky-800/40">
                          <td className="p-2.5 text-sky-400 font-bold">-</td>
                          <td className="p-2.5 font-bold text-sky-200" colSpan={2}>
                            خدمة التوصيل (لا تُحتسب كصنف دوائي) {result.receiptAudit.deliveryServiceAudit.deliveryFee ? `[${result.receiptAudit.deliveryServiceAudit.deliveryFee} ج.م]` : ""}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300">
                              مستبعد من الأصناف
                            </span>
                          </td>
                          <td className="p-2.5 text-sky-200" colSpan={2}>
                            {result.receiptAudit.deliveryServiceAudit.alert || "تنبيه: مراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت"}
                            {result.receiptAudit.deliveryServiceAudit.receiptBranch && ` (الفرع المطبوع: ${result.receiptAudit.deliveryServiceAudit.receiptBranch})`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: TRANSCRIPT PREVIEW */}
            {activeTab === "transcript" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    معاينة ورقة العمل 5: تفريغ المكالمة بالكامل (Full Transcript)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    التفريغ الصوتي الكامل لجميع مقاطع الحوار مصنفة حسب المتحدث والطابع الزمني بالثواني.
                  </p>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/30 divide-y divide-neutral-800/60 p-2 font-mono text-xs">
                  {result.transcript && result.transcript.length > 0 ? (
                    result.transcript.slice(0, 40).map((t, i) => (
                      <div key={i} className="p-2.5 flex items-start gap-3 hover:bg-neutral-900/50">
                        <span className="text-[11px] text-neutral-500 shrink-0 w-8">{i + 1}</span>
                        <span className="text-[11px] text-emerald-400/90 font-bold shrink-0 w-28">{t.timeStart} - {t.timeEnd}</span>
                        <span className={`text-[11px] font-sans font-bold shrink-0 w-28 ${
                          t.speaker.includes("عميل") ? "text-purple-400" : t.speaker.includes("صمت") ? "text-rose-400" : "text-blue-400"
                        }`}>
                          {t.speaker}
                        </span>
                        <span className="font-sans text-neutral-200">{t.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-neutral-500 font-sans">لا يتوفر تفريغ</div>
                  )}
                  {result.transcript && result.transcript.length > 40 && (
                    <div className="p-3 text-center text-neutral-500 font-sans text-xs">
                      ... تم إظهار أول 40 مقطعاً، وسيحتوي ملف الإكسيل على كامل المقاطع ({result.transcript.length} مقطع)
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-800/80 bg-neutral-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>الملف متوافق مع كافة برامج الجداول: Microsoft Excel, Google Sheets, LibreOffice Calc</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="w-full sm:w-auto py-2 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl text-xs font-semibold transition-all border border-neutral-800 cursor-pointer"
              >
                إغلاق النافذة
              </button>
              <button
                id="btn-confirm-download-excel"
                onClick={handleDownload}
                disabled={isExporting}
                className="w-full sm:w-auto py-2 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ملف الإكسيل الشامل (.xlsx)</span>
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
