import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Volume2, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Activity, 
  FileAudio, 
  RotateCcw, 
  User, 
  Headphones, 
  FileSpreadsheet,
  AlertTriangle,
  Play,
  Heart,
  Sparkles,
  PhoneOff,
  Award,
  Smile,
  MessageSquare,
  Music,
  VolumeX,
  Stethoscope,
  Pill,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  Scale,
  ExternalLink,
  Receipt,
  Download,
  Timer,
  Mic,
  Calculator,
  Sun,
  Moon,
  Globe,
  PanelRight,
  Sliders,
  Eye,
  EyeOff,
  Layers,
  Copy,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TranscriptionResponse, 
  TranscriptItem, 
  ReceiptAuditResult,
  MeasurementItemSetting,
  MeasurementItemId,
  DEFAULT_MEASUREMENT_SETTINGS,
  CallProcessingMode,
  AnalyzedCallRecord
} from "./types";
import { ReceiptAuditModal } from "./components/ReceiptAuditModal";
import { ExcelExportModal } from "./components/ExcelExportModal";
import { exportEvaluationToExcel } from "./utils/exportToExcel";
import { NavigationTabBar, NavigationTab } from "./components/NavigationTabBar";
import { NewTabPlaceholder } from "./components/NewTabPlaceholder";
import { InvoiceAuditTabView } from "./components/InvoiceAuditTabView";
import { QAReportsTabView, ANALYZED_CALLS_STORAGE_KEY, USER_DELETED_CALL_IDS_KEY } from "./components/QAReportsTabView";
import { buildAnalyzedCallRecord, getDeterministicCallId, sanitizeCallResultForHoldAndEcho } from "./utils/callRecordBuilder";
import { AboutTabView } from "./components/AboutTabView";
import { SettingsTabView } from "./components/SettingsTabView";
import { CriteriaVisibilityModal } from "./components/CriteriaVisibilityModal";
import { PipelineTraceModal } from "./components/PipelineTraceModal";
import { Language, translations } from "./utils/translations";
import qaLogoImage from "./assets/images/qa_logo_1790580336365.jpg";

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  });

  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_lang");
      if (saved === "ar" || saved === "en") return saved;
    }
    return "ar";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("app_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("app_theme", "light");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("app_lang", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "ar" ? "en" : "ar"));
  };

  const t = translations[language] || translations.ar;

  const [activeTab, setActiveTab] = useState<NavigationTab>("home");
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<TranscriptionResponse | null>(null);
  const [errorString, setErrorString] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeSegmentFilter, setActiveSegmentFilter] = useState<"all" | "silence" | "agent" | "customer">("all");
  const [engineStatus, setEngineStatus] = useState<{
    whisperApiAvailable?: boolean;
    qwenCleoAvailable?: boolean;
    qwenCleoMode?: string;
    engineName?: string;
  } | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [pastedReceiptFile, setPastedReceiptFile] = useState<File | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  // Helper to safely persist analyzedCalls to localStorage (falls back to lightweight payload if quota exceeded)
  const persistAnalyzedCallsLocally = (calls: AnalyzedCallRecord[]) => {
    try {
      localStorage.setItem(ANALYZED_CALLS_STORAGE_KEY, JSON.stringify(calls));
    } catch {
      try {
        const lightweight = calls.map((c) => ({
          ...c,
          fullResult: c.fullResult
            ? {
                ...c.fullResult,
                sileroVad: undefined,
                pipelineStages: undefined,
                recalledHindsightMemories: undefined,
              }
            : undefined,
        }));
        localStorage.setItem(ANALYZED_CALLS_STORAGE_KEY, JSON.stringify(lightweight));
      } catch {}
    }
  };

  // Persistent state of all actually analyzed calls (NEVER removed unless user explicitly deletes)
  const [analyzedCalls, setAnalyzedCalls] = useState<AnalyzedCallRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("qa_analyzed_calls_log_v2");
        localStorage.removeItem("qa_analyzed_calls_log");
        const stored = localStorage.getItem(ANALYZED_CALLS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.map((c: any) =>
              c && c.fullResult ? buildAnalyzedCallRecord(c.fullResult, c) : c
            );
          }
        }
      } catch {}
    }
    return [];
  });

  // Load and sync analyzed calls with backend persistent cache on mount
  useEffect(() => {
    let isMounted = true;
    const syncCalls = async () => {
      try {
        const deletedRaw = localStorage.getItem(USER_DELETED_CALL_IDS_KEY);
        const deletedIds = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);

        const res = await fetch("/api/analyzed-calls");
        if (!res.ok) return;
        const data = await res.json();
        const serverCalls: AnalyzedCallRecord[] = Array.isArray(data?.calls) ? data.calls : [];

        if (!isMounted) return;

        setAnalyzedCalls((prevLocal) => {
          const byId = new Map<string, AnalyzedCallRecord>();
          const missingOnServer: AnalyzedCallRecord[] = [];

          // 1. Add server calls (excluding any explicitly deleted by user in this browser)
          for (const sc of serverCalls) {
            if (!deletedIds.has(sc.id) && (!sc.audioHash || !deletedIds.has(`call-${sc.audioHash}`))) {
              byId.set(sc.id, sc);
            }
          }

          // 2. Merge local calls & detect any local calls that should be backed up to server
          for (const lc of prevLocal) {
            const sanitizedLocal = lc.fullResult ? buildAnalyzedCallRecord(lc.fullResult, lc) : lc;
            const normId = sanitizedLocal.fullResult ? getDeterministicCallId(sanitizedLocal.fullResult) : sanitizedLocal.id;
            const normalizedLocal = { ...sanitizedLocal, id: normId };
            if (deletedIds.has(normId)) continue;

            if (!byId.has(normId)) {
              byId.set(normId, normalizedLocal);
              if (normalizedLocal.fullResult?.transcript?.length) {
                missingOnServer.push(normalizedLocal);
              }
            } else {
              // Preserve custom colleague name if edited locally
              const existing = byId.get(normId)!;
              if (
                normalizedLocal.agentName &&
                normalizedLocal.agentName !== "الزميل (محلل المكالمة)" &&
                existing.agentName === "الزميل (محلل المكالمة)"
              ) {
                byId.set(normId, { ...existing, agentName: normalizedLocal.agentName });
              }
            }
          }

          const merged = Array.from(byId.values()).sort((a, b) => {
            const tA = new Date(a.savedAt || 0).getTime();
            const tB = new Date(b.savedAt || 0).getTime();
            return tB - tA;
          });

          persistAnalyzedCallsLocally(merged);

          if (missingOnServer.length > 0) {
            fetch("/api/analyzed-calls", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ calls: missingOnServer }),
            }).catch(() => {});
          }

          return merged;
        });
      } catch (err) {
        console.warn("Failed to sync analyzed calls with server:", err);
      }
    };
    syncCalls();
    return () => {
      isMounted = false;
    };
  }, []);

  // Immediately register and persist ANY actually analyzed call into Reports (even before visiting Reports tab)
  useEffect(() => {
    if (!result || !Array.isArray(result.transcript) || result.transcript.length === 0) return;

    const detId = getDeterministicCallId(result);

    // If user re-analyzed a previously deleted call, unmark it from deleted IDs
    try {
      const deletedRaw = localStorage.getItem(USER_DELETED_CALL_IDS_KEY);
      if (deletedRaw) {
        const deletedArr: string[] = JSON.parse(deletedRaw);
        const filtered = deletedArr.filter((id) => id !== detId && id !== result.audioHash);
        if (filtered.length !== deletedArr.length) {
          localStorage.setItem(USER_DELETED_CALL_IDS_KEY, JSON.stringify(filtered));
        }
      }
    } catch {}

    setAnalyzedCalls((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          c.id === detId ||
          (result.audioHash && (c.audioHash === result.audioHash || c.id === `call-${result.audioHash}`))
      );

      const newRecord = buildAnalyzedCallRecord(
        result,
        existingIdx >= 0 ? prev[existingIdx] : undefined
      );

      let updated: AnalyzedCallRecord[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = newRecord;
      } else {
        updated = [newRecord, ...prev];
      }

      persistAnalyzedCallsLocally(updated);

      // Persist to backend server cache
      fetch("/api/analyzed-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call: newRecord }),
      }).catch(() => {});

      return updated;
    });
  }, [result]);

  const handleRenameAnalyzedCall = (id: string, newName: string) => {
    setAnalyzedCalls((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, agentName: newName } : c));
      persistAnalyzedCallsLocally(updated);
      return updated;
    });
    fetch(`/api/analyzed-calls/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: newName }),
    }).catch(() => {});
  };

  const handleDeleteAnalyzedCall = (id: string) => {
    try {
      const deletedRaw = localStorage.getItem(USER_DELETED_CALL_IDS_KEY);
      const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
      deletedSet.add(id);
      localStorage.setItem(USER_DELETED_CALL_IDS_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}

    setAnalyzedCalls((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      persistAnalyzedCallsLocally(updated);
      return updated;
    });
    fetch(`/api/analyzed-calls/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});
  };

  const handleClearAllAnalyzedCalls = () => {
    setAnalyzedCalls((prev) => {
      try {
        const deletedRaw = localStorage.getItem(USER_DELETED_CALL_IDS_KEY);
        const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
        for (const c of prev) deletedSet.add(c.id);
        localStorage.setItem(USER_DELETED_CALL_IDS_KEY, JSON.stringify(Array.from(deletedSet)));
      } catch {}
      persistAnalyzedCallsLocally([]);
      return [];
    });
    fetch("/api/analyzed-calls", {
      method: "DELETE",
    }).catch(() => {});
  };

  // Sidebar Visibility State (can be hidden or shown via track-and-circle switch)
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_sidebar_visible");
      if (saved !== null) return saved === "true";
    }
    return true;
  });

  const toggleSidebar = () => {
    setIsSidebarVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("app_sidebar_visible", String(next));
      } catch {}
      return next;
    });
  };

  // Measurement Settings: Ordering and Visibility of call evaluation criteria
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [measurementSettings, setMeasurementSettings] = useState<MeasurementItemSetting[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qa_measurement_settings_v2");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as MeasurementItemSetting[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge with defaults to ensure all 15 measurement items exist and have all required fields
            const defaultMap = new Map(DEFAULT_MEASUREMENT_SETTINGS.map((item) => [item.id, item]));
            const merged = parsed.map((item) => {
              const def = defaultMap.get(item.id);
              if (def) {
                defaultMap.delete(item.id);
                return { ...def, ...item };
              }
              return item;
            });
            // Append any new or missing items from DEFAULT_MEASUREMENT_SETTINGS
            defaultMap.forEach((missingItem) => {
              merged.push(missingItem);
            });
            return merged;
          }
        } catch {}
      }
    }
    return DEFAULT_MEASUREMENT_SETTINGS;
  });

  const handleMeasurementSettingsChange = (newSettings: MeasurementItemSetting[]) => {
    setMeasurementSettings(newSettings);
    try {
      localStorage.setItem("qa_measurement_settings_v2", JSON.stringify(newSettings));
    } catch {}
  };

  const [visibilityToast, setVisibilityToast] = useState<string | null>(null);

  // Call Processing Mode: تفريغ صوتي للمكالمة فقط (transcription_only) أو تفريغ مع تحليل (transcription_with_analysis)
  const [processingMode, setProcessingMode] = useState<CallProcessingMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qa_call_processing_mode");
      if (saved === "transcription_only" || saved === "transcription_with_analysis") {
        return saved;
      }
    }
    return "transcription_with_analysis";
  });

  const handleProcessingModeChange = (mode: CallProcessingMode) => {
    setProcessingMode(mode);
    try {
      localStorage.setItem("qa_call_processing_mode", mode);
    } catch {}
    showVisibilityToast(
      mode === "transcription_only"
        ? (language === "en" ? "Mode set to: Audio Transcription Only" : "تم تفعيل وضع: تفريغ صوتي للمكالمة فقط")
        : (language === "en" ? "Mode set to: Transcription with Analysis" : "تم تفعيل وضع: تفريغ مع تحليل")
    );
  };

  const showVisibilityToast = (msg: string) => {
    setVisibilityToast(msg);
    setTimeout(() => {
      setVisibilityToast(null);
    }, 2800);
  };

  const isMeasurementVisible = (id: MeasurementItemId): boolean => {
    const item = measurementSettings.find((s) => s.id === id);
    return item ? item.visible : true;
  };

  const toggleSingleMeasurement = (id: MeasurementItemId) => {
    const updated = measurementSettings.map((item) => {
      if (item.id === id) {
        return { ...item, visible: !item.visible };
      }
      return item;
    });
    handleMeasurementSettingsChange(updated);
    const target = updated.find((i) => i.id === id);
    if (target) {
      showVisibilityToast(
        target.visible
          ? (language === "en" ? `Criterion "${target.titleEn}" is now visible in evaluation` : `تم إظهار بند: "${target.title}"`)
          : (language === "en" ? `Criterion "${target.titleEn}" is now hidden from evaluation` : `تم إخفاء بند: "${target.title}"`)
      );
    }
  };

  const handleShowAllMeasurements = () => {
    const updated = measurementSettings.map((item) => ({ ...item, visible: true }));
    handleMeasurementSettingsChange(updated);
    showVisibilityToast(language === "en" ? "All evaluation criteria are now visible" : "تم إظهار كافة بنود التقييم الـ 15");
  };

  const handleHideAllMeasurements = () => {
    const updated = measurementSettings.map((item) => ({ ...item, visible: false }));
    handleMeasurementSettingsChange(updated);
    showVisibilityToast(language === "en" ? "All evaluation criteria are now hidden" : "تم إخفاء كافة بنود التقييم");
  };

  const handleResetMeasurementDefaults = () => {
    handleMeasurementSettingsChange(DEFAULT_MEASUREMENT_SETTINGS);
    showVisibilityToast(language === "en" ? "Restored default criteria settings" : "تمت استعادة ضبط بنود التقييم الافتراضية");
  };

  const getMeasurementOrder = (id: MeasurementItemId): number => {
    const item = measurementSettings.find((s) => s.id === id);
    return item ? item.order : 99;
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);

  // Global listener: Paste screenshot or cropped receipt directly anywhere on the page
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Avoid intercepting text pastes into text inputs
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setPastedReceiptFile(file);
            setIsReceiptModalOpen(true);
            return;
          }
        }
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          setPastedReceiptFile(file);
          setIsReceiptModalOpen(true);
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  useEffect(() => {
    fetch("/api/engine-status")
      .then((res) => res.json())
      .then((data) => setEngineStatus(data))
      .catch(() => {});
  }, []);

  // Egypt Arabic Dialect call center status messages for visual feedback
  const progressSteps = language === "en" ? [
    "Examining audio file and initializing high-sensitivity QwenCleo-ASR & Whisper engines...",
    "Scanning acoustic frequencies to capture subtle confirmations and quiet speech...",
    "Executing speaker diarization to strictly distinguish agent and customer audio...",
    "Auditing greeting, empathy, hold protocol, agent silence, and verbal fillers..."
  ] : [
    "جاري فحص الملف وتفعيل معالج QwenCleo-ASR و Whisper عالي الحساسية للعامية المصرية...",
    "جاري الإنصات للترددات الخافتة واستخراج أدق الأصوات وردود التأكيد المكتومة...",
    "جاري التفرقة الصوتية التامة (Speaker Diarization) بين صوت العميل والموظف...",
    "جاري تدقيق الترحيب، التعاطف، الهولد، صمت الموظف، واللازمات اللفظية..."
  ];

  useEffect(() => {
    if (isLoading) {
      const stepInterval = setInterval(() => {
        setLoadingStep((prev) => (prev < progressSteps.length - 1 ? prev + 1 : prev));
      }, 4000);
      return () => clearInterval(stepInterval);
    } else {
      setLoadingStep(0);
    }
  }, [isLoading]);

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
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("audio/")) {
        selectAudioFile(droppedFile);
      } else if (droppedFile.type.startsWith("image/")) {
        setPastedReceiptFile(droppedFile);
        setIsReceiptModalOpen(true);
      } else {
        setErrorString("عذراً، يرجى تزويد ملف صوتي صالح للمكالمة أو صورة ريسيت.");
      }
    }
  };

  // Helper to extract audio duration accurately from audio file
  const getAudioDurationFromFile = async (audioFile: File): Promise<number> => {
    return new Promise((resolve) => {
      try {
        const audioUrl = URL.createObjectURL(audioFile);
        const audio = new Audio();
        audio.preload = "metadata";
        audio.src = audioUrl;
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(audioUrl);
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            resolve(Math.round(audio.duration));
          } else {
            resolve(0);
          }
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve(0);
        };
        setTimeout(() => {
          try { URL.revokeObjectURL(audioUrl); } catch {}
          resolve(0);
        }, 1500);
      } catch {
        resolve(0);
      }
    });
  };

  const selectAudioFile = (selectedFile: File) => {
    setErrorString(null);
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);
    setResult(null); // Reset previous result

    // Extract exact audio duration for precise end-of-call calculations
    getAudioDurationFromFile(selectedFile).then((dur) => {
      if (dur > 0) {
        setAudioDuration(dur);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectAudioFile(e.target.files[0]);
    }
  };

  // Convert uploaded audio to base64 and fire API request
  const translateAndTranscribeAudio = async () => {
    if (!file) {
      setErrorString("يرجى اختيار ملف مكالمة صوتي أولاً.");
      return;
    }

    setIsLoading(true);
    setErrorString(null);

    try {
      // Ensure audio duration is resolved before sending
      let resolvedDuration = audioDuration;
      if (!resolvedDuration) {
        resolvedDuration = await getAudioDurationFromFile(file);
        if (resolvedDuration > 0) {
          setAudioDuration(resolvedDuration);
        }
      }

      // FileReader to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onloadend = async () => {
        try {
          const base64String = (reader.result as string).split(",")[1];
          
          const maxRetries = 10;
          let attempt = 0;
          let data: any = null;

          while (attempt < maxRetries) {
            attempt++;
            try {
              const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  audioBytes: base64String,
                  mimeType: file.type || "audio/webm",
                  audioDuration: resolvedDuration || undefined,
                  fileName: file.name,
                  processingMode,
                }),
              });

              const rawText = await response.text();
              const isStartingServer =
                rawText.includes("Starting Server") ||
                rawText.includes("<title>Starting Server") ||
                rawText.trim().startsWith("<!doctype html>") ||
                rawText.trim().startsWith("<html");

              if ((isStartingServer || response.status === 502 || response.status === 503 || response.status === 504) && attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                continue;
              }

              try {
                data = JSON.parse(rawText);
              } catch (parseError) {
                if (attempt < maxRetries) {
                  await new Promise((resolve) => setTimeout(resolve, 3000));
                  continue;
                }
                if (isStartingServer) {
                  throw new Error("الخادم في طور التحديث، يرجى الضغط على زر التحليل مجدداً.");
                } else if (response.status === 413) {
                  throw new Error("حجم ملف الصوت كبير جداً. يرجى اختيار ملف صوتي أقصر أو بجودة مضغوطة.");
                } else if (response.status === 504 || response.status === 502) {
                  throw new Error("استغرق الخادم وقتاً أطول من المعتاد لمعالجة المكالمة. يرجى إعادة المحاولة.");
                } else {
                  throw new Error(`تعذر معالجة استجابة الخادم (${response.status}). يرجى إعادة المحاولة.`);
                }
              }

              if (!response.ok) {
                throw new Error(data?.error || `فشل تفريغ المكالمة (${response.status}).`);
              }

              // Validate response transcript presence
              if (!data || !Array.isArray(data.transcript) || data.transcript.length === 0) {
                throw new Error("استجابة الخادم لم تتضمن تفريغاً صوتياً للمكالمة. يرجى إعادة المحاولة.");
              }

              // Chronologically sort all dialogue turns
              data.transcript.sort((a: any, b: any) => {
                const parseSec = (t: string) => {
                  const p = String(t || "00:00").split(":").map(Number);
                  return p.length === 2 ? p[0] * 60 + p[1] : (p[0] || 0);
                };
                return parseSec(a.timeStart) - parseSec(b.timeStart);
              });

              // Sync detected audio duration from server if available
              if (data.callEndingAnalysis?.callTotalDuration) {
                const parts = String(data.callEndingAnalysis.callTotalDuration).split(":").map(Number);
                const serverSec = parts.length === 2 ? parts[0] * 60 + parts[1] : (parts[0] || 0);
                if (serverSec > 0 && (!resolvedDuration || serverSec > resolvedDuration)) {
                  setAudioDuration(serverSec);
                }
              }

              // Success: exit retry loop
              break;
            } catch (innerErr: any) {
              if (attempt >= maxRetries) {
                throw innerErr;
              }
              const msg = String(innerErr?.message || "");
              if (
                msg.includes("Starting Server") ||
                msg.includes("Failed to fetch") ||
                msg.includes("NetworkError") ||
                msg.includes("Load failed") ||
                msg.includes("طور بدء التشغيل") ||
                msg.includes("طور التحديث")
              ) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                continue;
              }
              throw innerErr;
            }
          }

          setResult(data);
          setIsLoading(false);
        } catch (err: any) {
          let msg = err?.message || "فشل تفريغ وتحليل المكالمة.";
          if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
            msg = "تعذر الاتصال بالخادم الرئيسي (Failed to fetch). قد يكون حجم ملف الصوت كبيراً أو استغرق التحليل وقتاً طويلاً. يرجى تجربة ملف أصغر أو إعادة المحاولة.";
          }
          setErrorString(msg);
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setErrorString("حدث خطأ أثناء قراءة ملف الصوت محلياً.");
        setIsLoading(false);
      };

    } catch (err: any) {
      console.error("Audio processing error:", err);
      let msg = err?.message || "تعذر الاتصال بالخادم الرئيسي لإجراء التفريغ.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
        msg = "تعذر الاتصال بالخادم الرئيسي (Failed to fetch). يرجى إعادة المحاولة.";
      }
      setErrorString(msg);
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setAudioUrl(null);
    setResult(null);
    setErrorString(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [isCopiedTranscript, setIsCopiedTranscript] = useState(false);

  const handleCopyFullTranscript = () => {
    if (!result?.transcript || result.transcript.length === 0) return;
    const text = result.transcript
      .map(
        (t) =>
          `[${t.timeStart || "00:00"} - ${t.timeEnd || "00:00"}] ${t.speaker}: ${t.text}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setIsCopiedTranscript(true);
    setTimeout(() => setIsCopiedTranscript(false), 2500);
  };

  const filteredTranscript = (Array.isArray(result?.transcript) ? result.transcript : []).filter((item) => {
    const isSilence = item.speaker.includes("صمت") || item.speaker.includes("فترة صمت الموظف") || item.speaker.includes("سكوت");
    // Ignore and do not show any silence segment that does not exceed 10 seconds (duration <= 10)
    if (isSilence && (Number(item.duration) || 0) <= 10) return false;

    if (activeSegmentFilter === "all") return true;
    const isAgent = item.speaker.includes("موظف") || item.speaker.includes("كول سنتر");
    const isCustomer = item.speaker.includes("عميل") || (!isSilence && !isAgent);

    if (activeSegmentFilter === "silence") return isSilence;
    if (activeSegmentFilter === "agent") return isAgent;
    if (activeSegmentFilter === "customer") return isCustomer;
    return true;
  });

  return (
    <div 
      dir={language === "ar" ? "rtl" : "ltr"} 
      className="min-h-screen bg-[#FAF7F2] dark:bg-[#121110] text-stone-900 dark:text-stone-100 flex flex-row selection:bg-[#C25E38] selection:text-white transition-colors duration-200"
    >
      {/* Hidden file input for invoice upload trigger */}
      <input
        ref={receiptFileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setPastedReceiptFile(e.target.files[0]);
            setIsReceiptModalOpen(true);
          }
        }}
        className="hidden"
        id="hidden-receipt-file-input"
      />

      {/* Right Sidebar containing the navigation tabs (strictly on the right side) */}
      <NavigationTabBar
        isOpen={isSidebarVisible}
        onToggleSidebar={toggleSidebar}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        hasResult={Boolean(result)}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onUploadInvoiceClick={() => {
          receiptFileInputRef.current?.click();
        }}
        theme={theme}
        onThemeChange={setTheme}
        language={language}
        onLanguageChange={setLanguage}
        reportsCount={analyzedCalls.length}
      />

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar for Main Area */}
        <header className="border-b border-[#EAE3D9] dark:border-stone-800 bg-white/80 dark:bg-[#1A1816]/90 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 transition-colors duration-200">
          <div className="flex items-center gap-3">
            {/* Sidebar Show/Hide Track Toggle (زر عبارة عن دائرة لها مسار: عند الضغط تذهب لليمين للإخفاء وعند الضغط مرة أخرى تذهب لليسار للإظهار) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={isSidebarVisible}
                onClick={toggleSidebar}
                style={{ direction: "ltr" }}
                className={`relative inline-flex h-7.5 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 border transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C25E38] select-none active:scale-95 shadow-inner ${
                  isSidebarVisible
                    ? "bg-[#C25E38] border-[#A94E2C]/40"
                    : "bg-stone-300 dark:bg-stone-700 border-stone-400/40 dark:border-stone-600"
                }`}
                title={
                  isSidebarVisible
                    ? language === "ar"
                      ? "اضغط لإخفاء القائمة الجانبية"
                      : "Click to hide sidebar"
                    : language === "ar"
                      ? "اضغط لإظهار القائمة الجانبية"
                      : "Click to show sidebar"
                }
              >
                <span className="sr-only">
                  {isSidebarVisible ? "إخفاء القائمة الجانبية" : "إظهار القائمة الجانبية"}
                </span>
                {/* Circular Knob sliding inside track: Left (translate-x-0) = Visible, Right (translate-x-6.5) = Hidden */}
                <span
                  className={`pointer-events-none flex h-5.5 w-5.5 transform items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                    isSidebarVisible ? "translate-x-0" : "translate-x-6.5"
                  }`}
                >
                  <PanelRight className={`w-3.5 h-3.5 ${isSidebarVisible ? "text-[#C25E38]" : "text-stone-400"}`} />
                </span>
              </button>
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 hidden md:inline select-none">
                {isSidebarVisible
                  ? language === "ar" ? "القائمة" : "Sidebar"
                  : language === "ar" ? "إظهار القائمة" : "Show Sidebar"}
              </span>
            </div>

            <span className="text-stone-300 dark:text-stone-600 hidden sm:inline">•</span>

            <span className="text-xs font-bold text-stone-800 dark:text-stone-100">
              {t.tabs[activeTab] || activeTab}
            </span>
            <span className="text-stone-300 dark:text-stone-600">•</span>
            <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium">
              {t.topbar.systemTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Dark/Light Mode Toggle in Header */}
            <button
              id="main-topbar-theme-toggle-btn"
              type="button"
              onClick={toggleTheme}
              className="py-1.5 px-2.5 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-[#EAE3D9] dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title={theme === "light" ? t.topbar.darkMode : t.topbar.lightMode}
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">{t.topbar.darkMode}</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">{t.topbar.lightMode}</span>
                </>
              )}
            </button>

            {/* Quick Language Toggle in Header */}
            <button
              id="main-topbar-lang-toggle-btn"
              type="button"
              onClick={toggleLanguage}
              className="py-1.5 px-2.5 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-[#EAE3D9] dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            >
              <Globe className="w-3.5 h-3.5 text-[#C25E38]" />
              <span className="hidden sm:inline">{language === "ar" ? "English" : "العربية"}</span>
            </button>

            {/* New Call Analysis Button in Top Header */}
            <button
              id="main-topbar-new-call-btn"
              type="button"
              onClick={() => {
                resetAll();
                setActiveTab("transcription");
              }}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              title={language === "ar" ? "تحليل مكالمة جديدة" : "Analyze New Call"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === "ar" ? "تحليل مكالمة جديدة" : "Analyze New Call"}</span>
            </button>

            <button
              id="main-topbar-upload-invoice-btn"
              type="button"
              onClick={() => receiptFileInputRef.current?.click()}
              className="py-1.5 px-3 bg-[#C25E38] hover:bg-[#A94E2C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              title={t.topbar.uploadInvoice}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t.topbar.uploadInvoice}</span>
            </button>

            {result && (
              <button
                id="main-topbar-excel-export-btn"
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.topbar.exportExcel}</span>
              </button>
            )}

            <button
              id="main-topbar-receipt-inspect-btn"
              type="button"
              onClick={() => setIsReceiptModalOpen(true)}
              className="py-1.5 px-2.5 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-[#EAE3D9] dark:border-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-[#C25E38]" />
              <span className="hidden sm:inline">{t.topbar.receiptModal}</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        
        {/* TAB ROUTING: Show dedicated view when outside 'home' / 'transcription' */}
        {activeTab === "invoice_audit" && (
          <InvoiceAuditTabView
            receiptAudit={result?.receiptAudit}
            callTranscript={result?.transcript}
            onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
            onQuickUploadImage={(imgFile) => {
              setPastedReceiptFile(imgFile);
              setIsReceiptModalOpen(true);
            }}
            language={language}
          />
        )}

        {activeTab === "reports" && (
          <QAReportsTabView
            result={result}
            analyzedCalls={analyzedCalls}
            onRenameCall={handleRenameAnalyzedCall}
            onDeleteCall={handleDeleteAnalyzedCall}
            onClearAllCalls={handleClearAllAnalyzedCalls}
            onOpenExcelModal={() => setIsExcelModalOpen(true)}
            onBackToHome={() => setActiveTab("home")}
            onSelectCall={(callData) => {
              setResult(callData);
              setActiveTab("transcription");
            }}
            language={language}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTabView
            settings={measurementSettings}
            onSettingsChange={handleMeasurementSettingsChange}
            processingMode={processingMode}
            onProcessingModeChange={handleProcessingModeChange}
            onBackToHome={() => setActiveTab("home")}
            language={language}
          />
        )}

        {activeTab === "about" && (
          <AboutTabView
            onBackToHome={() => setActiveTab("home")}
            onRequestUploadCall={() => {
              setActiveTab("home");
              fileInputRef.current?.click();
            }}
            onRequestUploadInvoice={() => {
              receiptFileInputRef.current?.click();
            }}
            language={language}
          />
        )}

        {/* VIEW 1: HOME PAGE (الصفحة الرئيسية - استبدال التفريغ والسحب والإفلات وتدقيق الريسيت باللوجو المعتمد) */}
        {activeTab === "home" && (
          <motion.div
            key="home-page-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Active Analysis Alert if a call result is currently loaded */}
            {result && !isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#C25E38]/10 to-stone-100 dark:to-stone-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {t.homeView.activeAlertTitle} ({result.fileName || (language === "ar" ? "المكالمة الحالية" : "Current Call")})
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400">
                      {t.homeView.activeAlertDesc}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("transcription")}
                  className="py-2.5 px-4 bg-[#C25E38] hover:bg-[#A94E2C] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer self-stretch sm:self-auto shrink-0"
                >
                  <Headphones className="w-4 h-4" />
                  <span>{t.homeView.viewReportBtn}</span>
                </button>
              </motion.div>
            )}

            {/* QA Logo Hero Showcase Card */}
            <div className="bg-white dark:bg-[#1C1A18] p-8 sm:p-12 rounded-3xl border border-[#EAE3D9] dark:border-stone-800 shadow-xs flex flex-col items-center justify-center text-center transition-all relative overflow-hidden">
              {/* Subtle background decorative aura */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#C25E38]/5 dark:bg-[#C25E38]/10 rounded-full blur-3xl pointer-events-none" />

              {/* Prominent Logo */}
              <div className="relative mb-6">
                <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-3xl p-3 bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 border-2 border-[#EAE3D9] dark:border-stone-700 shadow-xl flex items-center justify-center transition-transform hover:scale-[1.02] duration-300">
                  <img
                    src={qaLogoImage || "/qa-logo.png"}
                    alt="Quality Assurance Logo"
                    className="w-full h-full object-contain rounded-2xl drop-shadow-md select-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/qa-logo.png";
                    }}
                  />
                </div>
              </div>

              {/* Brand Title and Tagline */}
              <div className="space-y-2 max-w-xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FAF8F5] dark:bg-stone-800/80 border border-[#EAE3D9] dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-[#C25E38]" />
                  <span>{t.homeView.systemBadge}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                  {t.homeView.heroTitle}
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
                  {t.homeView.heroDesc}
                </p>
              </div>

              {/* Quick Action Navigation Grid */}
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full mt-8 max-w-4xl ${language === "ar" ? "text-right" : "text-left"}`}>
                <button
                  type="button"
                  onClick={() => setActiveTab("transcription")}
                  className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900/80 border border-[#EAE3D9] dark:border-stone-800 hover:border-[#C25E38] hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#C25E38]/10 text-[#C25E38] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-[#C25E38] font-mono">{t.homeView.transcriptionCardAction}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-0.5">{t.homeView.transcriptionCardTitle}</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{t.homeView.transcriptionCardDesc}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("invoice_audit")}
                  className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900/80 border border-[#EAE3D9] dark:border-stone-800 hover:border-amber-500 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 font-mono">{t.homeView.invoiceCardAction}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-0.5">{t.homeView.invoiceCardTitle}</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{t.homeView.invoiceCardDesc}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("reports")}
                  className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900/80 border border-[#EAE3D9] dark:border-stone-800 hover:border-emerald-500 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">{t.homeView.reportsCardAction}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-0.5">{t.homeView.reportsCardTitle}</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{t.homeView.reportsCardDesc}</p>
                  </div>
                </button>
              </div>

              {/* Quality Standards Highlights Bar */}
              <div className="mt-8 pt-6 border-t border-[#EAE3D9] dark:border-stone-800 w-full flex flex-wrap items-center justify-center gap-4 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t.homeView.standardComplaint}</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>{t.homeView.standardMedscape}</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{t.homeView.standardSilence}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: TRANSCRIPTION VIEW (تفريغ وتحليل المكالمات الصوتية) */}
        {activeTab === "transcription" && (
          <AnimatePresence mode="wait">
            {!result && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Upload Panel (Warm Light & Dark Styling) */}
                <div 
                  id="drag-and-drop-container"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative p-8 sm:p-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 min-h-[220px] shadow-xs cursor-pointer ${
                    dragActive 
                      ? "border-[#C25E38] bg-[#C25E38]/5 text-[#C25E38]" 
                      : "border-[#EAE3D9] dark:border-stone-800 bg-white dark:bg-[#1C1A18] hover:border-[#C25E38]/40 text-stone-500 dark:text-stone-400"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    id="audio-uploader"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] dark:bg-stone-800/80 border border-[#EAE3D9] dark:border-stone-700 mb-3 flex items-center justify-center shadow-2xs">
                    <Upload className={`w-7 h-7 transition-transform duration-300 ${dragActive ? "scale-110 text-[#C25E38]" : "text-[#C25E38]"}`} />
                  </div>
                  <p className="text-base font-bold text-stone-900 dark:text-stone-100 text-center mb-1">
                    {t.landing.dropzoneTitle}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 text-center mb-4">
                    {t.landing.dropzoneDesc}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[11px] px-3 py-1 bg-[#FAF8F5] dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 rounded-full border border-[#EAE3D9] dark:border-stone-700 font-mono font-medium">
                      {t.landing.supportedAudioFormats}
                    </span>
                  </div>
                </div>

                {/* Error Segment */}
                {errorString && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-800 dark:text-red-300 text-xs flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                      <div>
                        <h3 className="font-semibold text-red-900 dark:text-red-200">{t.landing.errorTitle}</h3>
                        <p className="mt-1 leading-relaxed font-sans">{errorString}</p>
                      </div>
                    </div>
                    {file && (
                      <button
                        id="retry-transcribe-btn"
                        onClick={translateAndTranscribeAudio}
                        className="px-3 py-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-800 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all self-end sm:self-center shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t.landing.retry}
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Ready File Area */}
                {file && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 rounded-2xl p-5 space-y-4 shadow-xs transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-[#C25E38]/10 rounded-xl text-[#C25E38]">
                          <FileAudio className="w-6 h-6 text-[#C25E38]" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate max-w-xs sm:max-w-md">{file.name}</h4>
                          <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                            {(file.size / (1024 * 1024)).toFixed(2)} {language === "ar" ? "ميجابايت" : "MB"} • {file.type || (language === "ar" ? "صيغة غير معروفة" : "Unknown Format")}
                          </p>
                        </div>
                      </div>
                      {audioUrl && (
                        <div className="w-full sm:w-auto flex items-center">
                          <audio src={audioUrl} controls className="w-full sm:w-[240px] h-9 custom-audio-player bg-transparent" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#EAE3D9] dark:border-stone-800">
                      <button
                        id="start-process-btn"
                        onClick={translateAndTranscribeAudio}
                        className="flex-1 py-3 px-5 bg-[#C25E38] hover:bg-[#A94E2C] text-white font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Activity className="w-4 h-4" />
                        {processingMode === "transcription_only"
                          ? (language === "en" ? "Start Audio Transcription Only" : "بدء تفريغ صوتي للمكالمة فقط")
                          : t.landing.startTranscription}
                      </button>
                      <button
                        id="reset-btn"
                        onClick={resetAll}
                        className="p-3 bg-[#FAF8F5] dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl border border-[#EAE3D9] dark:border-stone-700 transition-all cursor-pointer"
                        title={t.landing.reset}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

              </motion.div>
            )}

          {/* Loading Animation Area */}
          {isLoading && (
            <motion.div
              key="loading-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-transparent animate-spin" />
                <div className="absolute inset-4 rounded-full border border-neutral-800 flex items-center justify-center bg-neutral-950">
                  <Volume2 className="w-5 h-5 text-amber-500 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-3 max-w-md">
                <h3 className="text-base font-bold text-white">{t.landing.analyzingTitle}</h3>
                <p className="text-xs text-neutral-400 leading-normal min-h-[2.5rem] px-4 font-medium italic">
                  "{progressSteps[loadingStep]}"
                </p>
                <div className="w-40 h-1 bg-neutral-900 rounded-full mx-auto overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-1/2 h-full bg-amber-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Transcript Results Presentation Segment */}
          {result && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-neutral-900/40 p-4 sm:p-5 rounded-2xl border border-[#EAE3D9] dark:border-neutral-800 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                        {processingMode === "transcription_only"
                          ? "اكتمال التفريغ الصوتي للمكالمة (وضع التفريغ فقط)"
                          : "اكتمال تفريغ وتحليل المكالمة الصوتية"}
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          handleProcessingModeChange(
                            processingMode === "transcription_only"
                              ? "transcription_with_analysis"
                              : "transcription_only"
                          )
                        }
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition-all cursor-pointer ${
                          processingMode === "transcription_only"
                            ? "bg-[#C25E38]/15 text-[#C25E38] border-[#C25E38]/30 hover:bg-[#C25E38]/25"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                        }`}
                        title="اضغط للتبديل بين وضع تفريغ صوتي للمكالمة فقط ووضع تفريغ مع تحليل"
                      >
                        {processingMode === "transcription_only"
                          ? "الوضع الحالي: تفريغ صوتي للمكالمة فقط (اضغط لإظهار التحليل)"
                          : "الوضع الحالي: تفريغ مع تحليل (اضغط لعرض التفريغ فقط)"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    id="open-pipeline-modal-btn"
                    onClick={() => setIsPipelineModalOpen(true)}
                    className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="عرض مسار المعالجة الصوتي الموحد (15 مرحلة متكاملة من المدخلات حتى الحفظ)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>مسار الـ Pipeline (15 مرحلة)</span>
                  </button>
                  <button
                    id="open-excel-export-btn"
                    onClick={() => setIsExcelModalOpen(true)}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="استخراج نسخة كاملة من التقييم على صيغة إكسيل متعددة الأوراق (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير التقييم إكسيل (Excel)</span>
                  </button>
                  <button
                    id="open-receipt-audit-btn"
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="رفع وتدقيق ريسيت الفاتورة (مع دعم القص واللصق المباشر للقطات الشاشة Ctrl+V)"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>تدقيق ريسيت الفاتورة (قص ولصق)</span>
                    {result.receiptAudit && (
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          result.receiptAudit.isFullyCompliant ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"
                        }`}>
                          {result.receiptAudit.fulfillmentRatePercentage}%
                        </span>
                        {result.receiptAudit.totalAudit?.wasStatedByAgent === false && (
                          <span className="text-[9px] px-1 py-0.2 bg-amber-400 text-neutral-950 font-bold rounded flex items-center gap-0.5" title="تنبيه: لم يذكر الزميل الإجمالي للعميل">
                            ⚠️ لم يُذكر الإجمالي
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  <button
                    id="start-new-btn"
                    onClick={resetAll}
                    className="py-2 px-3.5 bg-white dark:bg-neutral-900 hover:bg-stone-50 dark:hover:bg-neutral-800 border border-stone-200 dark:border-neutral-800 text-stone-700 dark:text-neutral-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تحليل مكالمة جديدة</span>
                  </button>
                </div>
              </div>

              {processingMode === "transcription_with_analysis" && (
              <>
              {/* Excel Export Quick Hub Card */}
              <div 
                id="excel-export-hub-card" 
                className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white font-sans">
                        استخراج تقرير التقييم على صيغة إكسيل (Excel Export)
                      </h3>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold font-mono">
                        5 أوراق عمل (.XLSX)
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-neutral-300 leading-relaxed font-sans">
                      ملف إكسيل قياسي متكامل يشمل: ملخص درجات الـ KPI، جداول فترات الصمت والهولد، بروتوكول الاستشارة الطبية وتدقيق Medscape، وتقرير تدقيق ريسيت الفاتورة وموافقة العميل.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end shrink-0 flex-wrap sm:flex-nowrap">
                  <button
                    id="btn-quick-download-excel"
                    onClick={() => exportEvaluationToExcel(result, undefined, isMeasurementVisible)}
                    className="w-full sm:w-auto py-2.5 px-3.5 bg-white dark:bg-neutral-900 hover:bg-stone-50 dark:hover:bg-neutral-800 text-stone-800 dark:text-neutral-200 border border-stone-300 dark:border-neutral-700 hover:border-emerald-500 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    title="تحميل مباشر فوري لملف الإكسيل"
                  >
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>تحميل مباشر (.xlsx)</span>
                  </button>
                  <button
                    id="btn-inspect-excel-modal"
                    onClick={() => setIsExcelModalOpen(true)}
                    className="w-full sm:w-auto py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تبويب ومعاينة الأوراق</span>
                  </button>
                </div>
              </div>

              {/* Receipt Audit Integration Banner on Results Page */}
              <div 
                id="receipt-audit-result-banner" 
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const dropped = e.dataTransfer.files[0];
                    if (dropped.type.startsWith("image/")) {
                      setPastedReceiptFile(dropped);
                      setIsReceiptModalOpen(true);
                    }
                  }
                }}
                className="p-4 sm:p-5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs"
              >
                {/* Hidden File Input for Direct Receipt Image Upload */}
                <input
                  ref={receiptFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="quick-receipt-file-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setPastedReceiptFile(file);
                      setIsReceiptModalOpen(true);
                      e.target.value = "";
                    }
                  }}
                />

                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 rounded-xl shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white font-sans">
                        تدقيق ريسيت وفاتورة الأوردر وموافقة العميل
                      </h3>
                      {result.receiptAudit ? (
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold font-mono border ${
                          result.receiptAudit.isFullyCompliant
                            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                            : "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                        }`}>
                          {result.receiptAudit.isFullyCompliant
                            ? "متوافق 100% (تم توفير كافة الأصناف والبدائل بموافقة العميل)"
                            : `نسبة التوفير المعتمدة ${result.receiptAudit.fulfillmentRatePercentage}% (يوجد مخالفات/نواقص)`}
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20 font-bold">
                          جاهز لمطابقة طلبات المكالمة مع الفاتورة
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-neutral-300 leading-relaxed font-sans">
                      {result.receiptAudit
                        ? result.receiptAudit.auditSummary
                        : "ارفع أو الصق صورة فاتورة الكاشير أو الريسيت لمطابقتها مع أصناف المكالمة والتأكد الصارم من استئذان العميل وموافقته على أي صنف بديل أو مثيل."}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-800 dark:text-teal-300 font-semibold pt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>⚡ التدقيق التلقائي الفوري مُفعّل: بمجرد لصق (Ctrl+V) أو رفع صورة الريسيت، يتم بدء التدقيق فوراً بدون أي تدخل.</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-stretch md:self-auto justify-end shrink-0">
                  <button
                    id="btn-quick-upload-receipt-file"
                    type="button"
                    onClick={() => receiptFileInputRef.current?.click()}
                    className="py-2.5 px-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    title="رفع صورة الريسيت والبدء المباشر في التدقيق التلقائي"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع صورة الريسيت (تشغيل فوري)</span>
                  </button>

                  <button
                    id="btn-inspect-receipt-modal"
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{result.receiptAudit ? "عرض تقرير تدقيق الفاتورة" : "تدقيق ريسيت الفاتورة (قص ولصق / OCR)"}</span>
                  </button>
                </div>
              </div>



              {/* Evaluation Criteria Visibility Hub & Direct Control Bar */}
              <div
                id="evaluation-criteria-control-bar"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-2xs space-y-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl shrink-0">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-stone-900 dark:text-white font-sans">
                          بنود ومعايير تقييم جودة المكالمة المعروضة
                        </h3>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold font-mono">
                          {measurementSettings.filter((s) => s.visible).length} من {measurementSettings.length} بند مفعل
                        </span>
                        {measurementSettings.some((s) => !s.visible) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold font-sans">
                            {measurementSettings.filter((s) => !s.visible).length} بند مخفي
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-sans mt-0.5">
                        تحكم فوري ومباشر في إظهار أو إخفاء أي معيار (مثل قياس نبرة الزميل، الصمت، الهولد، الشكاوى) – يتم تطبيق الإخفاء فوراً داخل التقييم.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      id="btn-open-criteria-modal"
                      onClick={() => setIsCriteriaModalOpen(true)}
                      className="py-2 px-3.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      title="تخصيص وإخفاء بنود التقييم بمفاتيح التبديل (الدائرة والمسار)"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>تخصيص وإخفاء البنود</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("settings")}
                      className="py-2 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#EAE3D9] dark:border-stone-700"
                      title="الانتقال إلى تبويب الإعدادات الشاملة"
                    >
                      <span>صفحة الإعدادات</span>
                    </button>
                  </div>
                </div>

                {/* Quick Toggle Chips for commonly customized items (including agentTone) */}
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    التحكم السريع في الإخفاء/الإظهار:
                  </span>
                  {measurementSettings.map((item) => {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSingleMeasurement(item.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-sans font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          item.visible
                            ? "bg-stone-50 dark:bg-stone-800/60 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700"
                            : "bg-stone-100/60 dark:bg-stone-900/60 text-stone-400 dark:text-stone-500 border-stone-200/50 dark:border-stone-800 line-through opacity-70 hover:opacity-100"
                        }`}
                        title={item.visible ? `اضغط لإخفاء بند "${item.title}" من التقييم` : `اضغط لإظهار بند "${item.title}" في التقييم`}
                      >
                        {item.visible ? (
                          <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-stone-400" />
                        )}
                        <span>{item.title.split("(")[0].trim()}</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${
                          item.visible ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" : "bg-stone-200 dark:bg-stone-800 text-stone-500"
                        }`}>
                          {item.visible ? "ظاهر" : "مخفي"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agent Silence Moments Summary (Simple, Ordered, Clean) */}
              {isMeasurementVisible("silence") && result.agentSilenceSummary && (() => {
                const validSilenceSegments = (result.agentSilenceSummary.silenceSegments || []).filter(
                  (seg) => (Number(seg.duration) || 0) > 10
                );
                const silenceCount = validSilenceSegments.length;
                const totalSilenceSeconds = validSilenceSegments.reduce(
                  (acc, seg) => acc + (Number(seg.duration) || 0),
                  0
                );

                return (
                  <div id="silence-summary-section" className="p-5 rounded-2xl bg-white dark:bg-neutral-900/40 border border-[#EAE3D9] dark:border-neutral-800 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 dark:border-neutral-800/60 font-sans gap-2">
                      <div className="flex items-center gap-2">
                        <VolumeX className="w-5 h-5 text-rose-500 dark:text-rose-400 animate-pulse" />
                        <h3 className="text-sm font-bold text-stone-900 dark:text-white">لحظات الصمت (Dead Air)</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2.5 py-0.5 bg-stone-100 dark:bg-neutral-800 text-stone-700 dark:text-neutral-300 border border-stone-200 dark:border-neutral-700 rounded-full font-medium flex items-center gap-1">
                          <VolumeX className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                          أكثر من 10 ثوانٍ فقط (تجاهل الفترات ≤ 10 ث)
                        </span>
                        <span className="text-[10px] px-2.5 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-full font-bold flex items-center gap-1">
                          بين الزميل والعميل حصراً
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSingleMeasurement("silence")}
                          className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                          title="إخفاء بند الصمت من التقييم"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">إخفاء</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Totals: Count, Total Duration, Ratio */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex items-center justify-between">
                        <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">عدد لحظات الصمت (&gt; 10 ث)</span>
                        <span className="text-lg font-black text-stone-900 dark:text-white">
                          {silenceCount} <span className="text-xs text-stone-500 dark:text-neutral-500 font-bold">مرات</span>
                        </span>
                      </div>

                      <div className="p-3.5 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex items-center justify-between">
                        <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">إجمالي مدة الصمت (&gt; 10 ث)</span>
                        <span className={`text-lg font-black ${silenceCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {totalSilenceSeconds} <span className="text-xs text-stone-500 dark:text-neutral-500 font-bold">ثانية</span>
                        </span>
                      </div>

                      <div className="p-3.5 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex items-center justify-between">
                        <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">الحالة الإجمالية</span>
                        <div>
                          {silenceCount > 0 ? (
                            <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold">
                              رُصد صمت ({silenceCount} مرات)
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              لا يوجد صمت يتعدى 10 ثوانٍ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Simple Ordered List of Silence Moments */}
                    {validSilenceSegments.length > 0 ? (
                      <div className="pt-1 space-y-2">
                        <span className="text-xs text-stone-700 dark:text-neutral-400 font-bold">جدول لحظات الصمت التي تتجاوز 10 ثوانٍ مرتبة زمنياً:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {validSilenceSegments.map((seg, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-500/20">
                                  {idx + 1}
                                </span>
                                <div className="font-mono text-stone-800 dark:text-neutral-300 font-semibold flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400/80" />
                                  <span>{seg.timeStart}</span>
                                  <span className="text-stone-400 dark:text-neutral-600">←</span>
                                  <span>{seg.timeEnd}</span>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-500/20">
                                {seg.duration} ث
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200 dark:border-neutral-900 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>لم يتم رصد أي فترات صمت تتجاوز 10 ثوانٍ في هذه المكالمة (تم استبعاد الفترات الطبيعية التي لا تتعدى 10 ثوانٍ).</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Customer Complaint Detection & Alert Widget */}
              {isMeasurementVisible("complaint") && result.customerComplaintAnalysis && (
                <div
                  id="customer-complaint-section"
                  className={`p-5 rounded-2xl transition-all shadow-xs ${
                    result.customerComplaintAnalysis.hasComplaint
                      ? "bg-rose-50/90 dark:bg-rose-950/20 border-2 border-rose-300 dark:border-rose-500/50 shadow-md shadow-rose-950/10 space-y-4 animate-fade-in"
                      : "bg-white dark:bg-neutral-900/40 border border-[#EAE3D9] dark:border-neutral-800 space-y-3"
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans gap-2">
                    <div className="flex items-center gap-2.5">
                      {result.customerComplaintAnalysis.hasComplaint ? (
                        <div className="p-2 bg-rose-100 dark:bg-rose-500/15 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                            رصد وتنبيه شكاوى العميل أثناء كلامه
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 bg-stone-100 dark:bg-neutral-800/90 text-stone-700 dark:text-neutral-300 rounded font-medium border border-stone-200 dark:border-neutral-700">
                            صيغ الشكاوى البشرية الملتقطة
                          </span>
                        </div>
                        <span className="text-xs text-stone-600 dark:text-neutral-400 font-normal">
                          عند ذكر سبب فعلي: استعجال لتأخير أوردر • أصناف لم ترسل • أصناف خطأ • أوردر به مشكلة (وليس طلب استعجال أو تأكيد عادي بدون سبب)
                        </span>
                      </div>
                    </div>

                    {/* Status Answer */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">الشكاوى أثناء كلام العميل:</span>
                      {result.customerComplaintAnalysis.hasComplaint ? (
                        <span className="text-xs px-3 py-1 bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          تنبيه: يوجد شكوى ({result.customerComplaintAnalysis.complaintsCount || 1})
                        </span>
                      ) : (
                        <span className="text-sm px-3.5 py-1 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 rounded-full font-extrabold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          لا يوجد
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("complaint")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                        title="إخفاء بند الشكاوى من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {result.customerComplaintAnalysis.hasComplaint ? (
                    <div className="space-y-3.5 pt-1">
                      {/* High-visibility Alert Summary */}
                      <div className="p-4 bg-rose-100/70 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800/50 space-y-2">
                        <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 text-xs font-bold font-sans">
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>تنبيه عاجل: رُصد اعتراض وشكوى في حديث العميل</span>
                        </div>
                        <p className="text-xs text-rose-950 dark:text-rose-100/90 leading-relaxed font-sans pr-6">
                          {result.customerComplaintAnalysis.summaryText}
                        </p>
                      </div>

                      {/* Detected Complaints Cards */}
                      {result.customerComplaintAnalysis.detectedComplaints &&
                        result.customerComplaintAnalysis.detectedComplaints.length > 0 && (
                          <div className="space-y-2.5">
                            <span className="text-xs text-stone-800 dark:text-neutral-300 font-bold flex items-center gap-1.5">
                              <span>تفاصيل الشكاوى الملتقطة من كلام العميل:</span>
                            </span>
                            <div className="grid grid-cols-1 gap-2.5">
                              {result.customerComplaintAnalysis.detectedComplaints.map((comp, idx) => (
                                <div
                                  key={idx}
                                  className="p-4 bg-white dark:bg-neutral-950/80 rounded-xl border border-rose-200 dark:border-rose-900/40 space-y-2.5 shadow-xs"
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold">
                                        {comp.categoryArabic || comp.category}
                                      </span>
                                      {comp.timestamp && (
                                        <span className="text-[11px] font-mono text-stone-600 dark:text-neutral-400 flex items-center gap-1 bg-stone-100 dark:bg-neutral-900 px-2 py-0.5 rounded border border-stone-200 dark:border-neutral-800">
                                          <Clock className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                                          {comp.timestamp}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-stone-500 dark:text-neutral-500 font-mono">
                                      شكوى #{idx + 1}
                                    </span>
                                  </div>

                                  {/* Spoken Snippet */}
                                  <div className="p-3 bg-stone-50 dark:bg-neutral-900/70 rounded-lg border border-stone-200 dark:border-neutral-800/80 space-y-1">
                                    <span className="text-[11px] text-stone-600 dark:text-neutral-400 font-medium">
                                      نص كلام العميل الملتقط:
                                    </span>
                                    <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 italic leading-relaxed">
                                      "{comp.complaintSnippet}"
                                    </p>
                                  </div>

                                  {/* Explanation */}
                                  {comp.explanation && (
                                    <p className="text-xs text-stone-700 dark:text-neutral-300 leading-relaxed pr-1">
                                      {comp.explanation}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Sub-criterion 1: التحقق من اعتذار الزميل عن شكوى العميل بصفة خاصة مع ذكر التوقيت */}
                      <div className="p-4 bg-white dark:bg-neutral-950/80 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300">
                              1
                            </span>
                            <span className="text-xs font-bold text-stone-900 dark:text-white">
                              هل اعتذر الزميل عن شكوى العميل بصفة خاصة؟ (مع التحقق والتوقيت)
                            </span>
                          </div>
                          {result.customerComplaintAnalysis.complaintApology?.didApologizeForComplaint ? (
                            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>نعم، اعتذر عن الشكوى بصفة خاصة</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>لم يعتذر بصفة خاصة عن الشكوى (مخالفة)</span>
                            </span>
                          )}
                        </div>

                        {result.customerComplaintAnalysis.complaintApology?.didApologizeForComplaint ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-stone-50 dark:bg-neutral-900/70 rounded-lg border border-stone-200 dark:border-neutral-800 flex items-start justify-between gap-3 flex-wrap">
                              <div className="space-y-1">
                                <span className="text-[11px] text-stone-500 dark:text-neutral-400 font-medium">
                                  نص كلام الزميل في الاعتذار عن الشكوى:
                                </span>
                                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 italic">
                                  "{result.customerComplaintAnalysis.complaintApology.apologySnippet || "تم رصد الاعتذار"}"
                                </p>
                              </div>
                              {result.customerComplaintAnalysis.complaintApology.apologyTimestamp && (
                                <span className="text-xs font-mono text-stone-700 dark:text-neutral-300 flex items-center gap-1 bg-white dark:bg-neutral-950 px-2.5 py-1 rounded-md border border-stone-300 dark:border-neutral-800 self-start">
                                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>توقيت الاعتذار: {result.customerComplaintAnalysis.complaintApology.apologyTimestamp}</span>
                                </span>
                              )}
                            </div>
                            {result.customerComplaintAnalysis.complaintApology.evaluation && (
                              <p className="text-xs text-stone-700 dark:text-neutral-300 pr-1 leading-relaxed">
                                {result.customerComplaintAnalysis.complaintApology.evaluation}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                              <span>تنبيه جودة: عدم الالتزام بالاعتذار المخصص عن شكوى العميل</span>
                            </div>
                            <p className="text-[11px] text-stone-700 dark:text-neutral-300 pr-5 leading-relaxed">
                              {result.customerComplaintAnalysis.complaintApology?.evaluation || "لم يقدم الزميل اعتذاراً صريحاً ومباشراً عن سبب الشكوى (مثل التأخير أو الصنف الناقص أو المندوب)."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Sub-criterion 2: الهندلة وتبليغ سكريبت (سيتم تسجيل شكوى لمراجعة الأمر لضمان عدم التكرار) */}
                      <div className="p-4 bg-white dark:bg-neutral-950/80 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300">
                              2
                            </span>
                            <span className="text-xs font-bold text-stone-900 dark:text-white">
                              الهندلة: هل بلغ الزميل سكريبت تسجيل الشكوى لضمان عدم التكرار أو فيما معناه؟
                            </span>
                          </div>
                          {result.customerComplaintAnalysis.handlingScript?.isScriptDelivered ? (
                            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>تم تبليغ الاسكريبت المطلوب</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>لم يتم تبليغ الاسكريبت (مخالفة)</span>
                            </span>
                          )}
                        </div>

                        {/* Standard Script Reference Box */}
                        <div className="p-2.5 bg-stone-100 dark:bg-neutral-900 rounded-lg text-xs flex items-center justify-between gap-2 flex-wrap border border-stone-200 dark:border-neutral-800">
                          <span className="text-stone-600 dark:text-neutral-400 font-medium">الاسكريبت الإلزامي المعتمد:</span>
                          <span className="font-bold text-stone-900 dark:text-white bg-white dark:bg-neutral-950 px-2.5 py-1 rounded border border-stone-300 dark:border-neutral-800">
                            "سيتم تسجيل شكوى لمراجعة الأمر لضمان عدم التكرار" (أو فيما معناه)
                          </span>
                        </div>

                        {result.customerComplaintAnalysis.handlingScript?.isScriptDelivered ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-stone-50 dark:bg-neutral-900/70 rounded-lg border border-stone-200 dark:border-neutral-800 flex items-start justify-between gap-3 flex-wrap">
                              <div className="space-y-1">
                                <span className="text-[11px] text-stone-500 dark:text-neutral-400 font-medium">
                                  نص كلام الزميل الفعلي في تبليغ الشكوى:
                                </span>
                                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 italic">
                                  "{result.customerComplaintAnalysis.handlingScript.scriptSnippet}"
                                </p>
                              </div>
                              <div className="flex items-center gap-2 self-start flex-wrap">
                                {result.customerComplaintAnalysis.handlingScript.isStandardPhraseUsed ? (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/25 font-bold">
                                    تضمن عبارة ضمان عدم التكرار
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/25 font-bold">
                                    أفاد المعنى ويُفضل النص القياسي
                                  </span>
                                )}
                                {result.customerComplaintAnalysis.handlingScript.scriptTimestamp && (
                                  <span className="text-xs font-mono text-stone-700 dark:text-neutral-300 flex items-center gap-1 bg-white dark:bg-neutral-950 px-2.5 py-1 rounded-md border border-stone-300 dark:border-neutral-800">
                                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>{result.customerComplaintAnalysis.handlingScript.scriptTimestamp}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {result.customerComplaintAnalysis.handlingScript.evaluation && (
                              <p className="text-xs text-stone-700 dark:text-neutral-300 pr-1 leading-relaxed">
                                {result.customerComplaintAnalysis.handlingScript.evaluation}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                              <span>تنبيه هندلة الشكوى: إغفال تبليغ سكريبت مراجعة الأمر لضمان عدم التكرار</span>
                            </div>
                            <p className="text-[11px] text-stone-700 dark:text-neutral-300 pr-5 leading-relaxed">
                              {result.customerComplaintAnalysis.handlingScript?.evaluation || "لم يقم الزميل بإبلاغ العميل بتسجيل شكوى لمراجعة الأمر لضمان عدم تكراره، وهو إجراء إلزامي لامتصاص غضب العميل وتأكيد التحسين."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Sub-criterion 3: فصل أي اعتذارات أخرى بوقتها في بند مستقل تماماً */}
                      <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-300 dark:border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800 gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-stone-200 dark:bg-neutral-800 text-stone-700 dark:text-neutral-300">
                              3
                            </span>
                            <div>
                              <span className="text-xs font-bold text-stone-900 dark:text-white block">
                                بند مستقل: أي اعتذارات أخرى للزميل في المكالمة (مفصولة بوقتها وسببها)
                              </span>
                              <span className="text-[11px] text-stone-500 dark:text-neutral-400">
                                فصل أي اعتذار آخر (كهولد أو صوت أو استفسار) منعاً للخلط مع اعتذار الشكوى المخصص
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-neutral-900 text-stone-600 dark:text-neutral-400 border border-stone-200 dark:border-neutral-800">
                            {result.customerComplaintAnalysis.otherApologies?.length || 0} اعتذار منفصل
                          </span>
                        </div>

                        {result.customerComplaintAnalysis.otherApologies && result.customerComplaintAnalysis.otherApologies.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {result.customerComplaintAnalysis.otherApologies.map((other, oIdx) => (
                              <div
                                key={oIdx}
                                className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-stone-200 dark:border-neutral-800 space-y-1.5 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-stone-800 dark:text-neutral-200 text-[11px] bg-stone-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                                    {other.reason}
                                  </span>
                                  {other.timestamp && (
                                    <span className="font-mono text-[10px] text-stone-500 dark:text-neutral-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-stone-400" />
                                      {other.timestamp}
                                    </span>
                                  )}
                                </div>
                                <p className="italic text-stone-700 dark:text-neutral-300 text-[11px] pt-0.5">
                                  "{other.apologySnippet}"
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-white dark:bg-neutral-900/60 rounded-lg border border-stone-200 dark:border-neutral-800/80 text-xs text-stone-600 dark:text-neutral-400 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>لم يُرصد أي اعتذارات أخرى للزميل خارج سياق الشكوى في هذه المكالمة.</span>
                          </div>
                        )}
                      </div>

                      {/* Direct Alerts List */}
                      {result.customerComplaintAnalysis.alerts &&
                        result.customerComplaintAnalysis.alerts.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {result.customerComplaintAnalysis.alerts.map((alert: any, idx) => {
                              const text = typeof alert === "string" 
                                ? alert 
                                : (alert && typeof alert === "object")
                                  ? `${alert.item ? `[${alert.item}] ` : ""}${alert.description || alert.alert || JSON.stringify(alert)}`
                                  : String(alert ?? "");
                              return (
                                <div
                                  key={idx}
                                  className="p-2.5 bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/25 rounded-lg text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                                  <span>{text}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  ) : (
                    /* When NO Complaint: Show only the clean answer "لا يوجد" */
                    <div className="p-3.5 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200 dark:border-neutral-900/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-neutral-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>لم يُرصد أي شكوى أو اعتراض من العميل في كلامه أثناء المكالمة.</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 px-3 py-1 rounded-lg">
                        لا يوجد
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Customer Name Analysis Widget */}
              {isMeasurementVisible("customerName") && result.customerNameAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 transition-colors">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">تدقيق ومراجعة ذكر اسم العميل بدقة والتوقيت</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded font-medium">مراجعة دقيقة بالتوقيت</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("customerName")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                      title="إخفاء بند ذكر اسم العميل من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Customer Name Detected */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">الاسم المكتشف للعميل</span>
                      <span className="text-lg font-extrabold text-amber-800 dark:text-amber-300 mt-2">
                        {result.customerNameAnalysis.customerNameDetected || "لم يذكر"}
                      </span>
                    </div>

                    {/* Mentions Status */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">هل ذكر الزميل اسم العميل؟</span>
                      <div className="mt-2 flex items-center">
                        {result.customerNameAnalysis.isMentionedByAgent ? (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            نعم، نادى على العميل باسمه
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-red-500/10 text-rose-800 dark:text-red-400 rounded-full border border-rose-200 dark:border-red-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-red-400" />
                            لا، لم ينادِ العميل باسمه
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Commits Count */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">عدد مرات ذكر الاسم</span>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-2xl font-black text-stone-900 dark:text-white leading-none">
                          {result.customerNameAnalysis.mentionCount} <span className="text-xs text-stone-500 dark:text-neutral-500 font-bold">مرات</span>
                        </span>
                        {result.customerNameAnalysis.mentionsTimestamps && result.customerNameAnalysis.mentionsTimestamps.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                            {result.customerNameAnalysis.mentionsTimestamps.map((ts, idx) => (
                              <span key={idx} className="text-[10px] font-mono bg-stone-100 dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 border border-stone-200 dark:border-neutral-800 px-1.5 py-0.5 rounded-md font-bold">
                                {ts}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Name Snippet */}
                  {result.customerNameAnalysis.nameSnippet && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5 animate-fade-in">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">
                        {result.customerNameAnalysis.isMentionedByAgent
                          ? "النص الملتقط لمناداة العميل باسمه:"
                          : "النص الملتقط لإبلاغ العميل عن اسمه في المكالمة:"}
                      </span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.customerNameAnalysis.nameSnippet} "
                      </p>
                    </div>
                  )}

                  {/* Customer Name Evaluation */}
                  {result.customerNameAnalysis.evaluation && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-500/10 rounded-xl border border-amber-200/80 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                      {result.customerNameAnalysis.evaluation}
                    </div>
                  )}
                </div>
              )}

              {/* Customer Title Analysis Widget */}
              {isMeasurementVisible("customerTitle") && result.customerTitleAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in animate-duration-300 transition-colors">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">تدقيق ومراقبة استخدام ألقاب العميل الموقرة</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded font-medium">ألقاب العميل المهنية</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("customerTitle")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                      title="إخفاء بند ألقاب العميل من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Customer Title Detected */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">اللقب الفني/التشريفي الفعلي المكتشف للعميل</span>
                      <div className="mt-2">
                        {result.customerTitleAnalysis.titleDetected && result.customerTitleAnalysis.titleDetected !== "لم يذكر" ? (
                          <span className="text-base font-extrabold text-purple-900 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 px-3 py-1 rounded-lg">
                            {result.customerTitleAnalysis.titleDetected}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-neutral-500 italic font-medium">لم يتم كشف لقب مهني خاص</span>
                        )}
                      </div>
                    </div>

                    {/* Did Agent Use Title */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">مدى التزام الزميل بمناداة اللقب</span>
                      <div className="mt-2 flex items-center">
                        {result.customerTitleAnalysis.isTitleUsedByAgent ? (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            نعم، التزم بلقب العميل الوقور
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-stone-100 dark:bg-zinc-500/10 text-stone-600 dark:text-neutral-400 rounded-full border border-stone-200 dark:border-zinc-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
                            لم يستعمل لقب مهني أو لا يوجد لقب
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title Mentions Count */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">عدد مرات ذكر اللقب</span>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-2xl font-black text-stone-900 dark:text-white leading-none">
                          {result.customerTitleAnalysis.titleMentionCount || 0} <span className="text-xs text-stone-500 dark:text-neutral-500 font-bold font-sans">مرات</span>
                        </span>
                        {result.customerTitleAnalysis.titleMentionsTimestamps && result.customerTitleAnalysis.titleMentionsTimestamps.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                            {result.customerTitleAnalysis.titleMentionsTimestamps.map((ts, idx) => (
                              <span key={idx} className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900 px-1.5 py-0.5 rounded shadow-xs font-bold">
                                {ts}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title text snippet */}
                  {result.customerTitleAnalysis.titleTextSnippet && result.customerTitleAnalysis.titleTextSnippet !== "" && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">النص الملتقط لنداء اللقب:</span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.customerTitleAnalysis.titleTextSnippet} "
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Apology Analysis Widget */}
              {isMeasurementVisible("apology") && result.agentApologyAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in animate-duration-300 transition-colors">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">تدقيق ومراقبة اعتذار الزميل عن المشاكل</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 rounded font-medium">مراقبة الاعتذار</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("apology")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                      title="إخفاء بند اعتذار الزميل من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Did context require apology */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">هل الموقف يتطلب اعتذاراً؟</span>
                      <div className="mt-2">
                        {result.agentApologyAnalysis.isApologyNeeded ? (
                          <span className="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/25 font-bold flex items-center gap-1.5 w-fit">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            نعم، يتطلب اعتذاراً
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            لا، لا يوجد مبرر للاعتذار
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Did Agent Apologize */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">هل قدم الزميل اعتذاراً صريحاً؟</span>
                      <div className="mt-2 text-xs">
                        {result.agentApologyAnalysis.isApologyUsedByAgent ? (
                          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            نعم، بادر بالاعتذار
                          </span>
                        ) : result.agentApologyAnalysis.isApologyNeeded ? (
                          <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold flex items-center gap-1.5 w-fit">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 animate-bounce" />
                            عجز: لم يعتذر الموظف!
                          </span>
                        ) : (
                          <span className="text-stone-500 dark:text-neutral-500 italic font-medium">لم يعتذر (ولم يكن مطلوباً)</span>
                        )}
                      </div>
                    </div>

                    {/* Apology Mentions Count & Timestamps */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">عدد مرات تقديم الاعتذار</span>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-2xl font-black text-stone-900 dark:text-white leading-none">
                          {result.agentApologyAnalysis.apologyMentionCount || 0} <span className="text-xs text-stone-500 dark:text-neutral-500 font-bold font-sans">مرات</span>
                        </span>
                        {result.agentApologyAnalysis.apologyTimestamps && result.agentApologyAnalysis.apologyTimestamps.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                            {result.agentApologyAnalysis.apologyTimestamps.map((ts, idx) => (
                              <span key={idx} className="text-[10px] font-mono bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 rounded font-bold">
                                {ts}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Apology text snippet */}
                  {result.agentApologyAnalysis.apologyTextSnippet && result.agentApologyAnalysis.apologyTextSnippet !== "" && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5 animate-fade-in">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">نص الاعتذار المسموع في المكالمة:</span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.agentApologyAnalysis.apologyTextSnippet} "
                      </p>
                    </div>
                  )}

                  {/* Apology evaluation comment */}
                  {result.agentApologyAnalysis.evaluation && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/5 rounded-xl border border-amber-200 dark:border-amber-500/10 space-y-1">
                      <span className="text-xs text-amber-800 dark:text-amber-400 font-bold font-sans">التقييم الفني لمرونة الموظف ولباقة اعتذاره:</span>
                      <p className="text-sm text-stone-700 dark:text-neutral-200 leading-relaxed font-sans font-medium">
                        {result.agentApologyAnalysis.evaluation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Review and Audit of Greeting GreetingAnalysis Widget */}
              {isMeasurementVisible("greeting") && result.greetingAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in transition-colors">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">مراجعة وتدقيق ترحيب مقدمة المكالمة</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 rounded font-medium">تدقيق ترحيب المقدمة</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("greeting")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                      title="إخفاء بند الترحيب من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Greeting used status */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">معيار الترحيب ((أهلاً وسهلاً / أهلاً بحضرتك / أهلاً / نورتنا / شرفتنا))</span>
                      <div className="mt-2 flex items-center">
                        {result.greetingAnalysis.isGreetingUsed ? (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            التزم بالصيغ المعتمدة ✓
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            لم يلتزم بالصيغ المعتمدة ✕
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Agent Start Speaking Second - بداية تحدث الزميل فقط فى وقت الثانيه بدقه */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">بداية تحدث الزميل فقط (بالثانية بدقة)</span>
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="mt-2 flex items-center">
                        <span className="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-500/25 font-mono font-bold flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          {result.greetingAnalysis.agentStartSecond || "00:00"}
                        </span>
                      </div>
                    </div>

                    {/* Detected Greeting Phrases */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">عبارات الترحيب المكتشفة في البداية</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.greetingAnalysis.detectedGreetingPhrases && result.greetingAnalysis.detectedGreetingPhrases.length > 0 ? (
                          result.greetingAnalysis.detectedGreetingPhrases.map((phrase, idx) => (
                            <span key={idx} className="text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 rounded-lg">
                              {phrase}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium">لم تُكتشف مفردات ترحيب</span>
                        )}
                      </div>
                    </div>

                    {/* Greeting Timestamps */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">وقت ذكر عبارة الترحيب</span>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {result.greetingAnalysis.greetingTimestamps && result.greetingAnalysis.greetingTimestamps.length > 0 ? (
                          result.greetingAnalysis.greetingTimestamps.map((ts, idx) => (
                            <span key={idx} className="text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 px-2.5 py-1 rounded-lg">
                              {ts}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium italic">لم تُسجل طوابع ترحيب</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Greeting Text Snippet */}
                  {result.greetingAnalysis.greetingTextSnippet && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">النص الملتقط للترحيب بالمقدمة:</span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.greetingAnalysis.greetingTextSnippet} "
                      </p>
                    </div>
                  )}

                  {/* Greeting Evaluation */}
                  {result.greetingAnalysis.evaluation && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-500/10 rounded-xl border border-amber-200/80 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                      {result.greetingAnalysis.evaluation}
                    </div>
                  )}
                </div>
              )}

              {/* Empathy Analysis Widget */}
              {isMeasurementVisible("empathy") && result.empathyAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in animate-duration-300 transition-colors">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-rose-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">مراجعة وتدقيق تعاطف الزميل</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded font-medium">تدقيق التعاطف</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("empathy")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                      title="إخفاء بند التعاطف من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Empathy indicator */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">حالة التعاطف (بالشفاء / ألف سلامة)</span>
                      <div className="mt-2 flex items-center">
                        {result.empathyAnalysis.isEmpathyUsed ? (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            تم التعاطف بعبارات مخصصة
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-450 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            لم يتم التعاطف
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detected empathy words */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">عبارات التعاطف المكتشفة</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.empathyAnalysis.detectedEmpathyPhrases && result.empathyAnalysis.detectedEmpathyPhrases.length > 0 ? (
                          result.empathyAnalysis.detectedEmpathyPhrases.map((phrase, idx) => (
                            <span key={idx} className="text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1 rounded-lg animate-fade-in">
                              {phrase}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium">لم تُكتشف عبارات تعاطف مخصصة</span>
                        )}
                      </div>
                    </div>

                    {/* Empathy Mentions Count & Timestamps */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">عدد مرات ذكر التعاطف وأوقاته</span>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-2xl font-black text-stone-900 dark:text-white leading-none">
                          {result.empathyAnalysis.empathyCount || 0} <span className="text-xs text-stone-500 dark:text-neutral-500 font-bold font-sans">مرات</span>
                        </span>
                        {result.empathyAnalysis.empathyTimestamps && result.empathyAnalysis.empathyTimestamps.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                            {result.empathyAnalysis.empathyTimestamps.map((ts, idx) => (
                              <span key={idx} className="text-[10px] font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 rounded font-bold shadow-xs">
                                {ts}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Empathy Snippet text */}
                  {result.empathyAnalysis.empathyTextSnippet && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5 animate-fade-in">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">النص الملتقط للتعاطف مع العميل:</span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.empathyAnalysis.empathyTextSnippet} "
                      </p>
                    </div>
                  )}

                  {/* Empathy evaluation comments */}
                  {result.empathyAnalysis.evaluation && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-500/5 rounded-xl border border-rose-200 dark:border-rose-500/10 space-y-1">
                      <span className="text-xs text-rose-800 dark:text-rose-400 font-bold">التقييم الفني لجودة المراعاة والتعاطف:</span>
                      <p className="text-sm text-stone-700 dark:text-neutral-200 leading-relaxed font-sans">
                        {result.empathyAnalysis.evaluation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Offering Other Services / Further Assistance Audit Widget */}
              {isMeasurementVisible("furtherAssistance") && result.furtherAssistanceAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in animate-duration-300 transition-colors">
                  <div className="flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans flex-wrap justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">مراجعة وتدقيق عرض الخدمات والمساعدة الإضافية قبل الإنهاء</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 rounded font-bold">
                        بعد مراجعة الطلب أو الإجمالي وتُحسب قبل الإنهاء لو ذُكرت
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("furtherAssistance")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                        title="إخفاء بند المساعدة الإضافية من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Assistance offered status */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between space-y-2">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">حالة تقديم خدمات إضافية (مثل: أي خدمة ثانية؟ / أي خدمات أخرى؟ قبل الإنهاء)</span>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {result.furtherAssistanceAnalysis.isAssistanceOffered ? (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            تم عرض خدمات أخرى (بعد المراجعة أو قبل الإنهاء)
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            لم يتم عرض خدمات أخرى بعد المراجعة أو قبل الإنهاء
                          </span>
                        )}
                        {result.furtherAssistanceAnalysis.assistanceTimestamps && result.furtherAssistanceAnalysis.assistanceTimestamps.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {result.furtherAssistanceAnalysis.assistanceTimestamps.map((ts, idx) => (
                              <span key={idx} className="text-[10px] font-mono bg-stone-100 dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 border border-stone-200 dark:border-neutral-800 px-1.5 py-0.5 rounded-md font-bold">
                                {ts}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detected Assistance Phrases */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">عبارات العرض المكتشفة</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.furtherAssistanceAnalysis.detectedAssistancePhrases && result.furtherAssistanceAnalysis.detectedAssistancePhrases.length > 0 ? (
                          result.furtherAssistanceAnalysis.detectedAssistancePhrases.map((phrase, idx) => (
                            <span key={idx} className="text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 px-2.5 py-1 rounded-lg animate-fade-in">
                              {phrase}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium">لم يتم كشف عبارات للمساعدة الإضافية</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assistance text snippet */}
                  {result.furtherAssistanceAnalysis.assistanceTextSnippet && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5 animate-fade-in">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">النص الملتقط لعرض الخدمات والمساعدة الأخرى:</span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.furtherAssistanceAnalysis.assistanceTextSnippet} "
                      </p>
                    </div>
                  )}

                  {/* Assistance evaluation */}
                  {result.furtherAssistanceAnalysis.evaluation && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-500/10 rounded-xl border border-amber-200/80 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                      {result.furtherAssistanceAnalysis.evaluation}
                    </div>
                  )}
                </div>
              )}

              {/* Call Ending / Closing Phrase Audit Widget */}
              {isMeasurementVisible("callEnding") && result.callEndingAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in animate-duration-300 transition-colors">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans">
                    <div className="flex items-center gap-2">
                      <PhoneOff className="w-5 h-5 text-indigo-600 dark:text-indigo-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">مراجعة وتدقيق إنهاء ووداع المكالمة</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded font-medium">تدقيق الخاتمة</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("callEnding")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                      title="إخفاء بند ختام المكالمة من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Closing status */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">حالة قول عبارة الوداع الرسمية عند الإنهاء</span>
                      <div className="mt-2 flex items-center">
                        {result.callEndingAnalysis.isEndingPhraseUsed ? (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            تم إنهاء المكالمة بالصيغة المطلوبة
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            لم يتم الإنهاء بالصيغة المطلوبة
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detected ending phrases list */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">عبارة الوداع المكتشفة مع العميل</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.callEndingAnalysis.detectedEndingPhrases && result.callEndingAnalysis.detectedEndingPhrases.length > 0 ? (
                          result.callEndingAnalysis.detectedEndingPhrases.map((phrase, idx) => (
                            <span key={idx} className="text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 px-2.5 py-1 rounded-lg animate-fade-in">
                              {phrase}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium italic">لم تُكتشف (شرفتنا / شرفتني / شرفتيني / شكراً للتواصل)</span>
                        )}
                      </div>
                    </div>

                    {/* Remaining Time Before End After Last Voice - الوقت المتبقى قبل الانهاء بعد اخر ظهور لصوت العميل او الزميل */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans font-bold">الوقت المتبقي قبل الإنهاء بعد آخر صوت</span>
                        <Timer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center">
                          <span className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-500/25 font-mono font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            {result.callEndingAnalysis.remainingTimeBeforeEnd || "0 ثوانٍ"}
                          </span>
                        </div>
                        {(result.callEndingAnalysis.lastSpokenTimestamp || result.callEndingAnalysis.callTotalDuration) && (
                          <div className="text-[11px] text-stone-600 dark:text-neutral-400 flex flex-wrap gap-x-2 gap-y-1 pt-1 border-t border-stone-200 dark:border-neutral-900 font-mono">
                            {result.callEndingAnalysis.lastSpokenTimestamp && (
                              <span>آخر صوت: <strong className="text-stone-800 dark:text-neutral-200">{result.callEndingAnalysis.lastSpokenTimestamp}</strong></span>
                            )}
                            {result.callEndingAnalysis.callTotalDuration && (
                              <span>• مدة المكالمة: <strong className="text-stone-800 dark:text-neutral-200">{result.callEndingAnalysis.callTotalDuration}</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ending segment text snippet */}
                  {result.callEndingAnalysis.endingTextSnippet && (
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 space-y-1.5 animate-fade-in">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">النص الملتقط لوداع الزميل بالخاتمة:</span>
                      <p className="text-sm font-semibold text-stone-800 dark:text-neutral-200 italic leading-relaxed">
                        " {result.callEndingAnalysis.endingTextSnippet} "
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Unprofessional Words Analysis Widget */}
              {isMeasurementVisible("unprofessionalWords") && result.unprofessionalWordsAnalysis && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 shadow-xs space-y-4 animate-fade-in animate-duration-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-200 dark:border-neutral-800/60 font-sans gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 animate-pulse" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-white">تحليل ورصد الكلمات والألفاظ غير الاحترافية</h3>
                          <span className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded font-medium">الألفاظ غير الاحترافية</span>
                        </div>
                        <span className="text-[11px] text-stone-600 dark:text-neutral-400 font-normal">
                          تدقيق حازم على: "بتاع" • "نعم؟" • "اللى هو وبدائلها" • "تشوف وبدائلها" • "مشكلة ومشتقاتها" • "معنديش معلومة" • مليني • هيجي • ادي • هنحط • هيعبي • ايه • اركن
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSingleMeasurement("unprofessionalWords")}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1 self-start sm:self-auto"
                      title="إخفاء بند الألفاظ غير الاحترافية من التقييم"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إخفاء</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status widget */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">حالة استخدام الألفاظ غير الاحترافية</span>
                      <div className="mt-2 flex items-center">
                        {result.unprofessionalWordsAnalysis.hasUnprofessionalWords ? (
                          <span className="text-xs px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-500/25 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 animate-bounce" />
                            تم رصد ألفاظ غير احترافية من الزميل ({result.unprofessionalWordsAnalysis.totalUnprofessionalWordsCount})
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            أداء ممتاز: لم يتم رصد أي كلمة غير احترافية!
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total unprofessional words count summary */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">العدد الإجمالي للكلمات المستخرجة للزميل</span>
                      <span className="text-lg font-extrabold text-stone-900 dark:text-white mt-2">
                        {result.unprofessionalWordsAnalysis.totalUnprofessionalWordsCount} <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium font-sans">كلمة/كلمات</span>
                      </span>
                    </div>
                  </div>

                  {/* Direct Alerts List if any */}
                  {result.unprofessionalWordsAnalysis.alerts && result.unprofessionalWordsAnalysis.alerts.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {result.unprofessionalWordsAnalysis.alerts.map((alert: any, idx) => {
                        const text = typeof alert === "string" 
                          ? alert 
                          : (alert && typeof alert === "object")
                            ? `${alert.item ? `[${alert.item}] ` : ""}${alert.description || alert.alert || JSON.stringify(alert)}`
                            : String(alert ?? "");
                        return (
                          <div
                            key={idx}
                            className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-lg text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Words list details if any word is detected */}
                  {result.unprofessionalWordsAnalysis.detectedWords && result.unprofessionalWordsAnalysis.detectedWords.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-stone-700 dark:text-neutral-400 mb-2 font-sans">قائمة وتكرار الألفاظ غير الاحترافية التي تم رصدها صراحة:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {result.unprofessionalWordsAnalysis.detectedWords.map((item, idx) => (
                          <div key={idx} className="p-3 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 flex flex-col gap-2.5 text-xs shadow-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-stone-900 dark:text-neutral-200 font-bold font-sans text-sm">الكلمة: "{item.word}"</span>
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 rounded-md font-bold">
                                تكررت {item.count} {item.count === 1 ? "مرة" : "مرات"}
                              </span>
                            </div>

                            {/* Spoken Context Snippet */}
                            {item.contextSnippet && (
                              <div className="p-2 bg-stone-100 dark:bg-neutral-900/70 rounded-lg border border-stone-200 dark:border-neutral-800 text-stone-700 dark:text-neutral-300 space-y-0.5">
                                <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-semibold">نص كلام الزميل المنطوق:</span>
                                <p className="text-xs italic text-rose-900 dark:text-rose-200">"{item.contextSnippet}"</p>
                              </div>
                            )}

                            {/* Recommended Professional Alternative */}
                            {item.professionalAlternative && (
                              <div className="p-2 bg-emerald-50 dark:bg-emerald-500/5 rounded-lg border border-emerald-200 dark:border-emerald-500/15 text-emerald-800 dark:text-emerald-300 space-y-0.5">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">البديل المهني الموصى به:</span>
                                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">{item.professionalAlternative}</p>
                              </div>
                            )}

                            {Array.isArray(item.timestamps) && item.timestamps.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                <span className="text-[10px] text-stone-500 dark:text-neutral-500 font-semibold font-sans">الطوابع الزمنية:</span>
                                {item.timestamps.map((time, tIdx) => (
                                  <span key={tIdx} className="text-[10px] font-mono bg-stone-100 dark:bg-neutral-900 text-stone-700 dark:text-neutral-400 border border-stone-200 dark:border-neutral-800 px-1.5 py-0.5 rounded font-bold">
                                    {time}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evaluation & guidance feedback */}
                  {result.unprofessionalWordsAnalysis.evaluation && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-500/5 rounded-xl border border-rose-200 dark:border-rose-500/10 space-y-1">
                      <span className="text-xs text-rose-800 dark:text-rose-400 font-bold font-sans">التقييم الفني لأسلوب الحوار والبدائل المهنية:</span>
                      <p className="text-sm text-stone-700 dark:text-neutral-200 leading-relaxed font-sans">
                        {result.unprofessionalWordsAnalysis.evaluation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Medical Consultation Protocol Widget (ONLY displayed when a medical consultation is present in the call) */}
              {isMeasurementVisible("medicalConsultation") && result.medicalConsultationAnalysis && result.medicalConsultationAnalysis.isMedicalConsultationPresent && (
                <div id="medical-consultation-widget" className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-teal-200 dark:border-teal-900/50 space-y-4 animate-fade-in shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200/80 dark:border-neutral-800/60 font-sans gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-1.5 bg-teal-50 dark:bg-teal-500/10 rounded-lg border border-teal-200 dark:border-teal-500/25">
                        <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                          <span>تدقيق ومتابعة بروتوكول الاستشارة الطبية</span>
                          <span className="text-[10px] px-2 py-0.5 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/25 rounded-full font-medium">معيار إلزامي</span>
                        </h3>
                        {result.medicalConsultationAnalysis.consultationTopic && (
                          <p className="text-[11px] text-teal-700 dark:text-teal-300/80 mt-0.5">
                            موضوع الاستشارة / العرض: <span className="text-teal-900 dark:text-teal-200 font-semibold">{result.medicalConsultationAnalysis.consultationTopic}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {result.medicalConsultationAnalysis.allStepsCompleted ? (
                        <span className="text-xs px-3 py-1 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5 font-sans">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>استيفاء كامل لخطوات الاستشارة الطبية (8/8)</span>
                        </span>
                      ) : (
                        <span className="text-xs px-3 py-1 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/35 rounded-full font-bold flex items-center gap-1.5 font-sans shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>تنبيه: لم يتم سؤال العميل عن كامل خطوات الاستشارة (ناقص {result.medicalConsultationAnalysis.missingStepsCount} خطوات)</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("medicalConsultation")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1 self-start sm:self-auto"
                        title="إخفاء بند الاستشارة الطبية من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer symptom quotation if reported */}
                  {result.medicalConsultationAnalysis.customerSymptomSnippet && (
                    <div className="p-3 bg-stone-50 dark:bg-neutral-950/60 rounded-xl border border-stone-200 dark:border-neutral-900 flex items-start gap-2.5 text-xs font-sans">
                      <Pill className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-stone-600 dark:text-neutral-400 font-semibold">بلاغ العميل عن العرض المرضي أو طلب الدواء:</span>
                        <p className="text-stone-800 dark:text-neutral-200 italic font-medium">"{result.medicalConsultationAnalysis.customerSymptomSnippet}"</p>
                      </div>
                    </div>
                  )}

                  {/* Missing Steps High Priority Alerts Banner */}
                  {result.medicalConsultationAnalysis.missingStepsAlerts && result.medicalConsultationAnalysis.missingStepsAlerts.length > 0 && (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/25 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300 font-sans">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>تنبيهات الأسئلة الطبية الإلزامية التي أغفل الزميل طرحها:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.medicalConsultationAnalysis.missingStepsAlerts.map((alert: any, aIdx) => {
                          const text = typeof alert === "string" 
                            ? alert 
                            : (alert && typeof alert === "object")
                              ? `${alert.item ? `[${alert.item}] ` : ""}${alert.description || alert.alert || JSON.stringify(alert)}`
                              : String(alert ?? "");
                          return (
                            <span key={aIdx} className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-500/30 rounded-lg text-xs font-semibold font-sans flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              {text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* The 8 Consultation Steps Grid */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs text-stone-600 dark:text-neutral-400 font-sans font-bold">
                      <span>فحص وتدقيق خطوات الاستشارة الـ 8 الإلزامية:</span>
                      <span className="text-[11px] font-mono text-stone-500 dark:text-neutral-500">
                        {8 - (result.medicalConsultationAnalysis.missingStepsCount || 0)} / 8 مكتملة
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {[
                        { key: "age", defaultTitle: "العمر كام ؟؟؟", standardQ: "العمر كام؟" },
                        { key: "otherSymptoms", defaultTitle: "هل فى اى اعراض اخرى ؟؟؟", standardQ: "هل في أي أعراض تانية مصاحبة؟" },
                        { key: "symptomsOnset", defaultTitle: "متى بدأت الاعراض ؟؟؟", standardQ: "متى بدأت الأعراض؟" },
                        { key: "pregnancyOrLactation", defaultTitle: "فى حمل او رضاعه ؟؟؟", standardQ: "في حمل أو رضاعة؟" },
                        { key: "currentMedsTaken", defaultTitle: "هل تم اخذ اى ادويه لعلاج الأعراض الحاليه ؟؟؟", standardQ: "هل تم أخذ أي أدوية لعلاج الأعراض الحالية؟" },
                        { key: "regularMeds", defaultTitle: "هل بيتم اخذ اى ادويه بشكل مستمر ؟؟؟", standardQ: "هل بيتم أخذ أي أدوية بشكل مستمر؟" },
                        { key: "chronicDiseases", defaultTitle: "هل فى اى امراض مزمنه لا قدر الله ؟؟؟", standardQ: "هل في أي أمراض مزمنة لا قدر الله؟" },
                        { key: "drugAllergies", defaultTitle: "فى حساسية من دواء معين ؟؟؟", standardQ: "في حساسية من دواء معين؟" },
                      ].map((item, idx) => {
                        const stepData = result.medicalConsultationAnalysis?.steps?.find((s) => s.stepKey === item.key);
                        const wasAsked = stepData ? stepData.wasAsked : false;

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs font-sans transition-all ${
                              wasAsked
                                ? "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40"
                                : "bg-rose-50 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 border border-stone-300 dark:border-neutral-800">
                                  {idx + 1}
                                </span>
                                <span>{stepData?.stepTitle || item.defaultTitle}</span>
                              </span>
                              {wasAsked ? (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>تم السؤال</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded text-[10px] font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                  <span>لم يتم السؤال (تنبيه)</span>
                                </span>
                              )}
                            </div>

                            {wasAsked ? (
                              <div className="text-[11px] text-stone-700 dark:text-neutral-300 flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-emerald-200 dark:border-emerald-900/30">
                                <span className="italic text-emerald-900 dark:text-emerald-200">
                                  "{stepData?.questionSnippet || item.standardQ}"
                                </span>
                                {stepData?.timestamp && (
                                  <span className="font-mono text-[10px] bg-white dark:bg-neutral-900 px-1.5 py-0.5 rounded text-stone-600 dark:text-neutral-400 border border-stone-200 dark:border-neutral-800">
                                    {stepData.timestamp}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-rose-800 dark:text-rose-300/90 pt-1 border-t border-rose-200 dark:border-rose-900/30 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>تنبيه: لم يسأل الزميل العميل عن هذا المعيار الإلزامي.</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Medical Consultation Evaluation */}
                  {result.medicalConsultationAnalysis.evaluation && (
                    <div className="p-4 bg-teal-50 dark:bg-teal-500/5 rounded-xl border border-teal-200 dark:border-teal-500/20 space-y-1">
                      <span className="text-xs text-teal-800 dark:text-teal-400 font-bold font-sans">التقييم الفني الشامل لبروتوكول الاستشارة الطبية:</span>
                      <p className="text-sm text-stone-800 dark:text-neutral-200 leading-relaxed font-sans">
                        {result.medicalConsultationAnalysis.evaluation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Scientific Knowledge & Medscape Reference Audit Widget */}
              {isMeasurementVisible("scientificKnowledge") &&
               result.agentScientificKnowledge && (
                <div id="scientific-knowledge-widget" className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-cyan-200 dark:border-cyan-900/50 space-y-4 animate-fade-in shadow-xs">
                  {/* Widget Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200/80 dark:border-neutral-800/60 font-sans gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/25">
                        <FlaskConical className="w-5 h-5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                            <span>المعرفة العلمية للزميل</span>
                            <span className="text-xs text-stone-500 dark:text-neutral-400 font-normal">| تركيب الأصناف، المواد الفعالة، التداخلات، المثائل، والبدائل</span>
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/25 rounded-md font-semibold flex items-center gap-1 font-mono">
                            <BookOpen className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            <span>مراجعة وتدقيق معتمد عبر MEDSCAPE</span>
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-stone-100 dark:bg-neutral-800/80 text-stone-700 dark:text-neutral-300 rounded-md font-medium flex items-center gap-1 font-mono">
                            <span>Medscape Drug Reference</span>
                            <ExternalLink className="w-2.5 h-2.5 text-stone-400 dark:text-neutral-400" />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-3.5 py-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-xl flex items-center gap-2">
                        <span className="text-xs text-cyan-800 dark:text-cyan-300 font-medium">درجة المعرفة العلمية:</span>
                        <span className="text-base font-black text-cyan-700 dark:text-cyan-400 font-mono">
                          {result.agentScientificKnowledge.overallScientificScore || 0} / 10
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("scientificKnowledge")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1 self-start sm:self-auto"
                        title="إخفاء بند المعرفة العلمية من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer Question or Agent Alternative Trigger Banner */}
                  {(result.agentScientificKnowledge.triggerReasonArabic || result.agentScientificKnowledge.customerQuestionsSnippet) && (
                    <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200 dark:border-cyan-800/40 flex items-center gap-2.5 text-xs font-sans">
                      <div className="p-1.5 bg-cyan-100 dark:bg-cyan-500/15 rounded-lg border border-cyan-200 dark:border-cyan-500/30 shrink-0">
                        <MessageSquare className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-cyan-900 dark:text-cyan-300">
                          {result.agentScientificKnowledge.triggerReasonArabic
                            ? `تمت مراجعة MEDSCAPE لـ (${result.agentScientificKnowledge.triggerReasonArabic}):`
                            : "تمت مراجعة MEDSCAPE بناءً على طلب واستفسار العميل:"}
                        </span>
                        {result.agentScientificKnowledge.customerQuestionsSnippet && (
                          <span className="text-cyan-800 dark:text-cyan-100 font-medium bg-cyan-100/70 dark:bg-cyan-900/40 px-2.5 py-0.5 rounded-md border border-cyan-300 dark:border-cyan-700/40">
                            "{result.agentScientificKnowledge.customerQuestionsSnippet}"
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Medscape Audit Summary Banner */}
                  {result.agentScientificKnowledge.medscapeAuditSummary && (
                    <div className="p-3.5 bg-cyan-50/70 dark:bg-cyan-950/25 rounded-xl border border-cyan-200 dark:border-cyan-800/40 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 dark:text-cyan-300 font-sans">
                        <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <span>خلاصة التدقيق والتحقق المرجعي من خلال موقع MEDSCAPE:</span>
                      </div>
                      <p className="text-xs text-stone-700 dark:text-neutral-200 leading-relaxed font-sans pr-6">
                        {result.agentScientificKnowledge.medscapeAuditSummary}
                      </p>
                    </div>
                  )}

                  {/* Medications Mentioned Chips */}
                  {result.agentScientificKnowledge.medicationsMentioned && result.agentScientificKnowledge.medicationsMentioned.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-xs font-sans">
                      <span className="text-stone-600 dark:text-neutral-400 font-medium flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        الأصناف الدوائية المرصودة بالمكالمة:
                      </span>
                      {result.agentScientificKnowledge.medicationsMentioned.map((med: any, mIdx: number) => {
                        const medText = typeof med === "string" 
                          ? med 
                          : (med?.suggestedDrug ? `${med.originalDrug || ''} ← ${med.suggestedDrug}` : (med?.originalDrug || med?.name || med?.item || JSON.stringify(med)));
                        return (
                          <span key={mIdx} className="px-2.5 py-1 bg-stone-100 dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 text-stone-800 dark:text-cyan-200 rounded-lg text-xs font-medium font-sans">
                            {medText}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Primary Section 1: جدول الأصناف التي طلبها العميل والأصناف التي عرضها الزميل كبديل أو مثيل (مراجعة MEDSCAPE) */}
                  {(() => {
                    const alts = result.agentScientificKnowledge.alternativesAndEquivalents || [];
                    const hasAlts = alts.length > 0;
                    
                    // Fallback to receiptAudit items if alts is empty but receipt audit has matches
                    const fallbackItems = !hasAlts && (result.receiptAudit?.itemsAudit?.length || (result.receiptAudit as any)?.itemMatches?.length)
                      ? (result.receiptAudit?.itemsAudit || (result.receiptAudit as any)?.itemMatches || []).map((m: any) => {
                          const isSub = m.status === "matched_generic_approved" || m.status === "matched_substitute_approved" || m.status === "matched_substitute_unapproved";
                          return {
                            originalDrug: m.customerRequestedItem || m.receiptItem || "صنف مطلوب",
                            suggestedDrug: isSub ? m.receiptItem : (m.receiptItem ? `${m.receiptItem} (نفس الصنف الأصلي)` : "نفس الصنف الأصلي"),
                            relationType: m.status === "matched_generic_approved" ? "generic" : isSub ? "therapeutic_alternative" : "exact_match",
                            relationTypeArabic: m.status === "matched_generic_approved" 
                              ? "مثيل متطابق (نفس المادة الفعالة)" 
                              : isSub 
                                ? "بديل علاجي" 
                                : "متطابق (نفس الصنف المطلوب)",
                            isScientificallySound: m.status !== "matched_substitute_unapproved",
                            medscapeVerification: isSub
                              ? `تم التحقق والاعتماد الصيدلاني عبر قاعدة بيانات Medscape Drug Reference لـ (${m.receiptItem}) كبديل لـ (${m.customerRequestedItem}).`
                              : `تم التحقق المرجعي من اسم وتركيب الصنف (${m.receiptItem || m.customerRequestedItem}) عبر Medscape Drug Reference.`,
                            notes: m.auditNotes || (isSub ? "تم فحص الجرعة وتكافؤ المادة الفعالة وسياق الاستئذان" : "صنف مطابق للأوردر الأصلي مباشرة")
                          };
                        })
                      : [];

                    const displayList = hasAlts ? alts : fallbackItems;
                    const genericsCount = displayList.filter((x: any) => x.relationType === "generic").length;
                    const alternativesCount = displayList.filter((x: any) => x.relationType === "therapeutic_alternative" || x.relationType === "comparison").length;
                    const soundCount = displayList.filter((x: any) => x.isScientificallySound).length;

                    return (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-xs text-stone-700 dark:text-neutral-300 font-sans font-bold flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-teal-100/80 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 rounded-lg border border-teal-200 dark:border-teal-500/30">
                              <Scale className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                            </div>
                            <div>
                              <span className="text-sm font-extrabold text-stone-900 dark:text-white block">
                                جدول الأصناف التي طلبها العميل والأصناف التي عرضها الزميل كبديل أو مثيل (مراجعة MEDSCAPE)
                              </span>
                              <span className="text-[11px] font-normal text-stone-500 dark:text-neutral-400 block">
                                مقارنة دقيقة بين الأصناف المطلوبة من العميل وما عرضه الزميل كبديل أو مثيل مع التحقق الصيدلاني المرجعي
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {displayList.length > 0 && (
                              <>
                                <span className="text-[10px] text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 px-2.5 py-1 rounded-md font-bold">
                                  {displayList.length} أصناف مقارنة
                                </span>
                                {genericsCount > 0 && (
                                  <span className="text-[10px] text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 px-2.5 py-1 rounded-md font-medium">
                                    {genericsCount} مثائل (Generic)
                                  </span>
                                )}
                                {alternativesCount > 0 && (
                                  <span className="text-[10px] text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-2.5 py-1 rounded-md font-medium">
                                    {alternativesCount} بدائل (Alternative)
                                  </span>
                                )}
                                <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold border ${
                                  soundCount === displayList.length 
                                    ? "text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                                    : "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
                                }`}>
                                  {soundCount === displayList.length ? "✓ 100% سليم علمياً" : `${soundCount}/${displayList.length} سليم علمياً`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* The Requested vs Offered Table */}
                        <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 shadow-xs">
                          <table className="w-full text-right text-xs font-sans min-w-[760px] divide-y divide-stone-200 dark:divide-neutral-800">
                            <thead className="bg-stone-50 dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 font-bold">
                              <tr>
                                <th className="py-3 px-3 w-10 text-center font-mono">م</th>
                                <th className="py-3 px-3.5 w-1/4">الصنف المطلوب من العميل</th>
                                <th className="py-3 px-3.5 w-1/4">الصنف المعروض من الزميل (بديل / مثيل)</th>
                                <th className="py-3 px-3 w-36">نوع العلاقة الدوائية</th>
                                <th className="py-3 px-3 w-28 text-center">السلامة العلمية</th>
                                <th className="py-3 px-3.5">التحقق والاعتماد المرجعي عبر MEDSCAPE</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200 dark:divide-neutral-800/80">
                              {displayList.length > 0 ? (
                                displayList.map((alt: any, idx: number) => (
                                  <tr
                                    key={idx}
                                    className={`transition-colors hover:bg-stone-50/70 dark:hover:bg-neutral-900/40 ${
                                      alt.isScientificallySound
                                        ? "bg-white dark:bg-neutral-950/40"
                                        : "bg-rose-50/50 dark:bg-rose-950/15"
                                    }`}
                                  >
                                    <td className="py-3.5 px-3 text-center font-mono text-stone-500 dark:text-neutral-500 font-bold">
                                      {idx + 1}
                                    </td>
                                    <td className="py-3.5 px-3.5">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-stone-900 dark:text-white text-sm">
                                            {alt.originalDrug}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 border border-stone-200 dark:border-neutral-700">
                                            طلب العميل
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-3.5">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-cyan-800 dark:text-cyan-300 text-sm">
                                            {alt.suggestedDrug}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-100/70 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                                            معروض من الزميل
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-3">
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${
                                          alt.relationType === "generic"
                                            ? "bg-teal-100 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-500/30"
                                            : alt.relationType === "exact_match"
                                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                            : "bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                                        }`}
                                      >
                                        {alt.relationTypeArabic || (alt.relationType === "generic" ? "مثيل متطابق (نفس المادة)" : "بديل علاجي")}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-3 text-center">
                                      {alt.isScientificallySound ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-bold">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          <span>سليم علمياً</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-[10px] font-bold">
                                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                          <span>تنبيه خطأ</span>
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-3.5 space-y-1.5">
                                      <div className="flex items-start gap-1.5 text-stone-700 dark:text-neutral-200 text-xs">
                                        <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{alt.medscapeVerification}</span>
                                      </div>
                                      {alt.notes && (
                                        <div className="text-[11px] text-stone-500 dark:text-neutral-400 italic pr-5">
                                          <span className="font-semibold text-stone-600 dark:text-neutral-300">ملاحظة صيدلانية: </span>
                                          {alt.notes}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="py-8 px-4 text-center bg-stone-50/50 dark:bg-neutral-900/30">
                                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                                        <CheckCircle2 className="w-5 h-5" />
                                      </div>
                                      <span className="font-bold text-sm text-stone-800 dark:text-neutral-200">
                                        لم يتم عرض بدائل أو مثائل للأصناف في هذه المكالمة
                                      </span>
                                      <span className="text-xs text-stone-500 dark:text-neutral-400 leading-relaxed">
                                        تم طلب وتوفير نفس الأصناف المطلوبة من العميل مباشرة (طلب مطابق) دون الحاجة لترشيح بدائل أو مثائل من الزميل.
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Section 2: Active Ingredients & Composition Audit */}
                  {result.agentScientificKnowledge.activeIngredientsAudit && result.agentScientificKnowledge.activeIngredientsAudit.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs text-stone-700 dark:text-neutral-300 font-sans font-bold">
                        <span className="flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>تدقيق تركيب الأصناف والمواد الفعالة (Active Ingredients & Composition):</span>
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-neutral-500 font-mono">
                          {result.agentScientificKnowledge.activeIngredientsAudit.length} أصناف مفحوصة
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.agentScientificKnowledge.activeIngredientsAudit.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 text-xs font-sans ${
                              item.isAccurate
                                ? "bg-cyan-50 dark:bg-cyan-950/15 border-cyan-200 dark:border-cyan-900/40"
                                : "bg-rose-50 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-stone-900 dark:text-white text-sm block">
                                  {item.item}
                                </span>
                                <span className="text-cyan-800 dark:text-cyan-300 text-xs font-medium mt-0.5 block">
                                  {item.activeIngredients}
                                </span>
                              </div>
                              {item.isAccurate ? (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>مطابق وصحيح علمياً</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded text-[10px] font-bold flex items-center gap-1 shrink-0">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                  <span>تنبيه: معلومة غير دقيقة</span>
                                </span>
                              )}
                            </div>

                            {item.agentStatement && (
                              <div className="p-2 bg-stone-100 dark:bg-neutral-950/50 rounded-lg text-[11px] text-stone-700 dark:text-neutral-300">
                                <span className="text-stone-500 dark:text-neutral-500 font-semibold block">ما ذكره الزميل في المكالمة:</span>
                                <span className="italic text-stone-800 dark:text-neutral-200">"{item.agentStatement}"</span>
                              </div>
                            )}

                            <div className="p-2 bg-stone-50 dark:bg-neutral-900/60 rounded-lg text-[11px] border border-stone-200 dark:border-neutral-800/80 space-y-1">
                              <div className="flex items-center gap-1 text-cyan-700 dark:text-cyan-400 font-semibold font-mono text-[10px]">
                                <BookOpen className="w-3 h-3" />
                                <span>توثيق مرجع MEDSCAPE:</span>
                              </div>
                              <p className="text-stone-700 dark:text-neutral-300 text-[11px] font-sans">
                                {item.medscapeReference}
                              </p>
                              {item.notes && (
                                <p className="text-stone-500 dark:text-neutral-400 text-[10px] italic">
                                  ملاحظة سريرية: {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Drug-Drug Interactions Audit via Medscape Interaction Checker */}
                  {result.agentScientificKnowledge.drugInteractionsAudit && result.agentScientificKnowledge.drugInteractionsAudit.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-stone-700 dark:text-neutral-300 font-sans font-bold">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>تدقيق التداخلات والتعارضات الدوائية (Medscape Drug Interaction Checker):</span>
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {result.agentScientificKnowledge.drugInteractionsAudit.map((interaction, idx) => {
                          const isSafe = interaction.interactionLevel === "none";
                          const isSerious = interaction.interactionLevel === "serious" || interaction.interactionLevel === "contraindicated";
                          const isModerate = interaction.interactionLevel === "monitor_closely";

                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border text-xs font-sans space-y-2 ${
                                isSafe
                                  ? "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40"
                                  : isSerious
                                  ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                                  : "bg-amber-50 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-stone-900 dark:text-white">الأصناف المتداخلة:</span>
                                  {(Array.isArray(interaction.drugsInvolved)
                                    ? interaction.drugsInvolved
                                    : Array.isArray((interaction as any).drugsIncluded)
                                      ? (interaction as any).drugsIncluded
                                      : Array.isArray((interaction as any).drugs)
                                        ? (interaction as any).drugs
                                        : []
                                  ).map((drug: any, dIdx: number) => (
                                    <span key={dIdx} className="px-2 py-0.5 bg-stone-100 dark:bg-neutral-900 text-stone-800 dark:text-neutral-200 rounded border border-stone-200 dark:border-neutral-800 font-medium">
                                      {typeof drug === 'string' ? drug : (drug?.name || drug?.item || drug?.drug || JSON.stringify(drug))}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                      isSafe
                                        ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                        : isSerious
                                        ? "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40 animate-pulse"
                                        : "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                    }`}
                                  >
                                    {interaction.interactionLevelArabic || interaction.interactionLevel}
                                  </span>
                                </div>
                              </div>

                              <div className="p-2.5 bg-stone-50 dark:bg-neutral-950/60 rounded-lg text-xs space-y-1 border border-stone-200 dark:border-neutral-900">
                                <div className="flex items-center gap-1.5 text-stone-600 dark:text-neutral-400 font-semibold">
                                  <BookOpen className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                  <span>تقرير الفحص السريري من Medscape Interaction Checker:</span>
                                </div>
                                <p className="text-stone-800 dark:text-neutral-200 leading-relaxed text-xs">
                                  {interaction.medscapeDetails}
                                </p>
                              </div>

                              <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-[11px] text-stone-600 dark:text-neutral-400">
                                <span>
                                  تصرف الزميل: <span className="text-stone-900 dark:text-neutral-200 font-semibold">{interaction.agentHandlingArabic}</span>
                                </span>
                                {interaction.alert && (
                                  <span className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {interaction.alert}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}



                  {/* Section 4: Scientific Comparisons (المقارنات الدوائية) */}
                  {result.agentScientificKnowledge.scientificComparisons && result.agentScientificKnowledge.scientificComparisons.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-stone-700 dark:text-neutral-300 font-sans font-bold">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>تدقيق المقارنات الدوائية (Clinical Drug Comparisons):</span>
                        </span>
                      </div>

                      <div className="space-y-2">
                        {result.agentScientificKnowledge.scientificComparisons.map((comp, idx) => (
                          <div key={idx} className="p-3 bg-stone-50 dark:bg-neutral-950/50 rounded-xl border border-stone-200 dark:border-neutral-800 text-xs font-sans space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-stone-900 dark:text-white">{comp.drugsCompared}</span>
                              {comp.isAccurate ? (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded text-[10px] font-bold">
                                  مقارنة علمية دقيقة
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded text-[10px] font-bold">
                                  مقارنة غير دقيقة
                                </span>
                              )}
                            </div>
                            <p className="text-stone-700 dark:text-neutral-300 text-[11px]">
                              <span className="text-stone-500 dark:text-neutral-500">ادعاء الزميل: </span>
                              "{comp.agentClaim}"
                            </p>
                            <p className="text-cyan-900 dark:text-cyan-300 text-[11px] bg-cyan-50 dark:bg-cyan-950/30 p-2 rounded border border-cyan-200 dark:border-cyan-900/30">
                              <span className="text-cyan-700 dark:text-cyan-400 font-semibold font-mono">حقيقة Medscape: </span>
                              {comp.medscapeFactCheck}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Errors/Alerts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Strengths */}
                    {result.agentScientificKnowledge.scientificStrengths && result.agentScientificKnowledge.scientificStrengths.length > 0 && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/15 rounded-xl border border-emerald-200 dark:border-emerald-900/40 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          نقاط القوة العلمية الصيدلانية للزميل:
                        </span>
                        <div className="space-y-1">
                          {result.agentScientificKnowledge.scientificStrengths.map((str, sIdx) => (
                            <div key={sIdx} className="text-[11px] text-emerald-900 dark:text-emerald-200/90 flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0 mt-1.5" />
                              <span>{str}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alerts / Errors */}
                    {result.agentScientificKnowledge.scientificErrorsOrAlerts && result.agentScientificKnowledge.scientificErrorsOrAlerts.length > 0 ? (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1.5">
                        <span className="text-xs font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          تنبيهات وأخطاء المعرفة العلمية:
                        </span>
                        <div className="space-y-1">
                          {result.agentScientificKnowledge.scientificErrorsOrAlerts.map((err: any, eIdx) => {
                            const text = typeof err === "string" 
                              ? err 
                              : (err && typeof err === "object")
                                ? `${err.item ? `[${err.item}] ` : ""}${err.description || err.alert || JSON.stringify(err)}`
                                : String(err ?? "");
                            return (
                              <div key={eIdx} className="text-[11px] text-rose-900 dark:text-rose-200 flex items-start gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400 shrink-0 mt-1.5" />
                                <span>{text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200 dark:border-neutral-900 flex items-center justify-between text-xs">
                        <span className="text-stone-600 dark:text-neutral-400">حالة التنبيهات والأخطاء العلمية:</span>
                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          سليم علمياً وخالٍ من الأخطاء
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Comprehensive Scientific Evaluation */}
                  {result.agentScientificKnowledge.evaluation && (
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-950/20 rounded-xl border border-cyan-200 dark:border-cyan-800/40 space-y-1">
                      <span className="text-xs text-cyan-800 dark:text-cyan-400 font-bold font-sans">
                        التقييم الفني الشامل للمعرفة العلمية الصيدلانية (وفق معايير MEDSCAPE):
                      </span>
                      <p className="text-sm text-stone-800 dark:text-neutral-200 leading-relaxed font-sans">
                        {result.agentScientificKnowledge.evaluation}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Verbal Tics/Repeated Words Analysis Widget */}
              {isMeasurementVisible("verbalTics") && result.verbalTicsAnalysis && (
                <div id="verbal-tics-analysis-section" className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-stone-200 dark:border-neutral-900/80 space-y-4 animate-fade-in animate-duration-300 shadow-xs">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200/80 dark:border-neutral-800/60 font-sans flex-wrap">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white font-sans">تحليل وتدقيق اللازمات اللفظية وتكرار الكلمات المتكرر</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded font-medium">اللازمات الحوارية</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Repeated Question Alert Badge */}
                      {result.verbalTicsAnalysis.hasUnnecessaryRepeatedQuestions && (
                        <span 
                          title="كرر الزميل سؤالاً كان قد طرحه من قبل وسبق للعميل الإجابة عليه (تكرار بلا داعي)"
                          className="px-2.5 py-1 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/35 rounded-lg text-[11px] font-bold font-sans flex items-center gap-1.5 shadow-xs"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>تنبيه: تكرار سؤال تمت إجابته (تكرار بلا داعي)</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("verbalTics")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1 self-start sm:self-auto"
                        title="إخفاء بند اللازمات اللفظية من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Verbal Tics Status */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">حالة رصد اللازمات المتكررة</span>
                      <div className="mt-2 flex items-center">
                        {result.verbalTicsAnalysis.hasVerbalTics && result.verbalTicsAnalysis.detectedTics && result.verbalTicsAnalysis.detectedTics.length > 0 ? (
                          <span className="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/25 font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-550 animate-bounce" />
                            تم رصد كثرة تكرار لبعض الكلمات ({result.verbalTicsAnalysis.detectedTics.length})
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            تنوع لفظي ممتاز: لم يتم رصد أي كلمات متكررة كلازمات!
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tics Count Summary */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">العدد الإجمالي للازمات الملحوظ تكرارها</span>
                      <span className="text-lg font-extrabold text-stone-900 dark:text-white mt-2">
                        {result.verbalTicsAnalysis.detectedTics ? result.verbalTicsAnalysis.detectedTics.length : 0} <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium font-sans">لازمة لفظية</span>
                      </span>
                    </div>
                  </div>

                  {/* Verbal Tics List Details */}
                  {result.verbalTicsAnalysis.detectedTics && result.verbalTicsAnalysis.detectedTics.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-stone-700 dark:text-neutral-400 mb-2 font-sans">تفاصيل الكلمات المكررة كـ لقمة حوارية أو لازمة بحديث الزميل:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {result.verbalTicsAnalysis.detectedTics.map((item, idx) => (
                          <div key={idx} className="p-2.5 bg-stone-50 dark:bg-neutral-950/60 rounded-lg border border-stone-200 dark:border-neutral-900 flex flex-col gap-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-stone-900 dark:text-neutral-200 font-bold font-sans">اللازمة: "{item.word}"</span>
                              </div>
                              <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 rounded-md font-bold">
                                تكررت {item.count} {item.count === 1 ? "مرة" : "مرات"}
                              </span>
                            </div>
                            {Array.isArray(item.timestamps) && item.timestamps.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                <span className="text-[10px] text-stone-500 dark:text-neutral-500 font-semibold font-sans font-bold">طوابع تكرار اللفظ:</span>
                                <div className="flex flex-wrap gap-1">
                                  {item.timestamps.map((time, tIdx) => (
                                    <span key={tIdx} className="text-[10px] font-mono bg-white dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 border border-stone-200 dark:border-neutral-800 px-1.5 py-0.5 rounded font-bold">
                                      {time}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unnecessary Repeated Questions List */}
                  {result.verbalTicsAnalysis.repeatedQuestions && result.verbalTicsAnalysis.repeatedQuestions.length > 0 && (
                    <div className="pt-2 border-t border-stone-200 dark:border-neutral-900">
                      <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-2 font-sans flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>أسئلة كررها الزميل بعد إجابة العميل عليها (تكرار بلا داعي):</span>
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {result.verbalTicsAnalysis.repeatedQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="p-3 bg-rose-50 dark:bg-rose-500/5 rounded-xl border border-rose-200 dark:border-rose-500/20 flex flex-col gap-1.5 text-xs font-sans">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <span>السؤال المكرر: "{q.questionSnippet}"</span>
                              </span>
                              {q.repeatedQuestionTimestamp && (
                                <span className="font-mono text-[10px] bg-white dark:bg-neutral-900 px-2 py-0.5 rounded text-stone-600 dark:text-neutral-400 border border-stone-200 dark:border-neutral-800">
                                  توقيت التكرار: {q.repeatedQuestionTimestamp}
                                </span>
                              )}
                            </div>
                            {q.initialCustomerAnswer && (
                              <div className="text-[11px] text-stone-600 dark:text-neutral-400 flex items-center gap-1 flex-wrap">
                                <span className="text-stone-500 dark:text-neutral-500 font-semibold">إجابة العميل السابقة:</span>
                                <span className="text-stone-800 dark:text-neutral-300 italic">"{q.initialCustomerAnswer}"</span>
                                {q.initialQuestionTimestamp && (
                                  <span className="font-mono text-[10px] text-stone-500 dark:text-neutral-500">({q.initialQuestionTimestamp})</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hold Time Analysis Widget with Classification */}
              {isMeasurementVisible("holdTime") && result.holdTimeSummary && (
                <div id="hold-time-analysis-widget" className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-stone-200 dark:border-neutral-900/80 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200/80 dark:border-neutral-800/60 font-sans gap-2">
                    <div className="flex items-center gap-2">
                      <Music className="w-5 h-5 text-amber-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white">معيار الهولد والانتظار (مرتبط بوجود صوت موسيقى من أول صدورها إلى انتهائها فقط)</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {result.holdTimeSummary.holdCount > 0 ? (
                        result.holdTimeSummary.unjustifiedHoldCount && result.holdTimeSummary.unjustifiedHoldCount > 0 ? (
                          <span className="text-[11px] px-3 py-1 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-full font-bold flex items-center gap-1.5 font-sans">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            يوجد هولد بدون داعي ({result.holdTimeSummary.unjustifiedHoldCount})
                          </span>
                        ) : (
                          <span className="text-[11px] px-3 py-1 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5 font-sans">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            كل الهولد بداعي ({result.holdTimeSummary.validHoldCount || result.holdTimeSummary.holdCount})
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] px-3 py-1 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          مكالمة بدون هولد (0 ثانية)
                        </span>
                      )}
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                        result.holdTimeSummary.holdCount === 0 || result.holdTimeSummary.isMusicCriterionCompliant !== false
                          ? "bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                          : "bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40"
                      }`}>
                        <Music className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                        <span>معيار الهولد: مرتبط بوجود صوت موسيقى الانتظار من أول صدورها إلى انتهائها فقط ({result.holdTimeSummary.musicComplianceStatus || (result.holdTimeSummary.holdCount > 0 ? "ملتزم بوجود موسيقى الانتظار ✓" : "بدون هولد")})</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("holdTime")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1 self-start sm:self-auto"
                        title="إخفاء بند الهولد من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  {/* Metrics Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Hold status indicator */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium">حالة فترات الهولد</span>
                      <div className="mt-2 flex items-center">
                        {result.holdTimeSummary.holdCount > 0 ? (
                          <span className="text-xs px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/25 font-bold flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                            تم رصد موسيقى هولد ({result.holdTimeSummary.holdCount})
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/25 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            لا يوجد هولد (لم تصدح نغمة موسيقى)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Classification Breakdown */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">تصنيف الهولد (شروط الجودة)</span>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {result.holdTimeSummary.holdCount === 0 ? (
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">بدون هولد (مطابق)</span>
                        ) : (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
                              بداعي: {result.holdTimeSummary.validHoldCount ?? (result.holdTimeSummary.holdSegments || []).filter(s => s.classification === "بداعي").length}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-md font-bold border ${
                              (result.holdTimeSummary.unjustifiedHoldCount ?? (result.holdTimeSummary.holdSegments || []).filter(s => s.classification === "بدون داعي").length) > 0
                                ? "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40"
                                : "bg-stone-200 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 border-stone-300 dark:border-neutral-700"
                            }`}>
                              بدون داعي: {result.holdTimeSummary.unjustifiedHoldCount ?? (result.holdTimeSummary.holdSegments || []).filter(s => s.classification === "بدون داعي").length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* holdCount */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">عدد مرات الهولد</span>
                      <span className="text-lg font-extrabold text-stone-900 dark:text-white mt-2">
                        {result.holdTimeSummary.holdCount} <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium">مرات</span>
                      </span>
                    </div>

                    {/* totalHoldSeconds */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900 flex flex-col justify-between">
                      <span className="text-xs text-stone-600 dark:text-neutral-400 font-medium font-sans">إجمالي وقت الهولد</span>
                      <span className="text-lg font-extrabold text-amber-600 dark:text-amber-500 mt-2">
                        {result.holdTimeSummary.totalHoldSeconds} <span className="text-xs text-stone-500 dark:text-neutral-500 font-medium">ثانية</span>
                      </span>
                    </div>
                  </div>

                  {/* Clarification Box when No Hold */}
                  {result.holdTimeSummary.holdCount === 0 && (
                    <div className="p-3 bg-stone-50 dark:bg-neutral-950/50 rounded-xl border border-stone-200 dark:border-neutral-800 text-xs text-stone-700 dark:text-neutral-300 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 font-sans">تأكيد التدقيق المعتمد: المكالمة لا يوجد بها هولد</span>
                        <p className="leading-relaxed font-sans text-stone-600 dark:text-neutral-400">
                          تم التحقق بدقة من خط المكالمة؛ حيث لم يظهر أو يُبث أي صوت لنغمة موسيقى انتظار. واحتساب الهولد يشترط قطعياً وجود صوت موسيقى الانتظار (ويُحسب من أول صدور الموسيقى إلى انتهائها فقط، حتى لو ظهر كلام للعميل أثناء الموسيقى). أي فترات توقف أو سكوت بدون موسيقى هي فترات صمت وسكوت للموظف أثناء فحص النظام ومدرجة في قسم تحليل الصمت.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Audit Notes if present */}
                  {result.holdTimeSummary.auditNotes && (
                    <div className="p-3 bg-amber-50/60 dark:bg-neutral-950/60 rounded-xl border border-amber-200/80 dark:border-neutral-800/80 text-xs text-stone-800 dark:text-neutral-300 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-amber-800 dark:text-amber-300 font-sans">ملاحظة مدقق الجودة حول أسباب الهولد:</span>
                        <p className="leading-relaxed font-sans text-stone-700 dark:text-neutral-300">{result.holdTimeSummary.auditNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Hold segments details list if items exist */}
                  {result.holdTimeSummary.holdSegments && result.holdTimeSummary.holdSegments.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <h4 className="text-xs font-bold text-stone-700 dark:text-neutral-400">تفاصيل وتصنيف فترات الهولد المرصودة:</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {result.holdTimeSummary.holdSegments.map((seg, idx) => {
                          const isJustified = seg.classification === "بداعي";
                          const isExceeded = seg.isDurationExceeded || (seg.allowedDurationSeconds ? seg.duration > seg.allowedDurationSeconds : (seg.classification === "بداعي" && seg.duration > 90));
                          
                          // Collect all triggered alerts for this hold segment
                          const segmentAlerts: string[] = [];
                          if (isExceeded) {
                            segmentAlerts.push(seg.durationAlertMessage || "تنبيه: تجاوز مدة الهولد المسموحة");
                          }
                          if (seg.isReasonStated === false || (seg.statedReasonSnippet && seg.statedReasonSnippet.includes("لم يذكر"))) {
                            segmentAlerts.push("تنبيه: لم يتم إبلاغ العميل بسبب الهولد");
                          }
                          if (seg.connectedToHoldPhrase === false) {
                            segmentAlerts.push("تنبيه: لم يقترن الهولد بعبارة الاستئذان المعتمدة 'لحظات عالانتظار'");
                          }
                          if (seg.didWaitForConsent === false) {
                            segmentAlerts.push("تنبيه: خروج هولد دون انتظار موافقة العميل");
                          }
                          if (seg.didThankAfterHold === false) {
                            segmentAlerts.push("تنبيه: لم يتم شكر العميل على الانتظار");
                          }
                          if (seg.didCheckCustomerPresence === false) {
                            segmentAlerts.push("تنبيه: استرسال بالكلام دون التأكد من وجود العميل على الخط");
                          }
                          if (seg.hasLoudMusic === false || seg.isMusicCompliant === false) {
                            segmentAlerts.push("تنبيه: عدم الالتزام بوجود موسيقى الانتظار (إخلال بمعيار الهولد)");
                          }
                          // Include any additional alerts from AI analyzer not already captured
                          if (seg.alerts && Array.isArray(seg.alerts)) {
                            seg.alerts.forEach((alt: any) => {
                              const altText = typeof alt === "string" 
                                ? alt 
                                : (alt && typeof alt === "object")
                                  ? `${alt.item ? `[${alt.item}] ` : ""}${alt.description || alt.alertType || JSON.stringify(alt)}`
                                  : String(alt ?? "");
                              if (altText && !segmentAlerts.some((existing) => existing === altText || (typeof existing === "string" && (altText.includes(existing) || existing.includes(altText))))) {
                                segmentAlerts.push(altText);
                              }
                            });
                          }

                          return (
                            <div 
                              key={idx} 
                              className={`p-4 rounded-xl border flex flex-col gap-2.5 text-xs transition-all ${
                                isJustified
                                  ? "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/30"
                                  : "bg-rose-50 dark:bg-rose-950/15 border-rose-200 dark:border-rose-500/30"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Music className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                  <span className="text-stone-900 dark:text-white font-bold font-sans">فترة هولد رقم #{idx + 1}</span>
                                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold font-sans border ${
                                    isJustified
                                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40"
                                      : "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40"
                                  }`}>
                                    {isJustified ? "✓ هولد بداعي" : "✕ هولد بدون داعي"}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-sans font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                                    <span>🎵</span>
                                    <span>صوت موسيقى انتظار (أساسي)</span>
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-sans font-bold bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 flex items-center gap-1">
                                    <span>⏱️</span>
                                    <span>من أول صدور الموسيقى إلى انتهائها فقط</span>
                                  </span>
                                  {seg.customerSpokeDuringMusic && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-sans font-bold bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1" title="ظهر كلام للعميل أثناء عزف الموسيقى - ويستمر احتساب كامل الفترة كهولد دون انقطاع">
                                      <span>🗣️</span>
                                      <span>ظهر كلام للعميل أثناء الموسيقى (الهولد مستمر وكامل)</span>
                                    </span>
                                  )}
                                  {seg.connectedToHoldPhrase ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-sans font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                                      <span>✓</span>
                                      <span>مقترن بـ "لحظات عالانتظار"</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-sans font-bold bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1">
                                      <span>✕</span>
                                      <span>غير مقترن بـ "لحظات عالانتظار"</span>
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-sans font-bold flex items-center gap-1 border ${
                                    seg.hasLoudMusic !== false && seg.isMusicCompliant !== false
                                      ? "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                      : "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40"
                                  }`}>
                                    <Music className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                    <span>معيار الهولد: {seg.hasLoudMusic !== false && seg.isMusicCompliant !== false ? "مستوفٍ بوجود موسيقى الانتظار ✓" : "إخلال (بدون موسيقى) ✕"}</span>
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                                  <div className="font-mono text-stone-700 dark:text-neutral-300 flex items-center gap-1.5 bg-stone-100 dark:bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-neutral-800">
                                    <span>{seg.timeStart} ← {seg.timeEnd}</span>
                                    <span className="text-stone-400 dark:text-neutral-600">•</span>
                                    <span className={`font-bold ${isExceeded ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>({seg.duration} ثانية)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Triggered Alerts Badges Row */}
                              {segmentAlerts.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                  {segmentAlerts.map((alertText, aIdx) => (
                                    <span 
                                      key={aIdx}
                                      className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/35 rounded-lg text-[11px] font-bold font-sans flex items-center gap-1.5 shadow-xs"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                      <span>{alertText}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Reason & Category Info */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200 dark:border-neutral-900">
                                <div className="space-y-1">
                                  <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-bold">السبب المذكور من الزميل للعميل:</span>
                                  <p className="text-xs text-stone-800 dark:text-neutral-200 font-sans italic bg-stone-100/70 dark:bg-neutral-950/70 p-2 rounded-lg border border-stone-200 dark:border-neutral-850">
                                    "{seg.statedReasonSnippet || "لم يذكر الزميل سبباً للعميل"}"
                                  </p>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-bold">تصنيف الحالة / السبب:</span>
                                  <div className="text-xs text-amber-800 dark:text-amber-300 font-sans font-medium bg-stone-100/70 dark:bg-neutral-950/70 p-2 rounded-lg border border-stone-200 dark:border-neutral-850 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                                    {seg.reasonCategory || (isJustified ? "مستوفٍ للشروط المعتمدة" : "سبب غير معتمد أو لم يُذكر")}
                                  </div>
                                </div>
                              </div>

                              {/* Hold Phrase Snippet if present */}
                              {seg.holdPhraseSnippet && (
                                <div className="text-[11px] text-stone-700 dark:text-neutral-300 font-sans bg-stone-100 dark:bg-neutral-950/60 p-2 rounded-lg border border-stone-200 dark:border-neutral-900 flex items-center gap-2">
                                  <span className="text-emerald-700 dark:text-emerald-400 font-bold shrink-0">عبارة الانتظار المرصودة:</span>
                                  <span className="italic text-emerald-900 dark:text-emerald-200">"{seg.holdPhraseSnippet}"</span>
                                </div>
                              )}

                              {/* Evaluation Snippet */}
                              {seg.evaluation && (
                                <div className="text-[11px] text-stone-700 dark:text-neutral-300 font-sans bg-stone-50 dark:bg-neutral-950/40 p-2.5 rounded-lg border border-stone-200 dark:border-neutral-900 flex items-start gap-2">
                                  <span className="text-stone-500 dark:text-neutral-400 font-bold shrink-0">تقييم المدقق:</span>
                                  <span className="leading-relaxed">{seg.evaluation}</span>
                                </div>
                              )}

                              {/* Music Calculation Rule Note */}
                              {seg.musicCalculationNote && (
                                <div className="text-[11px] text-sky-800 dark:text-sky-300/90 font-sans bg-sky-50 dark:bg-sky-950/25 p-2 rounded-lg border border-sky-200 dark:border-sky-800/30 flex items-center gap-2">
                                  <span className="text-sky-700 dark:text-sky-400 font-bold shrink-0">قاعدة الاحتساب:</span>
                                  <span className="leading-relaxed">{seg.musicCalculationNote}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Tone of Voice Assessment Widget */}
              {isMeasurementVisible("agentTone") && result.agentToneAnalysis && (
                <div id="tone-of-voice-audit-section" className="p-6 rounded-2xl bg-white dark:bg-[#1C1A18] border border-stone-200 dark:border-neutral-800/80 space-y-5 animate-fade-in animate-duration-300 shadow-xs">
                  <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-neutral-800/60 pb-3">
                    <div className="flex items-center gap-2 font-sans">
                      <Volume2 className="w-5 h-5 text-amber-500 animate-pulse" />
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white font-sans">تدقيق نبرة صوت الزميل</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Score badge out of 10 */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs font-bold font-mono">
                        <span>تقييم النبرة:</span>
                        <span className="text-stone-900 dark:text-white text-sm">{result.agentToneAnalysis.score}</span>
                        <span className="text-stone-500 dark:text-neutral-500 font-normal">/10</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSingleMeasurement("agentTone")}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                        title="إخفاء بند نبرة صوت الزميل من التقييم"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إخفاء</span>
                      </button>
                    </div>
                  </div>

                  {/* Smile Presence Indicator Row */}
                  <div className={`p-4 rounded-xl border flex flex-col gap-3 ${
                    result.agentToneAnalysis.hasSmile 
                      ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/10 text-emerald-800 dark:text-emerald-400" 
                      : "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/10 text-amber-800 dark:text-amber-400"
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <Smile className={`w-5 h-5 shrink-0 mt-0.5 ${result.agentToneAnalysis.hasSmile ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-stone-900 dark:text-neutral-200">تدقيق حضور الابتسامة في الصوت:</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            result.agentToneAnalysis.hasSmile 
                              ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" 
                              : "bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-bold"
                          }`}>
                            {result.agentToneAnalysis.hasSmile 
                              ? "مبتسمة وبها بشاشة صوتية" 
                              : (result.agentToneAnalysis.smileEvaluation?.includes("تردد") || result.agentToneAnalysis.detectedTraits?.some(t => t.includes("تردد")))
                                ? "غير مبتسمة (ينقصها الابتسامة وبها تردد أحياناً)" 
                                : "غير مبتسمة وينقصها الابتسامة"}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 dark:text-neutral-300 font-sans leading-relaxed">
                          {result.agentToneAnalysis.smileEvaluation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Split Summaries Layout (Introduction vs Call) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Introduction Summary */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900/80 space-y-2">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-sans block">خلاصة النبرة في المقدمة والافتتاحية:</span>
                      <p className="text-xs text-stone-700 dark:text-neutral-300 leading-relaxed font-sans">
                        {result.agentToneAnalysis.introductionSummary}
                      </p>
                    </div>

                    {/* Main Call Summary */}
                    <div className="p-4 bg-stone-50 dark:bg-neutral-950/40 rounded-xl border border-stone-200/80 dark:border-neutral-900/80 space-y-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-sans block">خلاصة النبرة خلال باقي المكالمة:</span>
                      <p className="text-xs text-stone-700 dark:text-neutral-300 leading-relaxed font-sans">
                        {result.agentToneAnalysis.callSummary}
                      </p>
                    </div>
                  </div>

                  {/* Character Traits/Tags */}
                  {result.agentToneAnalysis.detectedTraits && result.agentToneAnalysis.detectedTraits.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-bold font-sans">السمات والملحوظات الصوتية المكتشفة:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {result.agentToneAnalysis.detectedTraits.map((trait, index) => {
                          const isBenchmarkToneTrait = trait.includes("ينقصها الابتسامة وبها تردد") || trait.includes("ينقصها الابتسامة وبها تردد أحياناً");
                          return (
                            <span
                              key={index}
                              className={`text-xs px-2.5 py-1 rounded-lg font-sans font-medium flex items-center gap-1.5 transition-all ${
                                isBenchmarkToneTrait
                                  ? "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-bold shadow-xs"
                                  : "bg-stone-100 dark:bg-neutral-950 text-stone-800 dark:text-neutral-200 border border-stone-200 dark:border-neutral-850"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isBenchmarkToneTrait ? "bg-amber-500 dark:bg-amber-400 animate-pulse" : "bg-stone-400 dark:bg-neutral-400"}`} />
                              {trait}
                              {isBenchmarkToneTrait && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 dark:bg-amber-500/25 text-amber-900 dark:text-amber-300 rounded font-mono font-bold border border-amber-300 dark:border-amber-500/30">
                                  معيار النبرة
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Speech Emotion Recognition Section */}
                  {result.agentToneAnalysis.wav2vec2Emotion && (
                    <div className="p-4 bg-gradient-to-br from-violet-50/60 via-stone-50 to-stone-50/80 dark:from-violet-950/25 dark:via-neutral-950/50 dark:to-neutral-950/70 rounded-xl border border-violet-200 dark:border-violet-500/30 space-y-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-violet-200 dark:border-violet-500/25 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-violet-800 dark:text-violet-300 font-sans flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            قياس نبرة ومشاعر صوت الزميل:
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-500/15 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 font-semibold">
                            التحليل الصوتي الترددي المباشر
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium">
                          <span className="text-stone-500 dark:text-neutral-400">المشاعر السائدة الإجمالية:</span>
                          <span className="px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-500/25 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-500/30 font-bold">
                            {result.agentToneAnalysis.wav2vec2Emotion.dominantEmotionArabic} ({result.agentToneAnalysis.wav2vec2Emotion.dominantEmotion})
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-neutral-900 text-stone-700 dark:text-neutral-300 font-mono">
                            {result.agentToneAnalysis.wav2vec2Emotion.confidencePercentage}%
                          </span>
                        </div>
                      </div>

                      {/* Segmentation: Introduction vs During Call */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. Introduction Tone */}
                        <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/25 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-violet-600 dark:bg-violet-400 animate-pulse" />
                              1. نبرة الزميل في المقدمة:
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300 font-bold">
                              {result.agentToneAnalysis.wav2vec2Emotion.introduction?.dominantEmotionArabic || "رسمية / محايدة"}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-700 dark:text-neutral-300 font-sans leading-relaxed">
                            {result.agentToneAnalysis.wav2vec2Emotion.introduction?.acousticNotes || 
                              result.agentToneAnalysis.introductionSummary || 
                              "تم قياس ترددات نبرة الافتتاحية بدقة؛ خالية من الابتسامة وبها تردد خفيف."}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-neutral-400 pt-1 border-t border-violet-200 dark:border-violet-500/15">
                            <span>مؤشر الابتسامة بالافتتاحية:</span>
                            <span className={`font-bold ${
                              result.agentToneAnalysis.wav2vec2Emotion.introduction?.isSmileSupported ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                            }`}>
                              {result.agentToneAnalysis.wav2vec2Emotion.introduction?.isSmileSupported ? "✓ مبتسمة وبشوشة" : "⚠ ينقصها الابتسامة وبها تردد"}
                            </span>
                          </div>
                        </div>

                        {/* 2. During Call Tone */}
                        <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/25 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                              2. نبرة الزميل أثناء سير المكالمة:
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300 font-bold">
                              {result.agentToneAnalysis.wav2vec2Emotion.duringCall?.dominantEmotionArabic || "محايدة / حماسية"}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-700 dark:text-neutral-300 font-sans leading-relaxed">
                            {result.agentToneAnalysis.wav2vec2Emotion.duringCall?.acousticNotes || 
                              result.agentToneAnalysis.callSummary || 
                              "تم قياس ترددات نبرة سير المكالمة؛ استقرار رسمي مع تراجع تفاعل الابتسامة."}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-neutral-400 pt-1 border-t border-violet-200 dark:border-violet-500/15">
                            <span>مؤشر الابتسامة أثناء المكالمة:</span>
                            <span className={`font-bold ${
                              result.agentToneAnalysis.wav2vec2Emotion.duringCall?.isSmileSupported ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                            }`}>
                              {result.agentToneAnalysis.wav2vec2Emotion.duringCall?.isSmileSupported ? "✓ مبتسمة وبشوشة" : "⚠ ينقصها الابتسامة وبها تردد"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Emotion Bars */}
                      {result.agentToneAnalysis.wav2vec2Emotion.allScores && result.agentToneAnalysis.wav2vec2Emotion.allScores.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] text-stone-600 dark:text-neutral-400 font-bold font-sans block">
                            طيف الترددات الصوتية لكافة المشاعر:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {result.agentToneAnalysis.wav2vec2Emotion.allScores.map((scoreItem, sIdx) => {
                              const isDominant = scoreItem.label === result.agentToneAnalysis.wav2vec2Emotion?.dominantEmotion;
                              const isHappy = scoreItem.label === "happy";
                              const isNeutral = scoreItem.label === "neutral";
                              const isFearful = scoreItem.label === "fearful";

                              let barColor = "bg-stone-400 dark:bg-neutral-600";
                              let badgeColor = "text-stone-600 dark:text-neutral-400";
                              if (isHappy) {
                                barColor = "bg-emerald-500";
                                badgeColor = "text-emerald-700 dark:text-emerald-400";
                              } else if (isNeutral) {
                                barColor = "bg-amber-500";
                                badgeColor = "text-amber-700 dark:text-amber-400";
                              } else if (isFearful) {
                                barColor = "bg-rose-500";
                                badgeColor = "text-rose-700 dark:text-rose-400";
                              } else if (isDominant) {
                                barColor = "bg-violet-600 dark:bg-violet-500";
                                badgeColor = "text-violet-800 dark:text-violet-300";
                              }

                              return (
                                <div
                                  key={sIdx}
                                  className={`p-2 rounded-lg border text-xs space-y-1 ${
                                    isDominant
                                      ? "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-500/30"
                                      : "bg-white dark:bg-neutral-950/40 border-stone-200 dark:border-neutral-900"
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-sans">
                                    <span className={`font-semibold ${badgeColor} flex items-center gap-1`}>
                                      {scoreItem.labelArabic}
                                      {isDominant && (
                                        <span className="text-[9px] px-1 bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300 rounded font-bold">
                                          الأعلى
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-mono text-stone-700 dark:text-neutral-300 text-[11px]">
                                      {scoreItem.percentage}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-200 dark:bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                                      style={{ width: `${Math.min(100, Math.max(2, scoreItem.percentage))}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Acoustic Notes */}
                      {result.agentToneAnalysis.wav2vec2Emotion.acousticNotes && (
                        <div className="text-xs text-stone-700 dark:text-neutral-300 font-sans leading-relaxed pt-1 border-t border-violet-200 dark:border-neutral-900 flex items-start gap-2">
                          <span className="text-violet-700 dark:text-violet-400 font-bold shrink-0">الملاحظات الترددية الشاملة:</span>
                          <span>{result.agentToneAnalysis.wav2vec2Emotion.acousticNotes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Informative banner when all evaluation criteria are hidden by user in settings */}
              {measurementSettings.every((s) => !s.visible) && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-amber-200">
                    كافة بنود تقييم جودة المكالمة مخفية حالياً
                  </h4>
                  <p className="text-xs text-stone-300 max-w-md mx-auto leading-relaxed">
                    تم إخفاء جميع بطاقات ومعايير التقييم وفقاً لإعدادات التخصيص. يمكنك إعادة إظهارها في أي وقت من تبويب "الإعدادات".
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("settings")}
                    className="py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    الانتقال إلى الإعدادات لإظهار البنود
                  </button>
                </div>
              )}
              </>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200 dark:border-neutral-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-stone-900 dark:text-white">التفريغ النصي والجدول الزمني للمكالمة</span>
                  <span className="text-[11px] text-stone-500 dark:text-neutral-500 font-sans">
                    ({filteredTranscript?.length || 0} مقطع)
                  </span>
                  {result?.transcriptionAudit && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      result.transcriptionAudit.isTranscriptComplete
                        ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                        : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
                    }`}>
                      <Check className="w-2.5 h-2.5" />
                      {result.transcriptionAudit.isTranscriptComplete
                        ? `تفريغ شامل ومكتمل 100% (حتى ${result.callEndingAnalysis?.callTotalDuration || result.transcriptionAudit.callTotalDuration})`
                        : `تفريغ حتى ${result.transcriptionAudit.lastTranscribedTimestamp}`}
                    </span>
                  )}
                  {result?.transcript && result.transcript.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyFullTranscript}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-neutral-800 border border-stone-200 dark:border-neutral-800 transition-colors cursor-pointer mr-1"
                      title="نسخ التفريغ الكامل للمكالمة"
                    >
                      {isCopiedTranscript ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ التفريغ</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 text-xs bg-stone-100 dark:bg-neutral-900 p-1 rounded-xl border border-stone-200/80 dark:border-neutral-800/80">
                  <button
                    id="filter-all"
                    onClick={() => setActiveSegmentFilter("all")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      activeSegmentFilter === "all"
                        ? "bg-white dark:bg-neutral-800 text-stone-900 dark:text-white shadow-2xs"
                        : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
                    }`}
                  >
                    عرض الكل
                  </button>
                  <button
                    id="filter-customer"
                    onClick={() => setActiveSegmentFilter("customer")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSegmentFilter === "customer" 
                        ? "bg-purple-100 dark:bg-purple-500/20 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 shadow-2xs" 
                        : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
                    }`}
                  >
                    <User className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    صوت العميل فقط
                  </button>
                  <button
                    id="filter-agent"
                    onClick={() => setActiveSegmentFilter("agent")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSegmentFilter === "agent" 
                        ? "bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30 shadow-2xs" 
                        : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
                    }`}
                  >
                    <Headphones className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    صوت الموظف فقط
                  </button>
                  <button
                    id="filter-silence"
                    onClick={() => setActiveSegmentFilter("silence")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSegmentFilter === "silence" 
                        ? "bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 shadow-2xs" 
                        : "text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white"
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    فترات الصمت فقط
                  </button>
                </div>
              </div>

              {/* Chat Timeline list */}
              <div className="space-y-3.5">
                {filteredTranscript && filteredTranscript.length > 0 ? (
                  filteredTranscript.map((segment, index) => {
                    const isSilence = segment.speaker.includes("صمت") || segment.speaker.includes("صمت الموظف") || segment.speaker.includes("فترة صمت الموظف");
                    const isAgent = segment.speaker.includes("موظف") || segment.speaker.includes("كول سنتر");

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`p-4 rounded-2xl border flex flex-col gap-2.5 transition-all shadow-2xs ${
                          isSilence 
                            ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/30"
                            : isAgent 
                              ? "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/30"
                              : "bg-purple-50/70 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-900/30"
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {isSilence ? (
                              <div className="flex items-center gap-1.5 bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 text-[11px] px-2.5 py-0.5 rounded-lg border border-rose-200 dark:border-rose-500/20 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {segment.speaker}
                              </div>
                            ) : isAgent ? (
                              <div className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 text-[11px] px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-500/25 font-bold">
                                <Headphones className="w-3.5 h-3.5" />
                                {segment.speaker}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 text-[11px] px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-500/25 font-bold">
                                <User className="w-3.5 h-3.5" />
                                {segment.speaker}
                              </div>
                            )}
                          </div>
                          
                          {/* Timestamps */}
                          <div className="flex items-center gap-2 text-stone-500 dark:text-neutral-400 text-xs font-mono font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{segment.timeStart} ← {segment.timeEnd}</span>
                            <span className="text-stone-300 dark:text-neutral-700">•</span>
                            <span className="text-[11px] bg-white dark:bg-neutral-950 text-stone-700 dark:text-neutral-300 px-2 py-0.5 rounded border border-stone-200 dark:border-neutral-900 shadow-2xs">
                              {segment.duration} ثانية
                            </span>
                          </div>
                        </div>

                        {/* Transcript context text - crystal clear in both light & dark mode */}
                        <div className="text-sm font-sans leading-relaxed pt-0.5">
                          {isSilence ? (
                            <span className="italic text-rose-800 dark:text-rose-300 font-semibold">
                              {segment.text} [صمت غير مبرر للزميل تم احتسابه]
                            </span>
                          ) : isAgent ? (
                            <span className="text-stone-900 dark:text-blue-100 font-medium">{segment.text}</span>
                          ) : (
                            <span className="text-stone-900 dark:text-purple-100 font-medium">{segment.text}</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-stone-500 dark:text-neutral-400 text-sm font-medium">
                    لا تتوفر وسوم أو مقاطع تطابق معيار التصفية المختار.
                  </div>
                )}
              </div>

            </motion.div>
          )}

        </AnimatePresence>
        )}

      </main>

      {/* Footer information bar */}
      <footer className="border-t border-[#EAE3D9] dark:border-stone-800 bg-[#FAF8F5] dark:bg-[#1A1816] py-4 px-6 mt-12 transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
          <div>
            دقة تامة لالتقاط اللهجة المصرية والتحليل الاستقرائي للصمت وموسيقى الهولد وتدقيق الفواتير ومطابقة الأصناف.
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-stone-400 dark:text-stone-500">
              © {new Date().getFullYear()} QA Auditor Tool
            </div>
          </div>
        </div>
      </footer>

      </div>

      {/* Receipt OCR Audit Modal */}
      <ReceiptAuditModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setPastedReceiptFile(null);
        }}
        callTranscript={result?.transcript}
        initialReceiptAudit={result?.receiptAudit}
        initialImageFile={pastedReceiptFile}
        onRequestUploadCall={() => {
          fileInputRef.current?.click();
        }}
        onAuditComplete={(receiptAuditResult) => {
          setResult((prev) => (prev ? { ...prev, receiptAudit: receiptAuditResult } : prev));
        }}
      />

      {/* Excel Multi-Sheet Export Modal */}
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        result={result}
        isMeasurementVisible={isMeasurementVisible}
      />

      {/* Unified 15-Stage Pipeline Trace Modal */}
      <PipelineTraceModal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
        result={result}
        language={language}
      />

    </div>
  );
}
