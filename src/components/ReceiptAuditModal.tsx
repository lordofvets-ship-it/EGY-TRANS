import React, { useState, useRef, useEffect } from "react";
import { 
  Receipt, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Sparkles, 
  FileText, 
  Image as ImageIcon, 
  X, 
  Maximize2, 
  Printer, 
  RefreshCw,
  Search,
  Check,
  ShieldCheck,
  AlertCircle,
  Pill,
  ChevronDown,
  ChevronUp,
  Tag,
  ClipboardPaste,
  Scissors,
  RotateCcw,
  Crop,
  CheckCheck,
  Calculator,
  Coins,
  DollarSign,
  Boxes,
  PackageCheck,
  ListOrdered,
  Truck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReceiptAuditResult, TranscriptItem, ReceiptAuditItemMatch } from "../types";

interface ReceiptAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  callTranscript?: TranscriptItem[];
  initialReceiptAudit?: ReceiptAuditResult | null;
  onAuditComplete?: (result: ReceiptAuditResult) => void;
  initialImageFile?: File | null;
  onRequestUploadCall?: () => void;
}

export const ReceiptAuditModal: React.FC<ReceiptAuditModalProps> = ({
  isOpen,
  onClose,
  callTranscript,
  initialReceiptAudit,
  onAuditComplete,
  initialImageFile,
  onRequestUploadCall,
}) => {
  const hasCallTranscript = Boolean(callTranscript && callTranscript.length > 0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [manualItems, setManualItems] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditStep, setAuditStep] = useState<string>("");
  const [auditResult, setAuditResult] = useState<ReceiptAuditResult | null>(initialReceiptAudit || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOcrText, setShowOcrText] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);

  // In-app interactive cropping states
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  });
  const [dragMode, setDragMode] = useState<"create" | "move" | "nw" | "ne" | "sw" | "se" | null>(null);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    initialRect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastProcessedFileRef = useRef<File | null>(null);

  // Load initialImageFile if provided from parent (e.g. global paste or drop)
  useEffect(() => {
    if (initialImageFile && isOpen && lastProcessedFileRef.current !== initialImageFile) {
      lastProcessedFileRef.current = initialImageFile;
      handleFileSelection(initialImageFile);
    }
  }, [initialImageFile, isOpen]);

  // Keep auditResult synced with initialReceiptAudit when re-opening without a new image
  useEffect(() => {
    if (initialReceiptAudit && !selectedFile && !isProcessing) {
      setAuditResult(initialReceiptAudit);
    }
  }, [initialReceiptAudit]);

  // Listen to clipboard paste (Ctrl+V) anywhere while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            handleFileSelection(file);
            return;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, hasCallTranscript]);

  if (!isOpen) return null;

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File, autoTrigger = true) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("يرجى اختيار ملف صورة صالح للريسيت / الفاتورة (JPEG, PNG, WebP).");
      return;
    }
    lastProcessedFileRef.current = file;
    setErrorMessage(null);
    setSelectedFile(file);
    setOriginalFile(file);
    setAuditResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      setOriginalPreviewUrl(dataUrl);
      setIsCropping(false);
      setCropRect({ x: 5, y: 5, width: 90, height: 90 });

      // If call transcript exists (call uploaded first), work on receipt directly without intervention!
      if (autoTrigger && hasCallTranscript) {
        setPasteNotification("⚡ تم استلام صورة الريسيت - جاري بدء التدقيق والمطابقة التلقائية مع المكالمة فوراً...");
        runReceiptAudit(file, dataUrl);
      } else if (!hasCallTranscript) {
        setPasteNotification("تم تحميل صورة الريسيت. يرجى رفع تسجيل المكالمة أولاً للمطابقة.");
        const timer = setTimeout(() => setPasteNotification(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Direct paste button from system clipboard API
  const handlePasteFromClipboardButton = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);

    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setErrorMessage("متصفحك يحتاج الضغط على مفتاحي (Ctrl + V) على لوحة المفاتيح للصق الصورة مباشرة من الحافظة.");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;

      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const file = new File([blob], `pasted_receipt_${Date.now()}.${ext}`, { type: imageType });
          handleFileSelection(file);
          foundImage = true;
          setPasteNotification("تم قص ولصق صورة الريسيت من الحافظة بنجاح!");
          setTimeout(() => setPasteNotification(null), 3500);
          break;
        }
      }

      if (!foundImage) {
        setErrorMessage("لم يتم العثور على صورة في الحافظة. يرجى قص لقطة الشاشة للريسيت (Snipping Tool / Copy Image) أولاً، ثم الضغط على (Ctrl + V) أو النقر على الزر مجدداً.");
      }
    } catch (err: any) {
      console.warn("Clipboard read error:", err);
      setErrorMessage("تعذر الوصول التلقائي للحافظة بسبب أذونات المتصفح. يمكنك لصق الصورة مباشرة بالضغط على مفتاحي (Ctrl + V) على الكيبورد الآن.");
    }
  };

  // Interactive Cropping Helper Functions
  const getPointerPercentage = (clientX: number, clientY: number) => {
    if (!cropContainerRef.current) return { x: 0, y: 0 };
    const rect = cropContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, mode: "create" | "move" | "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const point = getPointerPercentage(clientX, clientY);

    setDragMode(mode);
    setDragStart({
      x: point.x,
      y: point.y,
      initialRect: { ...cropRect },
    });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragMode || !dragStart) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const point = getPointerPercentage(clientX, clientY);

    const deltaX = point.x - dragStart.x;
    const deltaY = point.y - dragStart.y;
    const { initialRect } = dragStart;

    if (dragMode === "move") {
      const newX = Math.max(0, Math.min(100 - initialRect.width, initialRect.x + deltaX));
      const newY = Math.max(0, Math.min(100 - initialRect.height, initialRect.y + deltaY));
      setCropRect((prev) => ({ ...prev, x: newX, y: newY }));
    } else if (dragMode === "create") {
      const newX = Math.min(dragStart.x, point.x);
      const newY = Math.min(dragStart.y, point.y);
      const newW = Math.max(5, Math.abs(point.x - dragStart.x));
      const newH = Math.max(5, Math.abs(point.y - dragStart.y));
      setCropRect({ x: newX, y: newY, width: newW, height: newH });
    } else if (dragMode === "se") {
      const newW = Math.max(5, Math.min(100 - initialRect.x, initialRect.width + deltaX));
      const newH = Math.max(5, Math.min(100 - initialRect.y, initialRect.height + deltaY));
      setCropRect((prev) => ({ ...prev, width: newW, height: newH }));
    } else if (dragMode === "sw") {
      const newX = Math.max(0, Math.min(initialRect.x + initialRect.width - 5, initialRect.x + deltaX));
      const newW = initialRect.width + (initialRect.x - newX);
      const newH = Math.max(5, Math.min(100 - initialRect.y, initialRect.height + deltaY));
      setCropRect((prev) => ({ ...prev, x: newX, width: newW, height: newH }));
    } else if (dragMode === "ne") {
      const newY = Math.max(0, Math.min(initialRect.y + initialRect.height - 5, initialRect.y + deltaY));
      const newH = initialRect.height + (initialRect.y - newY);
      const newW = Math.max(5, Math.min(100 - initialRect.x, initialRect.width + deltaX));
      setCropRect((prev) => ({ ...prev, y: newY, width: newW, height: newH }));
    } else if (dragMode === "nw") {
      const newX = Math.max(0, Math.min(initialRect.x + initialRect.width - 5, initialRect.x + deltaX));
      const newY = Math.max(0, Math.min(initialRect.y + initialRect.height - 5, initialRect.y + deltaY));
      const newW = initialRect.width + (initialRect.x - newX);
      const newH = initialRect.height + (initialRect.y - newY);
      setCropRect({ x: newX, y: newY, width: newW, height: newH });
    }
  };

  const handlePointerUp = () => {
    setDragMode(null);
    setDragStart(null);
  };

  // Apply Crop via HTML5 Canvas
  const handleApplyCrop = () => {
    if (!previewUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      if (!naturalW || !naturalH) return;

      const pixelX = Math.max(0, Math.round((cropRect.x / 100) * naturalW));
      const pixelY = Math.max(0, Math.round((cropRect.y / 100) * naturalH));
      const pixelW = Math.min(naturalW - pixelX, Math.max(10, Math.round((cropRect.width / 100) * naturalW)));
      const pixelH = Math.min(naturalH - pixelY, Math.max(10, Math.round((cropRect.height / 100) * naturalH)));

      const canvas = document.createElement("canvas");
      canvas.width = pixelW;
      canvas.height = pixelH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
      const croppedDataUrl = canvas.toDataURL("image/png");
      setPreviewUrl(croppedDataUrl);

      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], `receipt_crop_${Date.now()}.png`, { type: "image/png" });
          setSelectedFile(croppedFile);
          if (hasCallTranscript) {
            setPasteNotification("⚡ تم قص وتحديد إطار الريسيت بنجاح - جاري إعادة التدقيق التلقائي...");
            runReceiptAudit(croppedFile, croppedDataUrl);
          } else {
            setPasteNotification("تم قص وتحديد إطار الريسيت بنجاح! جاهز للتدقيق الآن.");
            setTimeout(() => setPasteNotification(null), 3500);
          }
        }
      }, "image/png");

      setIsCropping(false);
    };
    img.src = previewUrl;
  };

  const handleResetToOriginal = () => {
    if (originalPreviewUrl && originalFile) {
      setPreviewUrl(originalPreviewUrl);
      setSelectedFile(originalFile);
      setIsCropping(false);
      setCropRect({ x: 5, y: 5, width: 90, height: 90 });
      setPasteNotification("تمت استعادة الصورة الأصلية بنجاح.");
      setTimeout(() => setPasteNotification(null), 3000);
    }
  };

  const runReceiptAudit = async (overrideFile?: File, overrideDataUrl?: string) => {
    if (!hasCallTranscript) {
      setErrorMessage("لا يمكن إجراء المطابقة إلا بعد رفع ملف تسجيل المكالمة الصوتي أولاً للتحقق من طلب العميل وموافقته على البدائل.");
      return;
    }

    const fileToAudit = overrideFile || selectedFile;
    const dataUrlToAudit = overrideDataUrl || previewUrl;

    if (!fileToAudit && !dataUrlToAudit) {
      setErrorMessage("يرجى رفع صورة الريسيت أو الفاتورة أولاً.");
      return;
    }

    if (isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setAuditStep("جاري قراءة نص الفاتورة وتدقيق المحتوى تلقائياً...");

    try {
      // Prepare base64
      let base64Data = dataUrlToAudit || "";
      if (!base64Data && fileToAudit) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileToAudit);
        });
      }

      setAuditStep("جاري فحص وتدقيق الأصناف ومطابقة موافقة العميل على البدائل/المثائل...");

      const manualItemsList = manualItems
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const response = await fetch("/api/audit-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBytes: base64Data,
          mimeType: fileToAudit?.type || "image/jpeg",
          callTranscript: callTranscript || [],
          manualRequestedItems: manualItemsList,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `فشل التدقيق (كود: ${response.status})`);
      }

      const result: ReceiptAuditResult = await response.json();
      setAuditResult(result);
      if (onAuditComplete) {
        onAuditComplete(result);
      }
      setPasteNotification("تم اكتمال تدقيق ومطابقة الريسيت تلقائياً بنجاح!");
      setTimeout(() => setPasteNotification(null), 3500);
    } catch (err: any) {
      console.error("Receipt audit error:", err);
      setErrorMessage(err.message || "حدث خطأ غير متوقع أثناء معالجة الفاتورة.");
    } finally {
      setIsProcessing(false);
      setAuditStep("");
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOriginalPreviewUrl(null);
    setOriginalFile(null);
    setAuditResult(null);
    setErrorMessage(null);
    setIsCropping(false);
    setPasteNotification(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: ReceiptAuditItemMatch["status"]) => {
    switch (status) {
      case "matched_exact":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          label: "متوفر مطابق (الصنف الأصلي المطلوب)",
        };
      case "matched_generic_approved":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <Check className="w-4 h-4 text-blue-600" />,
          label: "مثيل متطابق (بموافقة العميل)",
        };
      case "matched_substitute_approved":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <Check className="w-4 h-4 text-purple-600" />,
          label: "بديل علاجي (بموافقة العميل)",
        };
      case "matched_substitute_unapproved":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-300 animate-pulse",
          icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
          label: "مخالفة جودة: بديل/مثيل بدون موافقة العميل!",
        };
      case "missing_not_provided":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          icon: <XCircle className="w-4 h-4 text-amber-600" />,
          label: "صنف ناقص (لم يتم توفيره)",
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          icon: <Tag className="w-4 h-4 text-slate-500" />,
          label: "صنف إضافي",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div 
        id="receipt-audit-modal-container"
        className="relative w-full max-w-5xl my-auto bg-white dark:bg-[#1A1816] rounded-2xl shadow-2xl border border-slate-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh] transition-colors"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-stone-800 bg-slate-50/80 dark:bg-stone-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-stone-100 flex items-center gap-2">
                تدقيق ومطابقة ريسيت الفاتورة
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                التأكد من توفير كافة أصناف العميل أو البدائل/المثائل بعد موافقة العميل الموثقة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {auditResult && (
              <button
                id="btn-print-receipt-audit"
                onClick={handlePrint}
                className="p-2 text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                title="طباعة تقرير الفحص"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            <button
              id="btn-close-receipt-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 hover:bg-slate-200/60 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Context Notification */}
          {hasCallTranscript ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-emerald-950 flex items-center gap-2 flex-wrap">
                    <span>تفريغ المكالمة متصل ({callTranscript?.length || 0} مقطع صوتي)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold border border-emerald-300">
                      ⚡ التدقيق التلقائي الفوري مُفعّل
                    </span>
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    تم رفع المكالمة أولاً: بمجرد لصق (Ctrl+V) أو رفع صورة الريسيت، يتم بدء التدقيق والمطابقة واستخراج البدائل مباشرة وبدون أي تدخل.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-200/80 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-300 font-mono shrink-0">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                جاهز للمطابقة الفورية
              </span>
            </div>
          ) : (
            <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl text-xs text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-amber-900 mb-0.5">
                    تنبيه إلزامي: لا تتم المطابقة إلا بعد رفع ملف تسجيل المكالمة الصوتي
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    لا يمكن إجراء مطابقة الفاتورة مع طلب العميل إلا بعد تزويد وتسجيل المكالمة الصوتية أولاً، لمقارنة كلام العميل مع الأصناف واستخراج موافقته على البدائل والمثائل.
                  </p>
                </div>
              </div>
              {onRequestUploadCall && (
                <button
                  type="button"
                  id="btn-upload-call-banner"
                  onClick={() => {
                    onClose();
                    onRequestUploadCall();
                  }}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" />
                  <span>رفع تسجيل المكالمة الصوتي الآن</span>
                </button>
              )}
            </div>
          )}

          {/* Paste & Crop Notification */}
          <AnimatePresence>
            {pasteNotification && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{pasteNotification}</span>
                </div>
                <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-mono">
                  جاهز للتدقيق
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload and Input Section */}
          {!auditResult && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Dropzone / Preview / Cropper */}
              <div className="md:col-span-7">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    صورة الريسيت / الفاتورة (مطلوبة):
                  </label>
                  <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ClipboardPaste className="w-3 h-3 text-teal-600" />
                    يدعم القص واللصق المباشر (Ctrl+V)
                  </span>
                </div>

                {!previewUrl ? (
                  <div className="space-y-3">
                    {/* Quick Paste Guide & Action Banner */}
                    <div className="p-3.5 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50/70 border border-teal-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 text-right w-full sm:w-auto">
                        <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <ClipboardPaste className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            قص ولصق لقطة شاشة الريسيت مباشرة
                            <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-mono text-[10px] font-bold border border-teal-300">
                              Ctrl + V
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-600">
                            خذ لقطة شاشة للريسيت (Snipping Tool) ثم اضغط هنا للصقها فوراً
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handlePasteFromClipboardButton}
                        className="w-full sm:w-auto px-3.5 py-2 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        title="قراءة الصورة من الحافظة مباشرة"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span>لصق من الحافظة (Paste)</span>
                      </button>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                        dragActive
                          ? "border-teal-500 bg-teal-50/60 scale-[0.99]"
                          : "border-slate-200 hover:border-teal-400 hover:bg-slate-50/70"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelection(e.target.files[0]);
                          }
                        }}
                      />
                      <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 mb-1">
                        اسحب وأفلت صورة الفاتورة هنا، أو انقر للتصفح من جهازك
                      </h3>
                      <p className="text-[11px] text-slate-500 mb-3">
                        يدعم صور الكاشير، الفواتير الحرارية، أو لقطات شاشة الأوردر (JPEG / PNG / WebP)
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100/80 text-teal-800">
                          <Upload className="w-3.5 h-3.5" />
                          اختيار ملف صورة
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">أو اضغط Ctrl+V</span>
                      </div>
                    </div>
                  </div>
                ) : isCropping ? (
                  /* Interactive In-App Cropping Tool */
                  <div className="relative border-2 border-teal-500 rounded-2xl p-4 bg-slate-900 text-white shadow-xl">
                    {/* Crop Top Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5 text-teal-300 font-bold">
                        <Scissors className="w-4 h-4" />
                        <span>أداة قص وتحديد جزء من الصورة (Crop Tool)</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-slate-400">تحديدات سريعة:</span>
                        <button
                          type="button"
                          onClick={() => setCropRect({ x: 0, y: 0, width: 100, height: 100 })}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                        >
                          100%
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropRect({ x: 7.5, y: 7.5, width: 85, height: 85 })}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                        >
                          أطراف (85%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropRect({ x: 5, y: 0, width: 90, height: 60 })}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                        >
                          النصف العلوي
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropRect({ x: 5, y: 40, width: 90, height: 60 })}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                        >
                          النصف السفلي
                        </button>
                      </div>
                    </div>

                    {/* Interactive Canvas/Image Viewport */}
                    <div
                      ref={cropContainerRef}
                      onMouseDown={(e) => handlePointerDown(e, "create")}
                      onMouseMove={handlePointerMove}
                      onMouseUp={handlePointerUp}
                      onTouchStart={(e) => handlePointerDown(e, "create")}
                      onTouchMove={handlePointerMove}
                      onTouchEnd={handlePointerUp}
                      className="relative my-3 max-h-[340px] overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center select-none cursor-crosshair border border-slate-800"
                    >
                      <img
                        ref={imageRef}
                        src={previewUrl}
                        alt="Receipt Crop Source"
                        className="max-h-[340px] w-full object-contain pointer-events-none select-none block"
                      />

                      {/* Crop Box Overlay */}
                      <div
                        style={{
                          left: `${cropRect.x}%`,
                          top: `${cropRect.y}%`,
                          width: `${cropRect.width}%`,
                          height: `${cropRect.height}%`,
                        }}
                        onMouseDown={(e) => handlePointerDown(e, "move")}
                        onTouchStart={(e) => handlePointerDown(e, "move")}
                        className="absolute border-2 border-teal-400 bg-teal-500/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] cursor-move"
                      >
                        {/* 3x3 Grid Lines */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                          <div className="border-r border-b border-teal-200"></div>
                          <div className="border-r border-b border-teal-200"></div>
                          <div className="border-b border-teal-200"></div>
                          <div className="border-r border-b border-teal-200"></div>
                          <div className="border-r border-b border-teal-200"></div>
                          <div className="border-b border-teal-200"></div>
                          <div className="border-r border-teal-200"></div>
                          <div className="border-r border-teal-200"></div>
                          <div></div>
                        </div>

                        {/* Corner Handles */}
                        <div
                          onMouseDown={(e) => handlePointerDown(e, "nw")}
                          onTouchStart={(e) => handlePointerDown(e, "nw")}
                          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-teal-400 border border-white rounded-xs cursor-nwse-resize"
                        />
                        <div
                          onMouseDown={(e) => handlePointerDown(e, "ne")}
                          onTouchStart={(e) => handlePointerDown(e, "ne")}
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-teal-400 border border-white rounded-xs cursor-nesw-resize"
                        />
                        <div
                          onMouseDown={(e) => handlePointerDown(e, "sw")}
                          onTouchStart={(e) => handlePointerDown(e, "sw")}
                          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-teal-400 border border-white rounded-xs cursor-nesw-resize"
                        />
                        <div
                          onMouseDown={(e) => handlePointerDown(e, "se")}
                          onTouchStart={(e) => handlePointerDown(e, "se")}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-teal-400 border border-white rounded-xs cursor-nwse-resize"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 text-center mb-3">
                      * اسحب المؤشر فوق جزء الفاتورة المطلوب قصه، أو حرك المستطيل والمقابض لتحديد أصناف الريسيت بدقة.
                    </p>

                    {/* Crop Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApplyCrop}
                          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>تطبيق القص والاعتماد</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCropping(false)}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>

                      {originalPreviewUrl && originalPreviewUrl !== previewUrl && (
                        <button
                          type="button"
                          onClick={handleResetToOriginal}
                          className="px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استرجاع الأصل</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Standard Image Preview with Enhanced Toolbars */
                  <div className="relative border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
                    <div className="relative max-h-72 overflow-hidden rounded-xl bg-slate-900 flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Receipt Preview"
                        className="max-h-72 object-contain rounded-lg"
                      />
                      <button
                        onClick={() => setIsImageExpanded(true)}
                        className="absolute bottom-2 left-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs flex items-center gap-1 backdrop-blur-sm transition-all"
                        title="تكبير الصورة"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>تكبير</span>
                      </button>
                      {originalPreviewUrl && originalPreviewUrl !== previewUrl && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-teal-600/90 text-white text-[10px] font-bold rounded-md shadow-xs backdrop-blur-xs flex items-center gap-1">
                          <Scissors className="w-3 h-3" />
                          تم قص الصورة
                        </span>
                      )}
                    </div>

                    {/* Preview Toolbar with Cut, Paste & Change options */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-200/80 px-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsCropping(true)}
                          className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="قص وتحديد جزء من الصورة لعزل بنود الفاتورة"
                        >
                          <Scissors className="w-3.5 h-3.5 text-teal-600" />
                          <span>قص وتحديد الريسيت</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePasteFromClipboardButton}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="لصق صورة بديلة من الحافظة مباشرة (Ctrl+V)"
                        >
                          <ClipboardPaste className="w-3.5 h-3.5 text-blue-600" />
                          <span>لصق بديل (Ctrl+V)</span>
                        </button>
                        {originalPreviewUrl && originalPreviewUrl !== previewUrl && (
                          <button
                            type="button"
                            onClick={handleResetToOriginal}
                            className="px-2 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                            title="إلغاء القص والرجوع للصورة الكاملة الأصلية"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>استرجاع الأصل</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={resetUpload}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        تغيير الصورة
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Extra Items or Instructions */}
              <div className="md:col-span-5 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    أصناف مطلوبة محددة يدوياً (اختياري):
                  </label>
                  <textarea
                    value={manualItems}
                    onChange={(e) => setManualItems(e.target.value)}
                    placeholder="إذا أردت تحديد أصناف معينة، اكتب كل صنف في سطر جديد:&#10;مثال:&#10;كونكور 5 مجم (علبة)&#10;بانادول إكسترا&#10;سيبتازول أقراص"
                    rows={6}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none bg-slate-50/50"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {hasCallTranscript ? (
                      "* سيقوم النظام تلقائياً باستخراج طلبات العميل من تفريغ المكالمة الصوتية ومطابقتها حتى لو تُرك هذا الحقل فارغاً."
                    ) : (
                      <span className="text-amber-700 font-medium">
                        * تنبيه: لا تتم المطابقة ومراجعة البدائل إلا بعد رفع ملف تسجيل المكالمة الصوتي للمقارنة مع ما طلبه العميل.
                      </span>
                    )}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  {!hasCallTranscript ? (
                    <div className="space-y-2.5">
                      <button
                        id="btn-start-receipt-audit"
                        type="button"
                        disabled={true}
                        className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center gap-2 cursor-not-allowed shadow-none"
                        title="لا تتم المطابقة إلا بعد رفع ملف تسجيل المكالمة الصوتي"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>لا تتم المطابقة إلا بعد رفع تسجيل المكالمة الصوتي</span>
                      </button>

                      {onRequestUploadCall && (
                        <button
                          type="button"
                          id="btn-upload-call-action-bottom"
                          onClick={() => {
                            onClose();
                            onRequestUploadCall();
                          }}
                          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                        >
                          <Upload className="w-4 h-4" />
                          <span>رفع ملف تسجيل المكالمة الصوتي أولاً</span>
                        </button>
                      )}

                      <p className="text-[11px] text-center text-amber-800 font-medium">
                        * لإجراء المطابقة الكاملة، يُرجى رفع ملف تسجيل المكالمة أولاً.
                      </p>
                    </div>
                  ) : (
                    <button
                      id="btn-start-receipt-audit"
                      onClick={() => runReceiptAudit()}
                      disabled={(!selectedFile && !previewUrl) || isProcessing}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-sm transition-all ${
                        (!selectedFile && !previewUrl) || isProcessing
                          ? "bg-slate-300 cursor-not-allowed"
                          : "bg-teal-600 hover:bg-teal-700 active:scale-[0.99] shadow-teal-600/20 shadow-lg cursor-pointer"
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{auditStep || "جاري التدقيق والمعالجة..."}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>بدء تدقيق الفاتورة ومطابقة طلب العميل مع المكالمة</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Audit Results Dashboard */}
          {auditResult && (
            <div className="space-y-6">
              {/* Top Banner Status */}
              <div
                className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  auditResult.isFullyCompliant
                    ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                    : auditResult.unapprovedSubstitutesCount > 0 || auditResult.totalAudit?.wasStatedByAgent === false
                    ? "bg-rose-50/90 border-rose-300 text-rose-950"
                    : "bg-amber-50/90 border-amber-200 text-amber-950"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                      auditResult.isFullyCompliant
                        ? "bg-emerald-600 text-white"
                        : auditResult.unapprovedSubstitutesCount > 0 || auditResult.totalAudit?.wasStatedByAgent === false
                        ? "bg-rose-600 text-white"
                        : "bg-amber-600 text-white"
                    }`}
                  >
                    {auditResult.isFullyCompliant ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : auditResult.unapprovedSubstitutesCount > 0 || auditResult.totalAudit?.wasStatedByAgent === false ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : (
                      <Clock className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black">
                      {auditResult.isFullyCompliant
                        ? "طلب العميل متوافق ومستوفٍ بالكامل (100%)"
                        : auditResult.unapprovedSubstitutesCount > 0
                        ? "مخالفة جودة حرجة: تم توفير بديل أو مثيل بدون موافقة صريحة من العميل!"
                        : auditResult.totalAudit?.wasStatedByAgent === false
                        ? "تنبيه إلزامي: لم يقم الزميل بإبلاغ العميل بإجمالي الفاتورة!"
                        : auditResult.totalAudit && !auditResult.totalAudit.isMatched
                        ? "تنبيه عدم تطابق: فارق بين إجمالي المكالمة وإجمالي الريسيت!"
                        : "يوجد أصناف ناقصة لم يتم توفيرها للعميل"}
                    </h3>
                    <p className="text-xs opacity-90 mt-0.5">
                      {auditResult.auditSummary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center px-4 py-2 bg-white/80 rounded-xl border border-current/20 shadow-xs">
                    <div className="text-xs font-semibold">نسبة توفير الطلب</div>
                    <div className="text-xl font-black text-teal-700">
                      {auditResult.fulfillmentRatePercentage}%
                    </div>
                  </div>
                  <button
                    onClick={resetUpload}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    فحص فاتورة أخرى
                  </button>
                </div>
              </div>

              {/* Statistics Counters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[11px] text-slate-500 block font-medium">أصناف العميل المطلوبة</span>
                  <span className="text-lg font-black text-slate-800">{auditResult.totalRequestedItemsCount}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[11px] text-emerald-700 block font-medium">متوفر ومطابق</span>
                  <span className="text-lg font-black text-emerald-700">{auditResult.fulfilledItemsCount}</span>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                  <span className="text-[11px] text-purple-700 block font-medium">بدائل بموافقة العميل</span>
                  <span className="text-lg font-black text-purple-700">{auditResult.approvedSubstitutesCount}</span>
                </div>
                <div className={`p-3 rounded-xl border text-center ${
                  auditResult.unapprovedSubstitutesCount > 0
                    ? "bg-rose-50 border-rose-300 text-rose-700 font-bold animate-pulse"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <span className="text-[11px] block font-medium">بدائل بدون موافقة (مخالفة)</span>
                  <span className="text-lg font-black">{auditResult.unapprovedSubstitutesCount}</span>
                </div>
                <div className={`p-3 rounded-xl border text-center ${
                  auditResult.missingItemsCount > 0
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <span className="text-[11px] block font-medium">أصناف ناقصة</span>
                  <span className="text-lg font-black">{auditResult.missingItemsCount}</span>
                </div>
              </div>

              {/* معيار الإجمالي: تطابق إجمالي المكالمة مع إجمالي الريسيت والتنبيه في حال عدم الذكر */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300 flex items-center justify-center shrink-0">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-sans flex items-center gap-2">
                        <span>معيار الإجمالي: قياس تطابق إجمالي الفاتورة المبلغ به للعميل مع إجمالي الريسيت</span>
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        مقارنة المبلغ الذي بلغه الزميل للعميل مع إجمالي الفاتورة بالريسيت مع التنبيه الصارم عند إغفال الذكر
                      </p>
                    </div>
                  </div>

                  {auditResult.totalAudit ? (
                    auditResult.totalAudit.wasStatedByAgent === false || auditResult.totalAudit.status === "not_stated" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        تنبيه: لم يذكر الزميل الإجمالي
                      </span>
                    ) : auditResult.totalAudit.isMatched ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        مطابق تماماً (100%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        تنبيه: يوجد فارق في الإجمالي
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                      قيد الفحص
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-3.5">
                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. إجمالي الفاتورة بالريسيت */}
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                      <span className="text-[11px] text-slate-500 block font-medium mb-1">
                        إجمالي الفاتورة في الريسيت (Receipt Total)
                      </span>
                      <div className="text-xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                        <span>{auditResult.totalAudit?.receiptTotal || auditResult.receiptTotal || "غير محدد"}</span>
                        <span className="text-xs text-slate-500 font-sans">ج.م</span>
                      </div>
                    </div>

                    {/* 2. الإجمالي الذي ذكره الزميل */}
                    <div className={`p-3.5 rounded-xl border ${
                      auditResult.totalAudit?.wasStatedByAgent === false
                        ? "border-rose-300 bg-rose-50/80"
                        : "border-slate-200 bg-slate-50/70"
                    }`}>
                      <span className="text-[11px] text-slate-500 block font-medium mb-1">
                        الإجمالي الذي ذكره الزميل للعميل بالمكالمة
                      </span>
                      {auditResult.totalAudit?.wasStatedByAgent === false ? (
                        <div className="text-rose-700 font-bold text-xs flex items-center gap-1.5 mt-2">
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>لم يقم الزميل بذكر الإجمالي</span>
                        </div>
                      ) : (
                        <div className="text-xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                          <span>{auditResult.totalAudit?.statedTotalByAgent || "لم يُذكر"}</span>
                          <span className="text-xs text-slate-500 font-sans">ج.م</span>
                        </div>
                      )}
                    </div>

                    {/* 3. حالة المطابقة والفارق */}
                    <div className={`p-3.5 rounded-xl border ${
                      auditResult.totalAudit?.wasStatedByAgent === false
                        ? "border-rose-300 bg-rose-50/80"
                        : auditResult.totalAudit?.isMatched
                        ? "border-emerald-300 bg-emerald-50/70"
                        : "border-amber-300 bg-amber-50/80"
                    }`}>
                      <span className="text-[11px] text-slate-500 block font-medium mb-1">
                        حالة التطابق والفارق المالي
                      </span>
                      {auditResult.totalAudit?.wasStatedByAgent === false ? (
                        <div className="text-xs font-bold text-rose-800 flex items-center gap-1 mt-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>تنبيه: تم إغفال ذكر الحساب للعميل</span>
                        </div>
                      ) : auditResult.totalAudit?.isMatched ? (
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>مطابق بنسبة 100% (فارق 0 ج.م)</span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-amber-800 flex items-center gap-1 mt-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>فارق مالي: {auditResult.totalAudit?.difference ?? "-"} ج.م</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Statement snippet from call if colleague stated it */}
                  {auditResult.totalAudit?.agentStatementSnippet && (
                    <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-950 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-[11px] text-teal-900 mb-0.5">
                          توثيق إبلاغ الزميل للعميل بالإجمالي من تفريغ المكالمة:
                        </span>
                        <span className="font-mono text-teal-950 font-medium">
                          {auditResult.totalAudit.agentStatementSnippet}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Alert box if colleague did NOT state the total */}
                  {auditResult.totalAudit?.wasStatedByAgent === false && (
                    <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-950 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-rose-900 text-xs sm:text-sm">
                          تنبيه إلزامي (معيار الإجمالي): لم يقم الزميل بإبلاغ العميل بإجمالي الفاتورة!
                        </h5>
                        <p className="text-rose-800 leading-relaxed text-xs">
                          {auditResult.totalAudit.alert ||
                            `أغفل الزميل إبلاغ العميل بإجمالي الحساب أثناء المكالمة (إجمالي الريسيت: ${auditResult.totalAudit.receiptTotal || auditResult.receiptTotal || "-"} ج.م). يجب التنبيه على ضرورة إبلاغ العميل بالتكلفة الإجمالية للأوردر قبل إنهاء المكالمة لتأكيد الحساب ومنع أي شكاوى عند الاستلام.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Alert box if there is a mismatch */}
                  {auditResult.totalAudit?.wasStatedByAgent === true && !auditResult.totalAudit?.isMatched && (
                    <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-amber-900 text-xs sm:text-sm">
                          تنبيه عدم تطابق الإجمالي: فارق بين المبلغ الذي ذكره الزميل وإجمالي الريسيت!
                        </h5>
                        <p className="text-amber-800 leading-relaxed text-xs">
                          {auditResult.totalAudit.alert ||
                            `أبلغ الزميل العميل بمبلغ ${auditResult.totalAudit.statedTotalByAgent} ج.م بينما المسجل بالريسيت هو ${auditResult.totalAudit.receiptTotal} ج.م (فارق: ${auditResult.totalAudit.difference ?? "-"} ج.م).`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* معيار كمية وعدد الأصناف ومراجعة الزميل للأوردر (طلب العميل فقط) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-sans flex items-center gap-2">
                        <span>معيار كمية وعدد الأصناف ومراجعة الأوردر (طلب العميل فقط)</span>
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        التحقق من كميات الأصناف المطلوبة بصوت العميل فقط وكشف أي خطأ في تسجيل الزميل أو مراجعته للأوردر
                      </p>
                    </div>
                  </div>

                  {auditResult.quantityAudit?.isAllQuantitiesMatched &&
                   (auditResult.orderReviewAudit ? auditResult.orderReviewAudit.isReviewAccurate !== false : true) &&
                   auditResult.isItemCountMatched !== false ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      الكميات والمراجعة مطابقة لطلب العميل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      تنبيه: يوجد خطأ في الكمية أو مراجعة الأوردر
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-3.5">
                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. عدد الأصناف المطلوبة من العميل فقط vs الفاتورة */}
                    <div className={`p-3.5 rounded-xl border ${
                      auditResult.isItemCountMatched === false
                        ? "border-rose-300 bg-rose-50/70"
                        : "border-slate-200 bg-slate-50/70"
                    }`}>
                      <span className="text-[11px] text-slate-500 block font-medium mb-1 flex items-center gap-1">
                        <Boxes className="w-3.5 h-3.5 text-slate-400" />
                        عدد أصناف طلب العميل vs الريسيت (دون التوصيل)
                      </span>
                      <div className="flex items-baseline gap-2 font-mono mt-1">
                        <div className="text-lg font-black text-slate-900">
                          {auditResult.customerItemsCount ?? auditResult.totalRequestedItemsCount}
                          <span className="text-[10px] font-sans text-slate-500 mr-1">طلب العميل</span>
                        </div>
                        <span className="text-slate-300">/</span>
                        <div className="text-lg font-black text-slate-700">
                          {auditResult.receiptItemsCount ?? auditResult.itemsAudit?.length ?? 0}
                          <span className="text-[10px] font-sans text-slate-500 mr-1">بالريسيت</span>
                        </div>
                      </div>
                      {auditResult.isItemCountMatched === false && (
                        <span className="text-[11px] font-bold text-rose-700 mt-1 block">
                          تنبيه: اختلاف في عدد الأصناف
                        </span>
                      )}
                    </div>

                    {/* 2. تدقيق كميات الأصناف */}
                    <div className={`p-3.5 rounded-xl border ${
                      auditResult.quantityAudit && !auditResult.quantityAudit.isAllQuantitiesMatched
                        ? "border-rose-300 bg-rose-50/70"
                        : "border-slate-200 bg-slate-50/70"
                    }`}>
                      <span className="text-[11px] text-slate-500 block font-medium mb-1 flex items-center gap-1">
                        <ListOrdered className="w-3.5 h-3.5 text-slate-400" />
                        تطابق كميات طلب العميل
                      </span>
                      {auditResult.quantityAudit && !auditResult.quantityAudit.isAllQuantitiesMatched ? (
                        <div className="text-rose-700 font-bold text-xs flex items-center gap-1.5 mt-1.5">
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            يوجد {auditResult.quantityAudit.quantityDiscrepanciesCount || 1} صنف بخطأ في الكمية
                          </span>
                        </div>
                      ) : (
                        <div className="text-emerald-700 font-bold text-xs flex items-center gap-1.5 mt-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>جميع الكميات مطابقة لما طلبه العميل</span>
                        </div>
                      )}
                    </div>

                    {/* 3. تدقيق مراجعة الزميل للأوردر */}
                    <div className={`p-3.5 rounded-xl border ${
                      auditResult.orderReviewAudit?.isReviewAccurate === false
                        ? "border-rose-300 bg-rose-50/70"
                        : "border-slate-200 bg-slate-50/70"
                    }`}>
                      <span className="text-[11px] text-slate-500 block font-medium mb-1 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                        مراجعة الزميل للأوردر مع العميل
                      </span>
                      {auditResult.orderReviewAudit?.isReviewAccurate === false ? (
                        <div className="text-rose-700 font-bold text-xs flex items-center gap-1.5 mt-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>خطأ في مراجعة أو تأكيد الأوردر</span>
                        </div>
                      ) : auditResult.orderReviewAudit?.wasReviewedByAgent === false ? (
                        <div className="text-amber-700 font-bold text-xs flex items-center gap-1.5 mt-1.5">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>لم يقم الزميل بمراجعة الأوردر</span>
                        </div>
                      ) : (
                        <div className="text-emerald-700 font-bold text-xs flex items-center gap-1.5 mt-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>راجع الزميل الأوردر بدقة وتطابق</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Review Discrepancy Alert Box */}
                  {auditResult.orderReviewAudit?.isReviewAccurate === false && (
                    <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-950 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="font-bold text-rose-900 text-xs sm:text-sm">
                          تنبيه رقابي: راجع الزميل الأوردر أو سجله بشكل خاطئ مخالف لطلب العميل!
                        </h5>
                        <p className="text-rose-800 leading-relaxed text-xs">
                          {auditResult.orderReviewAudit.alert ||
                            `راجع الزميل الأوردر مع العميل بشكل خاطئ (${auditResult.orderReviewAudit.agentReviewSnippet || "بيانات مراجعة خاطئة"}) خلافاً لما طلبه العميل صراحة بصوته (${auditResult.orderReviewAudit.customerOriginalRequestSummary || "طلب العميل الأصلي"}).`}
                        </p>
                        {auditResult.orderReviewAudit.agentReviewSnippet && (
                          <div className="bg-white/80 p-2 rounded-lg border border-rose-200 mt-1 font-mono text-[11px] text-rose-900">
                            <span className="font-bold font-sans text-rose-800">ما قاله الزميل في المراجعة: </span>
                            {auditResult.orderReviewAudit.agentReviewSnippet}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Item Count Discrepancy Alert Box */}
                  {auditResult.itemCountDiscrepancyAlert && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-medium">{auditResult.itemCountDiscrepancyAlert}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Alerts List if any */}
              {auditResult.complianceAlerts && auditResult.complianceAlerts.length > 0 && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    تنبيهات الجودة والمطابقة المرصودة:
                  </h4>
                  <ul className="space-y-1.5 mr-5 list-disc text-xs text-rose-800">
                    {auditResult.complianceAlerts.map((alert: any, idx: number) => {
                      if (typeof alert === "string") {
                        return <li key={idx} className="font-medium">{alert}</li>;
                      }
                      if (alert && typeof alert === "object") {
                        const itemLabel = alert.item ? `[${alert.item}] ` : "";
                        const alertTypeLabel = alert.alertType ? `(${alert.alertType}) ` : "";
                        const text = alert.description || alert.message || alert.text || "";
                        return (
                          <li key={idx} className="font-medium">
                            {itemLabel && <span className="font-bold text-rose-900">{itemLabel}</span>}
                            <span>{text || alertTypeLabel || JSON.stringify(alert)}</span>
                          </li>
                        );
                      }
                      return <li key={idx} className="font-medium">{String(alert ?? "")}</li>;
                    })}
                  </ul>
                </div>
              )}

              {/* معيار تدقيق الفاتورة: خدمة التوصيل (لا تُحتسب كصنف) مع تنبيه مراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت */}
              {auditResult.deliveryServiceAudit && (
                <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-start md:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">خدمة التوصيل (الدليفري)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-300">
                          لا تُحتسب كصنف دوائي
                        </span>
                        {auditResult.deliveryServiceAudit.deliveryFee && auditResult.deliveryServiceAudit.deliveryFee !== "0" && (
                          <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                            {auditResult.deliveryServiceAudit.deliveryFee} ج.م
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-sky-950 font-semibold flex-wrap">
                        <AlertCircle className="w-4 h-4 text-sky-700 shrink-0" />
                        <span>{auditResult.deliveryServiceAudit.alert || "تنبيه: مراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت"}</span>
                        {auditResult.deliveryServiceAudit.receiptBranch && (
                          <span className="text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md border border-sky-200 font-medium">
                            الفرع المطبوع بالريسيت: {auditResult.deliveryServiceAudit.receiptBranch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-sky-700 bg-white/90 px-3 py-1.5 rounded-xl border border-sky-200 shrink-0 font-medium text-center">
                    معيار الجودة: استبعاد التوصيل من عدد الأصناف وتدقيق صحتها مع الفرع المطبوع
                  </div>
                </div>
              )}

              {/* Detailed Item Matching Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-teal-600" />
                    جدول مطابقة الأصناف وتوثيق موافقة العميل على البدائل
                  </h4>
                  <span className="text-xs text-slate-500">
                    إجمالي المفحوص: {auditResult.itemsAudit?.length || 0} صنف
                  </span>
                </div>

                <div className="divide-y divide-slate-100 overflow-x-auto">
                  {auditResult.itemsAudit && auditResult.itemsAudit.length > 0 ? (
                    auditResult.itemsAudit.map((item, idx) => {
                      const badge = getStatusBadge(item.status);
                      return (
                        <div key={idx} className="p-4 hover:bg-slate-50/60 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {item.customerRequestedItem}
                                </span>
                                {item.customerRequestedQuantity && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                                    طلب العميل: {item.customerRequestedQuantity}
                                  </span>
                                )}
                                {item.receiptQuantity && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                                    بالريسيت: {item.receiptQuantity}
                                  </span>
                                )}
                                {item.isQuantityMatched === false || item.quantityDiscrepancyAlert ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    خطأ في الكمية
                                  </span>
                                ) : item.isQuantityMatched === true && item.customerRequestedQuantity ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    الكمية مطابقة
                                  </span>
                                ) : null}
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                                  {badge.icon}
                                  {badge.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <span className="font-semibold text-slate-500">الصنف في الفاتورة:</span>
                                <span className="font-medium text-slate-800">
                                  {item.receiptItem || "لم يتوفر في الفاتورة"}
                                </span>
                                {item.unitPrice && (
                                  <span className="text-slate-500">({item.unitPrice} ج.م)</span>
                                )}
                              </div>
                            </div>

                            {/* Pharmacological Relation & Notes */}
                            {item.pharmacologicalRelation && (
                              <div className="text-xs bg-slate-100/70 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 max-w-xs">
                                <span className="font-semibold text-slate-500 block text-[10px]">العلاقة الصيدلانية:</span>
                                <span>{item.pharmacologicalRelation}</span>
                              </div>
                            )}
                          </div>

                          {/* Item Quantity Discrepancy Alert */}
                          {(item.isQuantityMatched === false || item.quantityDiscrepancyAlert) && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-[11px] text-rose-800">
                                  تنبيه خطأ في كمية الصنف المسجلة:
                                </span>
                                <span className="font-medium text-rose-900">
                                  {item.quantityDiscrepancyAlert ||
                                    `طلب العميل [${item.customerRequestedQuantity || "كمية محددة"}] بينما المسجل في الريسيت هو [${item.receiptQuantity || "كمية مختلفة"}]`}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Item Order Review Error Alert */}
                          {(item.isAgentReviewCorrect === false || item.orderReviewAlert) && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-[11px] text-amber-800">
                                  تنبيه خطأ في مراجعة وتأكيد الصنف مع العميل:
                                </span>
                                <span className="font-medium text-amber-900">
                                  {item.orderReviewAlert ||
                                    `راجع الزميل الصنف أو الكمية (${item.agentReviewedQuantityOrItem || "بشكل خاطئ"}) خلافاً لطلب العميل`}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Customer Consent Snippet */}
                          {item.consentSnippet && (
                            <div className="mt-3 p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 text-xs text-teal-900 flex items-start gap-2">
                              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold block text-[11px] text-teal-800">
                                  توثيق موافقة واستئذان العميل من المكالمة:
                                </span>
                                <span className="font-mono text-teal-950 font-medium">
                                  {item.consentSnippet}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Audit Notes */}
                          {item.auditNotes && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-600">ملاحظة التدقيق: </span>
                              {item.auditNotes}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      لم يتم العثور على أصناف مطابقة.
                    </div>
                  )}
                </div>
              </div>

              {/* Unrequested items in receipt if any */}
              {auditResult.unrequestedReceiptItems && auditResult.unrequestedReceiptItems.length > 0 && (
                <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-amber-600" />
                    أصناف إضافية موجودة في الريسيت لم يطلبها العميل:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {auditResult.unrequestedReceiptItems.map((extra, idx) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-amber-200 text-xs flex items-center justify-between">
                        <span className="font-medium text-slate-800">{extra.itemName}</span>
                        <span className="text-slate-500 text-[11px]">
                          {extra.totalPrice ? `${extra.totalPrice} ج.م` : "غير مسعر"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tesseract OCR Extracted Text Accordion */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowOcrText(!showOcrText)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/70 text-right flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-bold text-slate-800">
                      عرض النص المستخرج من الفاتورة
                    </span>
                    {auditResult.ocrConfidence && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        دقة القراءة: {auditResult.ocrConfidence}%
                      </span>
                    )}
                  </div>
                  {showOcrText ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {showOcrText && (
                  <div className="p-4 bg-slate-900 text-slate-100 font-mono text-xs whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed border-t border-slate-200">
                    {auditResult.receiptExtractedText || "لم يتم تسجيل نص مقروء إضافي."}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
          <span>نظام الرقابة الصيدلانية وضمان الجودة المعتمد</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* Expanded Image Modal */}
      {isImageExpanded && previewUrl && (
        <div 
          onClick={() => setIsImageExpanded(false)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewUrl}
              alt="Receipt Large"
              className="max-w-full max-h-[88vh] object-contain rounded-xl border border-white/20 shadow-2xl"
            />
            <button
              onClick={() => setIsImageExpanded(false)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
