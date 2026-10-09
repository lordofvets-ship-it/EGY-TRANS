import React from "react";
import { 
  Activity, 
  Receipt, 
  FileSpreadsheet, 
  Settings, 
  Upload, 
  Sparkles, 
  Headphones, 
  CheckCircle2, 
  Info,
  Sun,
  Moon,
  Globe,
  PanelRightClose,
  Brain
} from "lucide-react";
import { Language, translations } from "../utils/translations";

export type NavigationTab = 
  | "home" // الرئيسية
  | "transcription" // تفريغ المكالمات
  | "invoice_audit" // تدقيق الفواتير
  | "reports" // التقارير
  | "memory" // ذاكرة النظام المستمرة
  | "benchmark" // المكالمة المعيارية
  | "settings" // الإعدادات
  | "about"; // ABOUT

export interface TabItem {
  id: NavigationTab;
  icon: React.ComponentType<{ className?: string }>;
  isNew?: boolean;
}

// Tabs written inside the design plus ABOUT
export const APP_NAVIGATION_TABS: TabItem[] = [
  { id: "home", icon: Activity },
  { id: "transcription", icon: Headphones },
  { id: "invoice_audit", icon: Receipt },
  { id: "reports", icon: FileSpreadsheet },
  { id: "settings", icon: Settings },
  { id: "about", icon: Info },
];

interface NavigationTabBarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  hasResult: boolean;
  onOpenReceiptModal: () => void;
  onOpenExcelModal: () => void;
  onUploadInvoiceClick: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
  isOpen?: boolean;
  onToggleSidebar?: () => void;
  reportsCount?: number;
}

export const NavigationTabBar: React.FC<NavigationTabBarProps> = ({
  activeTab,
  onTabChange,
  hasResult,
  onOpenReceiptModal,
  onOpenExcelModal,
  onUploadInvoiceClick,
  theme,
  onThemeChange,
  language = "ar",
  onLanguageChange = (_lang: Language) => {},
  isOpen = true,
  onToggleSidebar,
  reportsCount = 0,
}) => {
  const currentLang: Language = language === "en" ? "en" : "ar";
  const t = translations[currentLang] || translations.ar;

  if (!isOpen) {
    return null;
  }

  return (
    <aside 
      className={`w-56 sm:w-64 lg:w-72 bg-white dark:bg-[#1A1816] ${currentLang === "ar" ? "border-l" : "border-r"} border-[#EAE3D9] dark:border-stone-800 flex flex-col shrink-0 sticky top-0 h-screen z-30 shadow-2xs select-none transition-colors duration-200`}
      aria-label="شريط التبويبات"
    >
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-[#EAE3D9] dark:border-stone-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
            <img 
              src="/qa-logo.png" 
              alt="QA Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <Headphones className="w-5 h-5 text-[#C25E38] hidden" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight text-stone-900 dark:text-stone-100 leading-tight">
                {t.appName}
              </h1>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[#C25E38]/10 text-[#C25E38] font-bold border border-[#C25E38]/20">
                QA
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Circular Knob on Track: Slide to right to hide sidebar */}
        {onToggleSidebar && (
          <button
            type="button"
            role="switch"
            aria-checked={true}
            onClick={onToggleSidebar}
            style={{ direction: "ltr" }}
            className="relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full p-1 border border-[#C25E38]/30 bg-[#C25E38] transition-all duration-300 shadow-inner hover:bg-[#A94E2C]"
            title={currentLang === "en" ? "Click to hide sidebar" : "اضغط لإخفاء القائمة الجانبية"}
          >
            <span className="sr-only">إخفاء القائمة</span>
            <span className="pointer-events-none flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-300 translate-x-0">
              <PanelRightClose className="w-3 h-3 text-[#C25E38]" />
            </span>
          </button>
        )}
      </div>

      {/* Tabs Navigation Section (Always a vertical list on the sidebar) */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-1">
        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 px-3 py-1 uppercase tracking-wider">
          {t.sidebar.title}
        </div>

        <nav className="flex flex-col gap-1.5">
          {APP_NAVIGATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const label = t.tabs[tab.id];

            return (
              <button
                key={tab.id}
                id={`sidebar-tab-${tab.id}`}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-[#C25E38] text-white shadow-xs"
                    : "text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100/80 dark:hover:bg-stone-800/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-stone-500 dark:text-stone-400"}`} />
                  <span className="whitespace-nowrap">{label}</span>
                </div>
                {tab.isNew && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-medium leading-none ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20"
                    }`}
                  >
                    {t.sidebar.soon}
                  </span>
                )}
                {tab.id === "reports" && reportsCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold font-mono leading-none ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-[#C25E38]/15 text-[#C25E38] border border-[#C25E38]/25"
                    }`}
                  >
                    {reportsCount}
                  </span>
                )}
                {tab.id === "about" && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold font-mono leading-none ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                    }`}
                  >
                    {t.sidebar.info}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Language Switcher in Sidebar (العربية / English) */}
      <div className="px-3 sm:px-4 py-2 border-t border-[#EAE3D9] dark:border-stone-800/80">
        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 px-1 pb-1 flex items-center justify-between">
          <span>{t.sidebar.language}</span>
          <Globe className="w-3 h-3 text-[#C25E38]" />
        </div>
        <div className="p-1 bg-[#FAF8F5] dark:bg-stone-900/90 rounded-xl flex items-center justify-between border border-[#EAE3D9] dark:border-stone-800">
          <button
            type="button"
            id="sidebar-lang-ar-btn"
            onClick={() => onLanguageChange("ar")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              currentLang === "ar"
                ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs border border-[#EAE3D9] dark:border-stone-700"
                : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            <span>🇪🇬 عربي</span>
          </button>
          <button
            type="button"
            id="sidebar-lang-en-btn"
            onClick={() => onLanguageChange("en")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              currentLang === "en"
                ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs border border-[#EAE3D9] dark:border-stone-700"
                : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            <span>🇺🇸 English</span>
          </button>
        </div>
      </div>

      {/* Theme Switcher in Sidebar (نهارى / ليلى) */}
      <div className="px-3 sm:px-4 py-2 border-t border-[#EAE3D9] dark:border-stone-800/80">
        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 px-1 pb-1">
          {t.sidebar.appearance}
        </div>
        <div className="p-1 bg-[#FAF8F5] dark:bg-stone-900/90 rounded-xl flex items-center justify-between border border-[#EAE3D9] dark:border-stone-800">
          <button
            type="button"
            id="sidebar-theme-light-btn"
            onClick={() => onThemeChange("light")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              theme === "light"
                ? "bg-white text-stone-900 shadow-2xs border border-[#EAE3D9]"
                : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            <Sun className={`w-3.5 h-3.5 ${theme === "light" ? "text-amber-500" : "text-stone-400"}`} />
            <span>{t.sidebar.light}</span>
          </button>
          <button
            type="button"
            id="sidebar-theme-dark-btn"
            onClick={() => onThemeChange("dark")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-stone-800 text-stone-100 shadow-2xs border border-stone-700"
                : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            <Moon className={`w-3.5 h-3.5 ${theme === "dark" ? "text-indigo-400" : "text-stone-400"}`} />
            <span>{t.sidebar.dark}</span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer Actions Card */}
      <div className="p-3 sm:p-4 border-t border-[#EAE3D9] dark:border-stone-800 bg-[#FAF8F5]/60 dark:bg-stone-900/40 space-y-2.5">
        <button
          id="sidebar-upload-invoice-btn"
          type="button"
          onClick={onUploadInvoiceClick}
          className="w-full py-2.5 px-3.5 bg-[#C25E38] hover:bg-[#A94E2C] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>{t.sidebar.uploadInvoice}</span>
        </button>

        <div className="p-2.5 bg-white dark:bg-stone-800/60 rounded-xl border border-[#EAE3D9] dark:border-stone-700/60 text-[10px] space-y-1 text-stone-500 dark:text-stone-400">
          <div className="font-semibold text-stone-700 dark:text-stone-300">{t.sidebar.supportedFormats}</div>
          <div className="font-mono text-stone-500 dark:text-stone-400">{t.sidebar.supportedFormatsList}</div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 px-1 pt-1 font-mono">
          <span>{t.sidebar.systemBadge}</span>
          <span>{t.sidebar.version}</span>
        </div>
      </div>
    </aside>
  );
};
