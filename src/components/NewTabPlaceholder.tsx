import React from "react";
import { 
  ArrowRight, 
  Settings, 
  Clock, 
  Sliders
} from "lucide-react";
import { NavigationTab, APP_NAVIGATION_TABS } from "./NavigationTabBar";
import { Language, translations } from "../utils/translations";

interface NewTabPlaceholderProps {
  tabId: NavigationTab;
  onBackToHome: () => void;
  language?: Language;
}

export const NewTabPlaceholder: React.FC<NewTabPlaceholderProps> = ({
  tabId,
  onBackToHome,
  language = "ar",
}) => {
  const currentTab = APP_NAVIGATION_TABS.find((t) => t.id === tabId);
  const Icon = currentTab?.icon || Settings;
  const t = translations[language];
  const tabLabel = t.tabs[tabId] || tabId;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D9] dark:border-stone-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-[#C25E38]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">{tabLabel}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>{t.newTab.awaitingBadge}</span>
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {t.newTab.blueprintDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToHome}
            className="self-start sm:self-auto py-2 px-3.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowRight className={`w-3.5 h-3.5 ${language === "en" ? "rotate-180" : ""}`} />
            <span>{t.newTab.backHome}</span>
          </button>
        </div>

        {/* Clean Blueprint */}
        <div className="p-8 rounded-xl bg-[#FAF8F5] dark:bg-stone-850/50 border border-[#EAE3D9] dark:border-stone-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-stone-800 border border-[#EAE3D9] dark:border-stone-700 flex items-center justify-center mx-auto shadow-2xs">
            <Sliders className="w-5 h-5 text-stone-400" />
          </div>
          <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
            {t.newTab.placeholderTitle}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
            {t.newTab.placeholderDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
