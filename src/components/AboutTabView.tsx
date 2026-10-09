import React from "react";
import { 
  Info, 
  Headphones, 
  Receipt, 
  Music, 
  FileSpreadsheet, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Cpu
} from "lucide-react";
import { Language, translations } from "../utils/translations";

interface AboutTabViewProps {
  onBackToHome: () => void;
  onRequestUploadCall?: () => void;
  onRequestUploadInvoice?: () => void;
  language?: Language;
}

export const AboutTabView: React.FC<AboutTabViewProps> = ({
  onBackToHome,
  onRequestUploadCall,
  onRequestUploadInvoice,
  language = "ar",
}) => {
  const t = translations[language].about;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Main About Card */}
      <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-6 sm:p-8 shadow-xs space-y-6 transition-colors">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EAE3D9] dark:border-stone-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0 shadow-xs">
              <Headphones className="w-7 h-7 text-[#C25E38]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                  {t.title}
                </h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 font-bold font-mono">
                  v1.2.0
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToHome}
            className="self-start sm:self-auto py-2 px-3.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowRight className={`w-3.5 h-3.5 ${language === "en" ? "rotate-180" : ""}`} />
            <span>{t.backHome}</span>
          </button>
        </div>

        {/* System Overview */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C25E38]" />
            <span>{t.overviewTitle}</span>
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            {t.overviewDesc}
          </p>
        </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Pillar 1: Speech to Text */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-850/60 border border-[#EAE3D9] dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2.5 text-stone-900 dark:text-stone-100">
              <Cpu className="w-4 h-4 text-[#C25E38]" />
              <h4 className="text-xs font-bold">{t.p1Title}</h4>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
              {t.p1Desc}
            </p>
          </div>

          {/* Pillar 2: Hold & Silence Analysis */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-850/60 border border-[#EAE3D9] dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2.5 text-stone-900 dark:text-stone-100">
              <Music className="w-4 h-4 text-[#C25E38]" />
              <h4 className="text-xs font-bold">{t.p2Title}</h4>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
              {t.p2Desc}
            </p>
          </div>

          {/* Pillar 3: Receipt OCR Audit */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-850/60 border border-[#EAE3D9] dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2.5 text-stone-900 dark:text-stone-100">
              <Receipt className="w-4 h-4 text-[#C25E38]" />
              <h4 className="text-xs font-bold">{t.p3Title}</h4>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
              {t.p3Desc}
            </p>
          </div>

          {/* Pillar 4: Excel Multi-Sheet Reporting */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-850/60 border border-[#EAE3D9] dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2.5 text-stone-900 dark:text-stone-100">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold">{t.p4Title}</h4>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
              {t.p4Desc}
            </p>
          </div>
        </div>

        {/* Technical Specs & Compliance */}
        <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-850/60 border border-[#EAE3D9] dark:border-stone-800 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-stone-800 dark:text-stone-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t.standardsTitle}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-stone-600 dark:text-stone-300 pt-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{t.std1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{t.std2}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{t.std3}</span>
            </div>
          </div>
        </div>

        {/* Quick Return Footer */}
        <div className="pt-2 flex items-center justify-between gap-3 text-xs border-t border-[#EAE3D9] dark:border-stone-800">
          <span className="text-stone-500 dark:text-stone-400 font-mono">
            {t.footerPortal}
          </span>
          <button
            type="button"
            onClick={onBackToHome}
            className="py-2 px-4 bg-[#C25E38] hover:bg-[#A94E2C] text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
          >
            {t.footerAction}
          </button>
        </div>
      </div>
    </div>
  );
};
