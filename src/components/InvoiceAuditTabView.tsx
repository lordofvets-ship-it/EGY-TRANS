import React, { useRef, useState } from "react";
import { 
  Receipt, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  FileText, 
  Image as ImageIcon, 
  ClipboardPaste, 
  RotateCcw,
  CheckCheck,
  AlertCircle,
  Truck
} from "lucide-react";
import { ReceiptAuditResult, TranscriptItem } from "../types";
import { Language, translations } from "../utils/translations";

interface InvoiceAuditTabViewProps {
  receiptAudit?: ReceiptAuditResult | null;
  callTranscript?: TranscriptItem[];
  onOpenReceiptModal: () => void;
  onQuickUploadImage: (file: File) => void;
  language?: Language;
}

export const InvoiceAuditTabView: React.FC<InvoiceAuditTabViewProps> = ({
  receiptAudit,
  callTranscript,
  onOpenReceiptModal,
  onQuickUploadImage,
  language = "ar",
}) => {
  const currentLang = language || "ar";
  const t = translations[currentLang] || translations.ar;
  const tInvoice = t.invoiceAudit;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const hasTranscript = Boolean(callTranscript && callTranscript.length > 0);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onQuickUploadImage(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onQuickUploadImage(file);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6 text-[#C25E38]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
                {tInvoice.title}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {tInvoice.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenReceiptModal}
              className="py-2.5 px-4 bg-[#C25E38] hover:bg-[#A94E2C] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>{tInvoice.openModal}</span>
            </button>
          </div>
        </div>

        {/* Guidance and Prerequisite State */}
        {!hasTranscript && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              {tInvoice.noTranscriptWarning}
            </div>
          </div>
        )}

        {/* Upload Dropzone */}
        <div
          id="invoice-tab-dropzone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all min-h-[200px] cursor-pointer ${
            dragActive
              ? "border-[#C25E38] bg-[#C25E38]/5 text-[#C25E38]"
              : "border-[#EAE3D9] dark:border-stone-800 bg-[#FAF8F5]/50 dark:bg-stone-900/40 hover:border-[#C25E38]/40 hover:bg-[#FAF8F5] dark:hover:bg-stone-800/60"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-stone-800 border border-[#EAE3D9] dark:border-stone-700 flex items-center justify-center mb-3 shadow-2xs">
            <Upload className={`w-7 h-7 ${dragActive ? "text-[#C25E38]" : "text-stone-500 dark:text-stone-400"}`} />
          </div>

          <p className="text-sm font-bold text-stone-800 dark:text-stone-100 text-center mb-1">
            {tInvoice.dropzoneTitle}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 text-center mb-4">
            {tInvoice.dropzoneDesc} — {tInvoice.pasteHint}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] px-3 py-1 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full border border-[#EAE3D9] dark:border-stone-700 font-mono font-semibold">
              PNG • JPG • JPEG • WEBP • PDF
            </span>
            <span className="text-[11px] px-3 py-1 bg-[#C25E38]/10 text-[#C25E38] rounded-full border border-[#C25E38]/20 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#C25E38]" />
              <span>Tesseract OCR محرك القراءة الآلية</span>
            </span>
          </div>
        </div>

        {/* Existing Audit Result Preview if Available */}
        {receiptAudit && (
          <div className="space-y-4 pt-4 border-t border-[#EAE3D9] dark:border-stone-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">حالة المطابقة الحالية:</span>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold border ${
                    receiptAudit.isFullyCompliant
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                  }`}
                >
                  {receiptAudit.isFullyCompliant
                    ? "مطابق بنسبة 100% (جميع الأصناف موفرة أو بموافقة)"
                    : `نسبة التوفير المعتمدة ${receiptAudit.fulfillmentRatePercentage}%`}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenReceiptModal}
                className="text-xs text-[#C25E38] font-bold hover:underline"
              >
                عرض التقرير التفصيلي للأصناف ←
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#FAF8F5] dark:bg-stone-850/50 rounded-xl border border-[#EAE3D9] dark:border-stone-800 text-center">
                <span className="text-xs text-stone-500 dark:text-stone-400">إجمالي الأصناف</span>
                <p className="text-lg font-black text-stone-900 dark:text-stone-100 mt-1 font-mono">
                  {receiptAudit.totalRequestedItemsCount}
                </p>
              </div>
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-center">
                <span className="text-xs text-emerald-700 dark:text-emerald-400">الأصناف الموفرة</span>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-300 mt-1 font-mono">
                  {receiptAudit.fulfilledItemsCount}
                </p>
              </div>
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 text-center">
                <span className="text-xs text-amber-700 dark:text-amber-400">بدائل بموافقة العميل</span>
                <p className="text-lg font-black text-amber-800 dark:text-amber-300 mt-1 font-mono">
                  {receiptAudit.approvedSubstitutesCount}
                </p>
              </div>
              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40 text-center">
                <span className="text-xs text-rose-700 dark:text-rose-400">مخالفات / بدون موافقة</span>
                <p className="text-lg font-black text-rose-800 dark:text-rose-300 mt-1 font-mono">
                  {receiptAudit.unapprovedSubstitutesCount}
                </p>
              </div>
            </div>

            {/* معيار تدقيق الفاتورة: خدمة التوصيل (لا تُحتسب كصنف) مع تنبيه مراجعة التأكد من صحتها مع الفرع */}
            {receiptAudit.deliveryServiceAudit && (
              <div className="p-3 bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sky-950 dark:text-sky-200">
                      خدمة التوصيل: لا تُحتسب كصنف دوائي
                    </span>
                    {receiptAudit.deliveryServiceAudit.deliveryFee && receiptAudit.deliveryServiceAudit.deliveryFee !== "0" && (
                      <span className="mr-2 text-stone-700 dark:text-stone-300 font-mono font-bold">
                        ({receiptAudit.deliveryServiceAudit.deliveryFee} ج.م)
                      </span>
                    )}
                    <span className="block text-[11px] text-sky-800 dark:text-sky-300 font-semibold mt-0.5">
                      {receiptAudit.deliveryServiceAudit.alert || "تنبيه: مراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت"}
                      {receiptAudit.deliveryServiceAudit.receiptBranch && ` - الفرع المطبوع: ${receiptAudit.deliveryServiceAudit.receiptBranch}`}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-white dark:bg-stone-800 px-2 py-0.5 rounded border border-sky-200 dark:border-stone-700 text-sky-700 dark:text-sky-300 font-medium shrink-0">
                  مستبعد من عدد الأصناف
                </span>
              </div>
            )}

            {/* Audit Summary Text */}
            <div className="p-3.5 bg-[#FAF8F5] dark:bg-stone-850/50 rounded-xl border border-[#EAE3D9] dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
              <span className="font-bold text-stone-900 dark:text-stone-100 ml-1">خلاصة التدقيق:</span>
              {receiptAudit.auditSummary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
