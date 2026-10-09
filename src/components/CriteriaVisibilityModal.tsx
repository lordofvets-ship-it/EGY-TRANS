import React from "react";
import { 
  X, 
  Sliders, 
  Eye, 
  EyeOff, 
  Check, 
  RotateCcw,
  Volume2,
  Music,
  VolumeX,
  AlertTriangle,
  User,
  Award,
  Activity,
  Headphones,
  Heart,
  Sparkles,
  PhoneOff,
  Stethoscope,
  FlaskConical,
  MessageSquare,
  Settings
} from "lucide-react";
import { MeasurementItemSetting, MeasurementItemId } from "../types";
import { Language } from "../utils/translations";

interface CriteriaVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MeasurementItemSetting[];
  onToggle: (id: MeasurementItemId) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onResetDefaults?: () => void;
  language?: Language;
}

export const CriteriaVisibilityModal: React.FC<CriteriaVisibilityModalProps> = ({
  isOpen,
  onClose,
  settings,
  onToggle,
  onShowAll,
  onHideAll,
  onResetDefaults,
  language = "ar",
}) => {
  if (!isOpen) return null;

  const currentLang = language || "ar";
  const visibleCount = settings.filter((s) => s.visible).length;
  const totalCount = settings.length;

  const getItemIcon = (id: MeasurementItemId) => {
    switch (id) {
      case "agentTone":
        return <Volume2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case "holdTime":
        return <Music className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "silence":
        return <VolumeX className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case "complaint":
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case "customerName":
        return <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "customerTitle":
        return <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "apology":
        return <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "greeting":
        return <Headphones className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "empathy":
        return <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case "furtherAssistance":
        return <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "callEnding":
        return <PhoneOff className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "unprofessionalWords":
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "medicalConsultation":
        return <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case "scientificKnowledge":
        return <FlaskConical className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case "verbalTics":
        return <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Settings className="w-4 h-4 text-stone-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white dark:bg-[#1A1816] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="criteria-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAE3D9] dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 id="criteria-modal-title" className="text-base font-bold text-stone-900 dark:text-white">
                {currentLang === "en" ? "Customize Evaluation Criteria" : "تخصيص وإخفاء بنود التقييم"}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {currentLang === "en" 
                  ? `Any hidden item will automatically disappear from the agent's evaluation (${visibleCount} of ${totalCount} visible)`
                  : `أي بند يتم إخفاؤه يختفي تلقائياً وفوراً من داخل تقييم الزميل (${visibleCount} من ${totalCount} مفعل)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all cursor-pointer"
            title={currentLang === "en" ? "Close" : "إغلاق"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Batch Actions Bar */}
        <div className="p-3 bg-stone-50 dark:bg-stone-900/40 border-b border-[#EAE3D9] dark:border-stone-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>
              {currentLang === "en"
                ? `${visibleCount} active criteria`
                : `${visibleCount} بنداً ظاهراً في التقييم`}
            </span>
            {visibleCount < totalCount && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
                ({totalCount - visibleCount} مخفي)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onShowAll}
              className="py-1 px-2.5 bg-white dark:bg-stone-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-stone-700 border border-emerald-300 dark:border-stone-700 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{currentLang === "en" ? "Show All" : "إظهار الكل"}</span>
            </button>
            <button
              type="button"
              onClick={onHideAll}
              className="py-1 px-2.5 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{currentLang === "en" ? "Hide All" : "إخفاء الكل"}</span>
            </button>
            {onResetDefaults && (
              <button
                type="button"
                onClick={onResetDefaults}
                className="py-1 px-2 bg-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg font-medium flex items-center gap-1 transition-all cursor-pointer"
                title={currentLang === "en" ? "Reset" : "استعادة الافتراضي"}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list of items */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 divide-y divide-[#EAE3D9]/60 dark:divide-stone-800/60">
          {settings.map((item) => (
            <div
              key={item.id}
              className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                item.visible
                  ? "bg-white dark:bg-stone-900/30"
                  : "bg-stone-100/60 dark:bg-stone-900/60 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 border border-[#EAE3D9] dark:border-stone-700 flex items-center justify-center shrink-0">
                  {getItemIcon(item.id)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">
                      {currentLang === "en" ? item.titleEn : item.title}
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">
                      {currentLang === "en" ? item.category : item.categoryArabic}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-sm mt-0.5">
                    {currentLang === "en" ? item.descriptionEn : item.description}
                  </p>
                </div>
              </div>

              {/* The Circular Knob on Track Switch */}
              {/* عند الضغط عليها تذهب لليمين للإخفاء وعند الضغط مرة أخرى تذهب لليسار للإظهار */}
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`text-xs font-bold select-none ${
                  item.visible 
                    ? "text-emerald-700 dark:text-emerald-400" 
                    : "text-stone-400 dark:text-stone-500"
                }`}>
                  {item.visible 
                    ? (currentLang === "en" ? "Visible" : "ظاهر")
                    : (currentLang === "en" ? "Hidden" : "مخفي")}
                </span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={item.visible}
                  onClick={() => onToggle(item.id)}
                  style={{ direction: "ltr" }}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 border transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 select-none active:scale-95 ${
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
                  {/* Circular Knob sliding on track */}
                  {/* Left (translate-x-0) = إظهار, Right (translate-x-7) = إخفاء */}
                  <span
                    className={`pointer-events-none flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                      item.visible ? "translate-x-0" : "translate-x-7"
                    }`}
                  >
                    {item.visible ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <X className="w-3 h-3 text-stone-400" />
                    )}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 dark:bg-stone-900/50 border-t border-[#EAE3D9] dark:border-stone-800 flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {currentLang === "en"
              ? "Changes are applied immediately to the evaluation report."
              : "يتم تطبيق التغييرات فوراً وربطها مباشرة مع تقرير تقييم المكالمة."}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            {currentLang === "en" ? "Done" : "تم والحفظ"}
          </button>
        </div>
      </div>
    </div>
  );
};
