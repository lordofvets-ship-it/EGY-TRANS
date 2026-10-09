import React, { useState, useEffect } from "react";
import { 
  Brain, 
  Sparkles, 
  Plus, 
  Search, 
  ShieldCheck, 
  BookOpen, 
  UserCheck, 
  FileText, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Tag, 
  Layers, 
  Lightbulb, 
  ArrowRight,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { 
  HindsightMemoryEntry, 
  HindsightMemoryCategory, 
  HindsightBankStats, 
  HindsightRecallResult 
} from "../types";
import { Language } from "../utils/translations";

interface HindsightMemoryViewProps {
  language?: Language;
  onBackToHome?: () => void;
}

export const HindsightMemoryView: React.FC<HindsightMemoryViewProps> = ({
  language = "ar",
  onBackToHome
}) => {
  const [memories, setMemories] = useState<HindsightMemoryEntry[]>([]);
  const [stats, setStats] = useState<HindsightBankStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<"all" | HindsightMemoryCategory>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Recall simulation state
  const [recallQuery, setRecallQuery] = useState<string>("");
  const [recallResult, setRecallResult] = useState<HindsightRecallResult | null>(null);
  const [isRecalling, setIsRecalling] = useState<boolean>(false);

  // New Memory Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<HindsightMemoryCategory>("mental_models");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newContent, setNewContent] = useState<string>("");
  const [newEntities, setNewEntities] = useState<string>("");
  const [newTags, setNewTags] = useState<string>("");
  const [newImportance, setNewImportance] = useState<"critical" | "high" | "medium" | "low">("critical");
  const [newSource, setNewSource] = useState<string>("تأكيد مباشر من المشرف");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hindsight/memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to load Hindsight memories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleSimulateRecall = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!recallQuery.trim()) return;

    try {
      setIsRecalling(true);
      const res = await fetch("/api/hindsight/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: recallQuery, limit: 6 })
      });
      if (res.ok) {
        const data = await res.json();
        setRecallResult(data);
      }
    } catch (err) {
      console.error("Recall error:", err);
    } finally {
      setIsRecalling(false);
    }
  };

  const handleRetainNewMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      setIsSaving(true);
      const entitiesArray = newEntities
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const tagsArray = newTags
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/hindsight/retain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory,
          title: newTitle,
          content: newContent,
          entities: entitiesArray,
          tags: tagsArray,
          importance: newImportance,
          source: newSource
        })
      });

      if (res.ok) {
        setStatusMessage("✓ تم حفظ وتثبيت التفصيلة في ذاكرة Hindsight بنجاح ولن ينساها النظام أبداً!");
        setTimeout(() => setStatusMessage(null), 4000);
        setShowAddModal(false);
        // Reset form
        setNewTitle("");
        setNewContent("");
        setNewEntities("");
        setNewTags("");
        fetchMemories();
      }
    } catch (err) {
      console.error("Failed to retain memory:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه التفصيلة من الذاكرة؟")) return;
    try {
      const res = await fetch(`/api/hindsight/memories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        fetchMemories();
      }
    } catch (err) {
      console.error("Delete memory error:", err);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("هل تريد استعادة بنك الذاكرة المعتمد لجميع المعايير والتوجيهات الأصلية؟")) return;
    try {
      const res = await fetch("/api/hindsight/reset", { method: "POST" });
      if (res.ok) {
        setStatusMessage("✓ تم استعادة بنك الذاكرة القياسي بنجاح");
        setTimeout(() => setStatusMessage(null), 3000);
        fetchMemories();
      }
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  const filteredMemories = memories.filter((m) => {
    const matchesCat = activeCategory === "all" || m.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;
    const matchesQuery = 
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.entities || []).some((e) => e.toLowerCase().includes(q)) ||
      (m.tags || []).some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const categoryIcons: Record<HindsightMemoryCategory, React.ComponentType<{ className?: string }>> = {
    mental_models: Lightbulb,
    world_facts: ShieldCheck,
    experiences: UserCheck,
    observations: BookOpen
  };

  const isRtl = language === "ar";

  return (
    <div className={`space-y-6 max-w-6xl mx-auto pb-12 ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Banner / Hero */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-purple-900/20 via-indigo-900/15 to-cyan-900/20 border border-purple-300/40 dark:border-purple-800/40 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/15 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50 flex items-center justify-center shrink-0 shadow-inner">
              <Brain className="w-7 h-7 text-purple-600 dark:text-purple-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
                  Hindsight Agent Memory
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>الذاكرة نشطة وتحقن تلقائياً بالتقييم</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                ذاكرة النظام المستمرة (Hindsight)
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-neutral-300 max-w-2xl leading-relaxed">
                منظومة الذاكرة الحيوية التي تجعل التطبيق <span className="font-bold text-purple-700 dark:text-purple-300">يتذكر ويتعلم</span> من كل تفصيلة وقاعدة أكد عليها المشرف، مع استرجاعها التلقائي (Recall) أثناء تحليل وتفريغ المكالمات.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>تثبيت تفصيلة بالذاكرة (Retain)</span>
            </button>
            <button
              onClick={handleResetDefaults}
              className="p-2.5 rounded-xl border border-stone-300 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800 text-xs transition-colors cursor-pointer"
              title="استعادة الذاكرة المعتمدة"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={fetchMemories}
              className="p-2.5 rounded-xl border border-stone-300 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800 text-xs transition-colors cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* 4 Biomimetic Category Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Mental Models */}
        <div 
          onClick={() => setActiveCategory("mental_models")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "mental_models"
              ? "bg-purple-50 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600 shadow-sm"
              : "bg-white dark:bg-[#1C1A18] border-stone-200 dark:border-neutral-800 hover:border-purple-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center">
              <Lightbulb className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-purple-700 dark:text-purple-300">
              {stats?.mentalModelsCount ?? memories.filter((m) => m.category === "mental_models").length}
            </span>
          </div>
          <h3 className="text-xs font-bold text-stone-900 dark:text-white mt-2">توجيهات المشرف</h3>
          <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-0.5">Mental Models & Directives</p>
        </div>

        {/* World Facts */}
        <div 
          onClick={() => setActiveCategory("world_facts")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "world_facts"
              ? "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-sm"
              : "bg-white dark:bg-[#1C1A18] border-stone-200 dark:border-neutral-800 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-blue-700 dark:text-blue-300">
              {stats?.worldFactsCount ?? memories.filter((m) => m.category === "world_facts").length}
            </span>
          </div>
          <h3 className="text-xs font-bold text-stone-900 dark:text-white mt-2">حقائق وقواعد الجودة</h3>
          <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-0.5">World Facts & Protocols</p>
        </div>

        {/* Experiences */}
        <div 
          onClick={() => setActiveCategory("experiences")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "experiences"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 shadow-sm"
              : "bg-white dark:bg-[#1C1A18] border-stone-200 dark:border-neutral-800 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300">
              {stats?.experiencesCount ?? memories.filter((m) => m.category === "experiences").length}
            </span>
          </div>
          <h3 className="text-xs font-bold text-stone-900 dark:text-white mt-2">سجل وخبرات الزملاء</h3>
          <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-0.5">Experiences & Learnings</p>
        </div>

        {/* Observations */}
        <div 
          onClick={() => setActiveCategory("observations")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "observations"
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 shadow-sm"
              : "bg-white dark:bg-[#1C1A18] border-stone-200 dark:border-neutral-800 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-amber-700 dark:text-amber-300">
              {stats?.observationsCount ?? memories.filter((m) => m.category === "observations").length}
            </span>
          </div>
          <h3 className="text-xs font-bold text-stone-900 dark:text-white mt-2">الأصناف والعملاء</h3>
          <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-0.5">Observations & Items</p>
        </div>
      </div>

      {/* Interactive Recall Simulator (مُحاكي استدعاء الذاكرة الفعلي) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-stone-200 dark:border-neutral-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-white">
              محاكي استرجاع الذاكرة الحية (Live Recall Engine)
            </h2>
          </div>
          <span className="text-[11px] text-stone-500 dark:text-neutral-400 font-mono">
            اختبر ما يتذكره النظام فورياً حول أي كلمة أو استفسار
          </span>
        </div>

        <form onSubmit={handleSimulateRecall} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-3 right-3 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={recallQuery}
              onChange={(e) => setRecallQuery(e.target.value)}
              placeholder="اكتب أي سياق أو كلمة للبحث في الذاكرة (مثال: درجات الاستشارة، بدائل ميدسكاب، الهولد، الشكوى)..."
              className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-900 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={isRecalling || !recallQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {isRecalling ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>استدعاء الذاكرة (Recall)</span>
          </button>
        </form>

        {recallResult && (
          <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-purple-900 dark:text-purple-200 font-bold">
              <span>نتائج الاسترجاع لـ: "{recallResult.query}"</span>
              <span className="font-mono text-[11px] bg-purple-200/60 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                تم استدعاء {recallResult.recalledCount} تفاصيل مؤكدة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {recallResult.memories.map((mem) => (
                <div key={mem.id} className="p-3 bg-white dark:bg-neutral-950 rounded-xl border border-purple-200/80 dark:border-purple-800/40 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-stone-900 dark:text-white truncate">
                      {mem.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                      مطابقة {Math.round((mem.relevanceScore || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-neutral-300 leading-relaxed">
                    {mem.content}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-neutral-400 pt-1 border-t border-stone-100 dark:border-neutral-900">
                    <span>{mem.categoryArabic}</span>
                    <span className="italic">{mem.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar for All Memories */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeCategory === "all"
                ? "bg-stone-900 text-white dark:bg-white dark:text-black"
                : "bg-stone-100 dark:bg-neutral-900 text-stone-600 dark:text-neutral-400 hover:bg-stone-200"
            }`}
          >
            جميع الذكريات ({memories.length})
          </button>
          <button
            onClick={() => setActiveCategory("mental_models")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeCategory === "mental_models"
                ? "bg-purple-700 text-white"
                : "bg-stone-100 dark:bg-neutral-900 text-stone-600 dark:text-neutral-400 hover:bg-stone-200"
            }`}
          >
            توجيهات المشرف
          </button>
          <button
            onClick={() => setActiveCategory("world_facts")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeCategory === "world_facts"
                ? "bg-blue-700 text-white"
                : "bg-stone-100 dark:bg-neutral-900 text-stone-600 dark:text-neutral-400 hover:bg-stone-200"
            }`}
          >
            حقائق الجودة
          </button>
          <button
            onClick={() => setActiveCategory("experiences")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeCategory === "experiences"
                ? "bg-emerald-700 text-white"
                : "bg-stone-100 dark:bg-neutral-900 text-stone-600 dark:text-neutral-400 hover:bg-stone-200"
            }`}
          >
            التجارب
          </button>
          <button
            onClick={() => setActiveCategory("observations")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeCategory === "observations"
                ? "bg-amber-700 text-white"
                : "bg-stone-100 dark:bg-neutral-900 text-stone-600 dark:text-neutral-400 hover:bg-stone-200"
            }`}
          >
            الأصناف
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute top-2.5 right-3 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الذاكرة..."
            className="w-full pl-3 pr-8 py-1.5 rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Memories List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-stone-500 dark:text-neutral-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-xs font-bold">جاري تحميل وتحديث بنك ذاكرة Hindsight...</span>
          </div>
        ) : filteredMemories.length > 0 ? (
          filteredMemories.map((mem) => {
            const Icon = categoryIcons[mem.category] || Lightbulb;
            const isCritical = mem.importance === "critical";

            return (
              <div
                key={mem.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isCritical 
                    ? "bg-white dark:bg-[#1C1A18] border-purple-300 dark:border-purple-800/60 shadow-xs" 
                    : "bg-white dark:bg-[#1C1A18] border-stone-200 dark:border-neutral-850"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      mem.category === "mental_models"
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        : mem.category === "world_facts"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : mem.category === "experiences"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-stone-900 dark:text-white">
                          {mem.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCritical
                            ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            : "bg-stone-100 dark:bg-neutral-800 text-stone-700 dark:text-neutral-300"
                        }`}>
                          {mem.categoryArabic}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-stone-100 dark:bg-neutral-850 text-stone-500 dark:text-neutral-400 rounded">
                          أهمية: {mem.importance === "critical" ? "حرجة" : mem.importance === "high" ? "عالية" : "متوسطة"}
                        </span>
                      </div>

                      <p className="text-xs text-stone-700 dark:text-neutral-200 leading-relaxed font-sans">
                        {mem.content}
                      </p>

                      {/* Entities & Tags */}
                      {((mem.entities && mem.entities.length > 0) || (mem.tags && mem.tags.length > 0)) && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
                          {mem.entities?.map((ent, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-neutral-900 text-stone-800 dark:text-neutral-300 border border-stone-200 dark:border-neutral-800 font-medium">
                              #{ent}
                            </span>
                          ))}
                          {mem.tags?.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-2 sm:pt-0">
                    <span className="text-[10px] text-stone-400 dark:text-neutral-500 font-mono">
                      {new Date(mem.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                    <button
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                      title="حذف من الذاكرة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 text-center bg-stone-50 dark:bg-neutral-950/40 rounded-2xl border border-stone-200 dark:border-neutral-800">
            <p className="text-xs text-stone-500 dark:text-neutral-400">
              لا توجد ذكريات تطابق هذا التصنيف أو البحث.
            </p>
          </div>
        )}
      </div>

      {/* Retain New Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-purple-300 dark:border-purple-800/60 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-xl">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900 dark:text-white">
                    تثبيت تفصيلة / توجيه في الذاكرة (Retain Memory)
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-neutral-400">
                    أدخل أي قاعدة أو ملاحظة تريد من التطبيق أن يتذكرها دائماً
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRetainNewMemory} className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="block font-bold text-stone-700 dark:text-neutral-300 mb-1">
                  تصنيف الذاكرة (Memory Category):
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none"
                >
                  <option value="mental_models">نماذج ذهنية وتوجيهات المشرف (Mental Models)</option>
                  <option value="world_facts">حقائق وقواعد الجودة العالمية (World Facts)</option>
                  <option value="experiences">سجل وخبرات تدريب الزملاء (Experiences)</option>
                  <option value="observations">ملاحظات الأصناف والعملاء (Observations)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-neutral-300 mb-1">
                  عنوان التفصيلة أو القاعدة:
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: شرط احتساب معيار الاعتذار، أو قاعدة بديل بنادول أدفانس"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-neutral-300 mb-1">
                  نص التفصيل الكامل الذي تم التأكيد عليه:
                </label>
                <textarea
                  required
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="اكتب التوجيه أو القاعدة التي أكدت عليها بكل وضوح..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-neutral-300 mb-1">
                    درجة الأهمية:
                  </label>
                  <select
                    value={newImportance}
                    onChange={(e) => setNewImportance(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none"
                  >
                    <option value="critical">حرجة وإلزامية (Critical)</option>
                    <option value="high">عالية (High)</option>
                    <option value="medium">متوسطة (Medium)</option>
                    <option value="low">منخفضة (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-neutral-300 mb-1">
                    المصدر:
                  </label>
                  <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-neutral-300 mb-1">
                  الكيانات والكلمات المفتاحية (مفصولة بفاصلة):
                </label>
                <input
                  type="text"
                  value={newEntities}
                  onChange={(e) => setNewEntities(e.target.value)}
                  placeholder="مثال: خطوات الاستشارة، بنادول، كريم، كوتارج"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-400 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>حفظ في الذاكرة الدائمة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
