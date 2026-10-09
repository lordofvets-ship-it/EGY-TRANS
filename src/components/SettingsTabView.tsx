import React, { useState } from "react";
import { 
  Settings, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  Sliders,
  Check,
  Volume2,
  Sparkles,
  Clock,
  VolumeX,
  Stethoscope,
  Smile,
  ShieldCheck,
  UserCheck,
  HeartHandshake,
  AlertTriangle,
  HelpCircle,
  XCircle,
  FileCheck,
  PhoneOff,
  FileText,
  BarChart3
} from "lucide-react";
import { 
  MeasurementItemId, 
  MeasurementItemSetting, 
  DEFAULT_MEASUREMENT_SETTINGS,
  CallProcessingMode
} from "../types";
import { Language, translations } from "../utils/translations";

interface SettingsTabViewProps {
  settings: MeasurementItemSetting[];
  onSettingsChange: (newSettings: MeasurementItemSetting[]) => void;
  processingMode?: CallProcessingMode;
  onProcessingModeChange?: (mode: CallProcessingMode) => void;
  onBackToHome: () => void;
  language?: Language;
}

export const SettingsTabView: React.FC<SettingsTabViewProps> = ({
  settings,
  onSettingsChange,
  processingMode = "transcription_with_analysis",
  onProcessingModeChange,
  onBackToHome,
  language = "ar",
}) => {
  const currentLang = language || "ar";
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleModeSelect = (mode: CallProcessingMode) => {
    if (onProcessingModeChange) {
      onProcessingModeChange(mode);
    }
    showToast(
      mode === "transcription_only"
        ? (currentLang === "en" ? "Activated: Audio Transcription Only" : "تم تفعيل وضع: تفريغ صوتي للمكالمة فقط")
        : (currentLang === "en" ? "Activated: Transcription with Analysis" : "تم تفعيل وضع: تفريغ مع تحليل")
    );
  };

  // Get item icon based on id
  const getItemIcon = (id: MeasurementItemId) => {
    switch (id) {
      case "agentTone":
        return <Sparkles className="w-4 h-4 text-violet-500" />;
      case "holdTime":
        return <Clock className="w-4 h-4 text-indigo-500" />;
      case "silence":
        return <VolumeX className="w-4 h-4 text-rose-500" />;
      case "greeting":
        return <Volume2 className="w-4 h-4 text-amber-500" />;
      case "customerName":
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case "customerTitle":
        return <CheckCircle2 className="w-4 h-4 text-teal-500" />;
      case "empathy":
        return <HeartHandshake className="w-4 h-4 text-pink-500" />;
      case "complaint":
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case "apology":
        return <ShieldCheck className="w-4 h-4 text-amber-500" />;
      case "scientificKnowledge":
        return <FileCheck className="w-4 h-4 text-blue-500" />;
      case "medicalConsultation":
        return <Stethoscope className="w-4 h-4 text-teal-500" />;
      case "unprofessionalWords":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "verbalTics":
        return <HelpCircle className="w-4 h-4 text-amber-500" />;
      case "furtherAssistance":
        return <Smile className="w-4 h-4 text-emerald-500" />;
      case "callEnding":
        return <PhoneOff className="w-4 h-4 text-stone-500" />;
      default:
        return <Settings className="w-4 h-4 text-stone-500" />;
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  // Toggle Visibility for a specific item
  const handleToggleVisibility = (id: MeasurementItemId) => {
    const updated = settings.map((item) => {
      if (item.id === id) {
        return { ...item, visible: !item.visible };
      }
      return item;
    });
    onSettingsChange(updated);
    const target = updated.find((i) => i.id === id);
    showToast(
      target?.visible 
        ? (currentLang === "en" ? `Item "${target.titleEn}" is now visible` : `تم إظهار البند: "${target?.title}"`)
        : (currentLang === "en" ? `Item "${target?.titleEn}" is now hidden` : `تم إخفاء البند: "${target?.title}"`)
    );
  };

  // Move item Up in order
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const sorted = [...settings].sort((a, b) => a.order - b.order);
    const temp = sorted[index];
    sorted[index] = sorted[index - 1];
    sorted[index - 1] = temp;

    // Re-assign 1-based order
    const reordered = sorted.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));
    onSettingsChange(reordered);
  };

  // Move item Down in order
  const handleMoveDown = (index: number) => {
    const sorted = [...settings].sort((a, b) => a.order - b.order);
    if (index >= sorted.length - 1) return;
    const temp = sorted[index];
    sorted[index] = sorted[index + 1];
    sorted[index + 1] = temp;

    // Re-assign 1-based order
    const reordered = sorted.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));
    onSettingsChange(reordered);
  };

  // Show all items
  const handleShowAll = () => {
    const updated = settings.map((item) => ({ ...item, visible: true }));
    onSettingsChange(updated);
    showToast(currentLang === "en" ? "All measurement items are now visible" : "تم إظهار كافة بنود القياس");
  };

  // Hide all items
  const handleHideAll = () => {
    const updated = settings.map((item) => ({ ...item, visible: false }));
    onSettingsChange(updated);
    showToast(currentLang === "en" ? "All measurement items are now hidden" : "تم إخفاء كافة بنود القياس");
  };

  // Reset to default order and visibility
  const handleResetDefaults = () => {
    if (window.confirm(currentLang === "en" ? "Reset all measurement settings to default?" : "هل ترغب في إعادة ضبط ترتيب وإظهار بنود القياس للوضع الافتراضي؟")) {
      onSettingsChange(DEFAULT_MEASUREMENT_SETTINGS);
      showToast(currentLang === "en" ? "Reset to default settings" : "تمت استعادة الترتيب والإعدادات الافتراضية");
    }
  };

  // Sorted list according to user order
  const sortedSettings = [...settings].sort((a, b) => a.order - b.order);

  // Filtered by category if chosen
  const displayedSettings = sortedSettings.filter((item) => {
    if (activeCategoryFilter === "all") return true;
    return item.category === activeCategoryFilter;
  });

  const visibleCount = settings.filter((s) => s.visible).length;
  const hiddenCount = settings.length - visibleCount;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Call Processing Mode Card: تفريغ صوتي للمكالمة فقط أو تفريغ مع تحليل */}
      <div
        id="settings-processing-mode-card"
        className="bg-white dark:bg-[#1C1A18] rounded-2xl border-2 border-[#C25E38]/30 dark:border-[#C25E38]/40 p-6 shadow-xs space-y-4 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#EAE3D9] dark:border-stone-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0">
              {processingMode === "transcription_only" ? (
                <FileText className="w-5 h-5 text-[#C25E38]" />
              ) : (
                <BarChart3 className="w-5 h-5 text-[#C25E38]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  {currentLang === "en"
                    ? "Call Processing Mode"
                    : "وضع معالجة المكالمات الصوتية"}
                </h3>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                    processingMode === "transcription_only"
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {processingMode === "transcription_only"
                    ? currentLang === "en"
                      ? "Transcription Only"
                      : "تفريغ صوتي للمكالمة فقط"
                    : currentLang === "en"
                      ? "Transcription with Analysis"
                      : "تفريغ مع تحليل"}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                {currentLang === "en"
                  ? "Choose whether to perform audio transcription of the call only, or transcription with full quality analysis."
                  : "اختر بين إجراء تفريغ صوتي لنص المكالمة فقط، أو تفريغ المكالمة مع التحليل الشامل لمعايير الجودة"}
              </p>
            </div>
          </div>

          {/* Track-and-Circle Toggle Switch for quick switching */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300 select-none">
              {processingMode === "transcription_only"
                ? currentLang === "en"
                  ? "Transcription Only"
                  : "تفريغ صوتي فقط"
                : currentLang === "en"
                  ? "Transcription + Analysis"
                  : "تفريغ مع تحليل"}
            </span>
            <button
              id="toggle-processing-mode-switch"
              type="button"
              role="switch"
              aria-checked={processingMode === "transcription_with_analysis"}
              onClick={() =>
                handleModeSelect(
                  processingMode === "transcription_only"
                    ? "transcription_with_analysis"
                    : "transcription_only"
                )
              }
              style={{ direction: "ltr" }}
              className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full p-1 border transition-all duration-300 ease-in-out focus:outline-none select-none active:scale-95 ${
                processingMode === "transcription_with_analysis"
                  ? "bg-emerald-600 dark:bg-emerald-500 border-emerald-700/40 shadow-inner"
                  : "bg-[#C25E38] border-[#A94E2C]/40 shadow-inner"
              }`}
              title={
                currentLang === "en"
                  ? "Toggle between Transcription Only and Transcription with Analysis"
                  : "التبديل بين تفريغ صوتي للمكالمة فقط وتفريغ مع تحليل"
              }
            >
              <span
                className={`pointer-events-none flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                  processingMode === "transcription_with_analysis"
                    ? "translate-x-0"
                    : "translate-x-8"
                }`}
              >
                {processingMode === "transcription_with_analysis" ? (
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-[#C25E38]" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Two Prominent Mode Selection Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Button 1: تفريغ صوتي للمكالمة فقط */}
          <button
            id="btn-mode-transcription-only"
            type="button"
            onClick={() => handleModeSelect("transcription_only")}
            className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-start justify-between gap-3 ${
              processingMode === "transcription_only"
                ? "bg-[#C25E38]/10 dark:bg-[#C25E38]/15 border-[#C25E38] shadow-xs"
                : "bg-[#FAF8F5] dark:bg-stone-900/60 border-[#EAE3D9] dark:border-stone-800 hover:border-[#C25E38]/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  processingMode === "transcription_only"
                    ? "bg-[#C25E38] text-white"
                    : "bg-stone-200/70 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                }`}
              >
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                    {currentLang === "en"
                      ? "Audio Transcription Only"
                      : "تفريغ صوتي للمكالمة فقط"}
                  </span>
                  {processingMode === "transcription_only" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C25E38] text-white font-bold">
                      {currentLang === "en" ? "Selected" : "مُفعّل"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                  {currentLang === "en"
                    ? "Extract full dialogue text, timestamps, and speaker diarization only without QA analysis cards."
                    : "استخراج النص الحرفي الكامل للمكالمة مع التوقيتات وتحديد المتحدثين (الزميل والعميل) فقط بدون بطاقات التحليل"}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                processingMode === "transcription_only"
                  ? "border-[#C25E38] bg-[#C25E38] text-white"
                  : "border-stone-300 dark:border-stone-600"
              }`}
            >
              {processingMode === "transcription_only" && (
                <Check className="w-3 h-3" />
              )}
            </div>
          </button>

          {/* Button 2: تفريغ مع تحليل */}
          <button
            id="btn-mode-transcription-with-analysis"
            type="button"
            onClick={() => handleModeSelect("transcription_with_analysis")}
            className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-start justify-between gap-3 ${
              processingMode === "transcription_with_analysis"
                ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-600 dark:border-emerald-500 shadow-xs"
                : "bg-[#FAF8F5] dark:bg-stone-900/60 border-[#EAE3D9] dark:border-stone-800 hover:border-emerald-500/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  processingMode === "transcription_with_analysis"
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-200/70 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                }`}
              >
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                    {currentLang === "en"
                      ? "Transcription with Analysis"
                      : "تفريغ مع تحليل"}
                  </span>
                  {processingMode === "transcription_with_analysis" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                      {currentLang === "en" ? "Selected" : "مُفعّل"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                  {currentLang === "en"
                    ? "Full audio transcription alongside all 15 QA criteria, tone analysis, Medscape audit, and KPI scoring."
                    : "تفريغ صوتي شامل للمكالمة مع تشغيل كافة معايير تقييم الجودة الـ 15 وتدقيق Medscape والـ KPI"}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                processingMode === "transcription_with_analysis"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-stone-300 dark:border-stone-600"
              }`}
            >
              {processingMode === "transcription_with_analysis" && (
                <Check className="w-3 h-3" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Top Banner: Settings Definition */}
      <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D9] dark:border-stone-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0 shadow-2xs">
              <Sliders className="w-6 h-6 text-[#C25E38]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
                  {currentLang === "en" ? "Settings" : "الإعدادات"}
                </h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30 font-mono">
                  {visibleCount} {currentLang === "en" ? "Visible" : "بند ظاهر"}
                </span>
                {hiddenCount > 0 && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold font-mono">
                    {hiddenCount} {currentLang === "en" ? "Hidden" : "مخفي"}
                  </span>
                )}
              </div>
              {/* Exact user definition */}
              <div className="mt-1.5 p-2.5 bg-[#FAF8F5] dark:bg-stone-900/60 rounded-xl border border-[#EAE3D9] dark:border-stone-800">
                <p className="text-xs text-stone-700 dark:text-stone-200 font-bold leading-relaxed">
                  <span className="text-[#C25E38] font-black">{currentLang === "en" ? "Definition of Settings:" : "تعريف الإعدادات:"}</span>{" "}
                  {currentLang === "en"
                    ? "Arranging call measurement items with a button beside each to show or hide it."
                    : "عبارة عن ترتيب بنود قياس المكالمة وبجانب كل منها زر للضغط لإظهارها أو إخفائها"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="py-2 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={currentLang === "en" ? "Restore Default Order" : "إعادة الترتيب الافتراضي"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{currentLang === "en" ? "Reset" : "الترتيب الافتراضي"}</span>
            </button>

            <button
              type="button"
              onClick={onBackToHome}
              className="py-2.5 px-3.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRight className={`w-3.5 h-3.5 ${currentLang === "en" ? "rotate-180" : ""}`} />
              <span>{currentLang === "en" ? "Back to Dashboard" : "العودة للرئيسية"}</span>
            </button>
          </div>
        </div>

        {/* Quick Toolbar: Show All / Hide All / Filter by Category */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("all")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeCategoryFilter === "all"
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
            >
              {currentLang === "en" ? "All Items (15)" : "كافة البنود (15)"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryFilter("acoustic")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeCategoryFilter === "acoustic"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/60 border border-violet-200/60 dark:border-violet-900/40"
              }`}
            >
              {currentLang === "en" ? "Acoustic Analysis" : "التحليل الصوتي"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryFilter("protocol")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeCategoryFilter === "protocol"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-200/60 dark:border-amber-900/40"
              }`}
            >
              {currentLang === "en" ? "Protocol" : "بروتوكول المكالمة"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryFilter("customer_experience")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeCategoryFilter === "customer_experience"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40"
              }`}
            >
              {currentLang === "en" ? "Customer Experience" : "تجربة العميل"}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryFilter("pharma")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeCategoryFilter === "pharma"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/60 border border-teal-200/60 dark:border-teal-900/40"
              }`}
            >
              {currentLang === "en" ? "Pharma Standards" : "المعايير الصيدلانية"}
            </button>
          </div>

          {/* Bulk Visibility Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleShowAll}
              className="py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-emerald-300/60 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{currentLang === "en" ? "Show All" : "إظهار الكل"}</span>
            </button>

            <button
              type="button"
              onClick={handleHideAll}
              className="py-1.5 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{currentLang === "en" ? "Hide All" : "إخفاء الكل"}</span>
            </button>
          </div>
        </div>

        {/* Temporary success notification */}
        {successToast && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
      </div>

      {/* Measurement Items List: Reorderable with Toggle Button beside each item */}
      <div className="space-y-2.5">
        {displayedSettings.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === displayedSettings.length - 1;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.visible
                  ? "bg-white dark:bg-[#1C1A18] border-[#EAE3D9] dark:border-stone-800 shadow-2xs hover:border-[#C25E38]/30"
                  : "bg-stone-50/70 dark:bg-stone-900/30 border-stone-200/60 dark:border-stone-800/60 opacity-60"
              }`}
            >
              {/* Left Side: Order Index, Reorder Arrows, Icon, Title, and Description */}
              <div className="flex items-start sm:items-center gap-3">
                {/* Reorder Buttons (Move Up / Move Down) */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 bg-stone-100 dark:bg-stone-850 p-1 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={isFirst}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      isFirst
                        ? "text-stone-300 dark:text-stone-700 cursor-not-allowed"
                        : "text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95"
                    }`}
                    title={currentLang === "en" ? "Move Up" : "تحريك للأعلى في الترتيب"}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[10px] font-mono font-black text-stone-600 dark:text-stone-300 px-1 select-none">
                    #{item.order}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={isLast}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      isLast
                        ? "text-stone-300 dark:text-stone-700 cursor-not-allowed"
                        : "text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95"
                    }`}
                    title={currentLang === "en" ? "Move Down" : "تحريك للأسفل في الترتيب"}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Item Icon */}
                <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 border border-[#EAE3D9] dark:border-stone-700 flex items-center justify-center shrink-0">
                  {getItemIcon(item.id)}
                </div>

                {/* Title, Badge, Description */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                      {currentLang === "en" ? item.titleEn : item.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200/60 dark:border-stone-700">
                      {currentLang === "en" ? item.category : item.categoryArabic}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-sans leading-relaxed">
                    {currentLang === "en" ? item.descriptionEn : item.description}
                  </p>
                </div>
              </div>

              {/* Right Side: Circular Knob on Track (زر عبارة عن دائرة لها مسار: عند الضغط عليها تذهب لليمين للإخفاء وعند الضغط مرة أخرى تذهب لليسار للإظهار) */}
              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 pt-2 sm:pt-0">
                {/* State Label: ظاهر / مخفي */}
                <span
                  className={`text-xs font-bold transition-colors select-none ${
                    item.visible
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-stone-400 dark:text-stone-500"
                  }`}
                >
                  {item.visible
                    ? currentLang === "en" ? "Visible" : "ظاهر"
                    : currentLang === "en" ? "Hidden" : "مخفي"}
                </span>

                {/* Switch Track (مسار) with circular knob (دائرة) */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.visible}
                  onClick={() => handleToggleVisibility(item.id)}
                  style={{ direction: "ltr" }}
                  className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full p-1 border transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 select-none active:scale-95 ${
                    item.visible
                      ? "bg-emerald-600 dark:bg-emerald-500 border-emerald-700/40 shadow-inner"
                      : "bg-stone-300 dark:bg-stone-700 border-stone-400/40 dark:border-stone-600 shadow-inner"
                  }`}
                  title={
                    item.visible
                      ? currentLang === "en"
                        ? "Click to move right and hide"
                        : "اضغط للتحريك لليمين للإخفاء"
                      : currentLang === "en"
                        ? "Click to move left and show"
                        : "اضغط للتحريك لليسار للإظهار"
                  }
                >
                  <span className="sr-only">
                    {item.visible ? "إخفاء" : "إظهار"}
                  </span>

                  {/* Circular Knob (الدائرة) sliding on the track (المسار) */}
                  {/* Left (translate-x-0) = إظهار, Right (translate-x-8) = إخفاء */}
                  <span
                    className={`pointer-events-none flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                      item.visible ? "translate-x-0" : "translate-x-8"
                    }`}
                  >
                    {item.visible ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
