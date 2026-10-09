import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Award, 
  CheckCircle2, 
  Clock, 
  Music, 
  Headphones, 
  FileSpreadsheet, 
  ArrowRight,
  Download,
  AlertCircle,
  FileText,
  Volume2,
  Stethoscope,
  Smile,
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { TranscriptionResponse, TranscriptItem, MeasurementItemId } from "../types";
import { exportEvaluationToExcel } from "../utils/exportToExcel";
import { Language, translations } from "../utils/translations";

interface BenchmarkTabViewProps {
  onBackToHome: () => void;
  onOpenExcelModal?: (benchmarkResult: TranscriptionResponse) => void;
  language?: Language;
  isMeasurementVisible?: (id: MeasurementItemId) => boolean;
}

export const BenchmarkTabView: React.FC<BenchmarkTabViewProps> = ({
  onBackToHome,
  onOpenExcelModal,
  language = "ar",
  isMeasurementVisible,
}) => {
  const currentLang = language || "ar";
  const t = translations[currentLang] || translations.ar;
  const [benchmarkData, setBenchmarkData] = useState<TranscriptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"scorecard" | "tone" | "silence" | "transcript" | "medical">("scorecard");

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/benchmark-call")
      .then((res) => res.json())
      .then((data: TranscriptionResponse) => {
        setBenchmarkData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load benchmark call:", err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (isMeasurementVisible) {
      if (activeSection === "tone" && !isMeasurementVisible("agentTone")) {
        setActiveSection("scorecard");
      } else if (activeSection === "silence" && !isMeasurementVisible("silence") && !isMeasurementVisible("holdTime")) {
        setActiveSection("scorecard");
      } else if (activeSection === "medical" && !isMeasurementVisible("medicalConsultation") && !isMeasurementVisible("scientificKnowledge")) {
        setActiveSection("scorecard");
      }
    }
  }, [isMeasurementVisible, activeSection]);

  const handleExport = () => {
    if (!benchmarkData) return;
    if (onOpenExcelModal) {
      onOpenExcelModal(benchmarkData);
    } else {
      exportEvaluationToExcel(benchmarkData, "Benchmark_Call_QA_Evaluation.xlsx");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Top Benchmark Header Banner */}
      <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-amber-200 dark:border-amber-900/40 p-6 shadow-xs space-y-4 transition-colors relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 end-0 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D9] dark:border-stone-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
                  {currentLang === "en" ? "Certified Benchmark Call (QA Benchmark)" : "المكالمة المعيارية المعتمدة (BENCHMARK)"}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30 font-mono">
                  REFERENCE QA
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
                {currentLang === "en" 
                  ? "Standard reference model for pharmaceutical contact center quality auditing and agent calibration"
                  : "المكالمة النموذجية المعتمدة لتدقيق جودة خدمة العملاء وضبط معايير التقييم الصيدلاني"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {benchmarkData && (
              <button
                type="button"
                onClick={handleExport}
                className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                title={currentLang === "en" ? "Export Benchmark to Excel" : "تصدير تقرير الإكسيل"}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{currentLang === "en" ? "Export Excel (.xlsx)" : "تصدير إكسيل"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBackToHome}
              className="py-2 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRight className={`w-3.5 h-3.5 ${currentLang === "en" ? "rotate-180" : ""}`} />
              <span>{t.tabs.home}</span>
            </button>
          </div>
        </div>

        {/* Benchmark Standards Badges Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{currentLang === "en" ? "Zero silence >10s" : "استبعاد الصمت الطبيعي (≤10ث) • صفر مخالفات"}</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1 font-bold">
            <Music className="w-3.5 h-3.5" />
            <span>{currentLang === "en" ? "2 Holds with Music Compliance" : "2 هولد مبررين ومصحوبين بموسيقى انتظار"}</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1 font-bold">
            <Award className="w-3.5 h-3.5" />
            <span>{currentLang === "en" ? "Overall Score: 86%" : "معدل التقييم العام: 86%"}</span>
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-600 dark:text-stone-300 font-bold">
            {currentLang === "en" ? "Loading certified benchmark call..." : "جاري استدعاء بيانات المكالمة المعيارية المعتمدة..."}
          </p>
        </div>
      )}

      {benchmarkData && (
        <>
          {/* Official Benchmark Evaluator Notes Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{currentLang === "en" ? "Certified Evaluator Calibration Notes:" : "ملاحظات وتوصيات المقيم المعياري المعتمدة:"}</span>
            </div>
            <p className="text-amber-950 dark:text-amber-300 leading-relaxed font-medium">
              {benchmarkData.benchmarkNotes || (currentLang === "en" 
                ? "The benchmark call includes 2 review holds (system check & order verification) strictly accompanied by hold music. Tone note: lacks a warm smile and shows slight hesitation." 
                : "المكالمة بها 2 هولد مراجعة (هولد مراجعة السيستم وتوفر الأصناف، وهولد مراجعة تفاصيل وتأكيد الأوردر) مع ربط معيار الهولد بوجود موسيقى الانتظار - نبرة الصوت: ينقصها الابتسامة وبها تردد أحياناً.")}
            </p>
          </div>

          {/* Section Navigation Pills */}
          <div className="flex items-center gap-2 border-b border-[#EAE3D9] dark:border-stone-800 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSection("scorecard")}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSection === "scorecard"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 border border-[#EAE3D9] dark:border-stone-700"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{currentLang === "en" ? "KPI Scorecard" : "بطاقة مؤشرات الأداء"}</span>
            </button>

            {(!isMeasurementVisible || isMeasurementVisible("agentTone")) && (
              <button
                type="button"
                onClick={() => setActiveSection("tone")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeSection === "tone"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 border border-[#EAE3D9] dark:border-stone-700"
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>{currentLang === "en" ? "Voice Tone & Emotion" : "نبرة ومشاعر الصوت"}</span>
              </button>
            )}

            {(!isMeasurementVisible || isMeasurementVisible("silence") || isMeasurementVisible("holdTime")) && (
              <button
                type="button"
                onClick={() => setActiveSection("silence")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeSection === "silence"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 border border-[#EAE3D9] dark:border-stone-700"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{currentLang === "en" ? "Silence & Hold Audit" : "تدقيق الصمت والهولد"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveSection("transcript")}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSection === "transcript"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 border border-[#EAE3D9] dark:border-stone-700"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{currentLang === "en" ? "Full Transcript" : "التفريغ الصوتي الكامل"}</span>
            </button>

            {(!isMeasurementVisible || isMeasurementVisible("medicalConsultation") || isMeasurementVisible("scientificKnowledge")) && (
              <button
                type="button"
                onClick={() => setActiveSection("medical")}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeSection === "medical"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 border border-[#EAE3D9] dark:border-stone-700"
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>{currentLang === "en" ? "Pharma Protocol" : "البروتوكول الصيدلاني"}</span>
              </button>
            )}
          </div>

          {/* Section 1: KPI Scorecard */}
          {activeSection === "scorecard" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 space-y-1 shadow-xs">
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                  {currentLang === "en" ? "Overall Call Accuracy" : "الدرجة الكلية للمكالمة"}
                </span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {benchmarkData.evaluation?.overallScore || 86}%
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold">
                  {currentLang === "en" ? "Passed (Very Good)" : "ناجح (جيد جداً)"}
                </span>
              </div>

              {(!isMeasurementVisible || isMeasurementVisible("holdTime")) && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 space-y-1 shadow-xs">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    {currentLang === "en" ? "Hold Compliance" : "التزام معايير الهولد"}
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    100%
                  </div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                    {currentLang === "en" ? "2 holds with music" : "2 هولد مصحوبين بالموسيقى"}
                  </span>
                </div>
              )}

              {(!isMeasurementVisible || isMeasurementVisible("silence")) && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 space-y-1 shadow-xs">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    {currentLang === "en" ? "Silence >10s" : "فترات الصمت المفرط (>10ث)"}
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    0
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                    {currentLang === "en" ? "Zero dead-air violations" : "خالية من الصمت المفرط"}
                  </span>
                </div>
              )}

              {(!isMeasurementVisible || isMeasurementVisible("agentTone")) && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 space-y-1 shadow-xs">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    {currentLang === "en" ? "Tone Evaluation" : "تقييم نبرة الصوت"}
                  </span>
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 pt-1">
                    {currentLang === "en" ? "Needs Warm Smile" : "ينقصها الابتسامة"}
                  </div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                    {currentLang === "en" ? "Occasional hesitation" : "بها تردد خفيف أحياناً"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Section: Tone & Emotion Analysis */}
          {activeSection === "tone" && (!isMeasurementVisible || isMeasurementVisible("agentTone")) && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-violet-200 dark:border-violet-900/40 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#EAE3D9] dark:border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    <div>
                      <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <span>{currentLang === "en" ? "Voice Tone & Emotion Measurement" : "قياس نبرة ومشاعر صوت الزميل"}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold border border-violet-300 dark:border-violet-800">
                          التحليل الصوتي الترددي
                        </span>
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        {currentLang === "en"
                          ? "Physical acoustic analysis of agent's voice both in introduction and throughout the call."
                          : "تحليل صوتي فيزيائي دقيق لنبرة صوت الزميل في المقدمة الترحيبية وطوال سير المكالمة."}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    Acoustic-Emotion-Engine
                  </span>
                </div>

                {/* 2 Segments: Introduction vs During Call */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/70 dark:border-violet-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-950 dark:text-violet-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500" />
                        {currentLang === "en" ? "1. Introduction Greeting Tone" : "1. نبرة الزميل في المقدمة (الافتتاحية):"}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-200/60 dark:bg-violet-900/60 text-violet-900 dark:text-violet-200 font-bold">
                        {benchmarkData.agentToneAnalysis?.wav2vec2Emotion?.introduction?.dominantEmotionArabic || "رسمية محايدة (ينقصها الابتسامة)"}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                      {benchmarkData.agentToneAnalysis?.wav2vec2Emotion?.introduction?.acousticNotes ||
                        benchmarkData.agentToneAnalysis?.introductionSummary ||
                        "افتتاحية رسمية خالية من الابتسامة الصوتية، مع رصد ذبذبات تردد بنسبة 21% عند التحية الأولية."}
                    </p>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold pt-1 border-t border-violet-200/50 dark:border-violet-900/30 flex items-center gap-1">
                      <span>⚠ مؤشر الابتسامة بالمقدمة: ينقصها الابتسامة وبها تردد أحياناً</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/70 dark:border-violet-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-950 dark:text-violet-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {currentLang === "en" ? "2. Ongoing Call Tone" : "2. نبرة الزميل أثناء سير المكالمة:"}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-200/60 dark:bg-violet-900/60 text-violet-900 dark:text-violet-200 font-bold">
                        {benchmarkData.agentToneAnalysis?.wav2vec2Emotion?.duringCall?.dominantEmotionArabic || "محايدة مع تردد متقطع"}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                      {benchmarkData.agentToneAnalysis?.wav2vec2Emotion?.duringCall?.acousticNotes ||
                        benchmarkData.agentToneAnalysis?.callSummary ||
                        "استمرار الطابع الرسمي الجاف وغياب الابتسامة (Happy: 7%) مع تردد ملحوظ (16%) عند مراجعة أصناف الأوردر."}
                    </p>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold pt-1 border-t border-violet-200/50 dark:border-violet-900/30 flex items-center gap-1">
                      <span>⚠ مؤشر الابتسامة أثناء المكالمة: ينقصها الابتسامة وبها تردد أحياناً</span>
                    </div>
                  </div>
                </div>

                {/* Spectrum */}
                {benchmarkData.agentToneAnalysis?.wav2vec2Emotion?.allScores && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs text-stone-800 dark:text-stone-200 font-bold block">
                      {currentLang === "en" ? "Full Emotion Spectrum:" : "طيف الترددات الصوتية لكافة المشاعر:"}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {benchmarkData.agentToneAnalysis.wav2vec2Emotion.allScores.map((scoreItem, sIdx) => {
                        const isDominant = scoreItem.label === benchmarkData.agentToneAnalysis?.wav2vec2Emotion?.dominantEmotion;
                        return (
                          <div
                            key={sIdx}
                            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                              isDominant
                                ? "bg-violet-100/70 dark:bg-violet-950/40 border-violet-400 dark:border-violet-700"
                                : "bg-stone-50 dark:bg-stone-800/40 border-[#EAE3D9] dark:border-stone-800"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span className="text-stone-800 dark:text-stone-200">
                                {scoreItem.labelArabic}
                              </span>
                              <span className="font-mono text-stone-600 dark:text-stone-300">
                                {scoreItem.percentage}%
                              </span>
                            </div>
                            <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full bg-violet-600 dark:bg-violet-400"
                                style={{ width: `${Math.min(100, Math.max(3, scoreItem.percentage))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Silence & Hold Audit */}
          {activeSection === "silence" && (
            <div className="space-y-4">
              {(!isMeasurementVisible || isMeasurementVisible("holdTime")) && (
                <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <Music className="w-4 h-4 text-indigo-600" />
                    <span>{currentLang === "en" ? "Hold Intervals & Music Auditing" : "تدقيق فترات الهولد وموسيقى الانتظار المعتمدة:"}</span>
                  </h3>

                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-indigo-900 dark:text-indigo-200">
                          {currentLang === "en" ? "Hold 1: System & Availability Check (00:19 - 00:31)" : "الهولد الأول: مراجعة السيستم وتوفر الأصناف (00:19 - 00:31)"}
                        </div>
                        <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          {currentLang === "en" ? "Duration: 12 seconds • Music detected from start to finish ✓" : "المدة: 12 ثانية • استئذان العميل + موسيقى الانتظار مستمرة طوال الفترة ✓"}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                        {currentLang === "en" ? "Compliant" : "مطابق للمعيار"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-indigo-900 dark:text-indigo-200">
                          {currentLang === "en" ? "Hold 2: Order Detail Confirmation (01:11 - 01:24)" : "الهولد الثاني: مراجعة وتأكيد تفاصيل الأوردر (01:11 - 01:24)"}
                        </div>
                        <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          {currentLang === "en" ? "Duration: 13 seconds • Music detected • Thanked customer upon return ✓" : "المدة: 13 ثانية • استئذان + موسيقى انتظار + شكر العميل بعد العودة ✓"}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                        {currentLang === "en" ? "Compliant" : "مطابق للمعيار"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(!isMeasurementVisible || isMeasurementVisible("silence")) && (
                <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-5 shadow-xs space-y-2">
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>{currentLang === "en" ? "Silence Analysis Standard (>10s)" : "معيار فترات الصمت غير المبرر (> 10 ثوانٍ):"}</span>
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {currentLang === "en" 
                      ? "Normal natural pauses (≤ 10s) are fully excluded per protocol. This benchmark recording has zero silence violations."
                      : "تم استبعاد فترات الصمت الطبيعي (10 ثوانٍ أو أقل) تلقائياً، ولم يتم تسجيل أي فترة صمت مفرط تتجاوز 10 ثوانٍ في هذه المكالمة المعيارية."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Full Diarized Transcript */}
          {activeSection === "transcript" && (
            <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAE3D9] dark:border-stone-800">
                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C25E38]" />
                  <span>{currentLang === "en" ? "Diarized Egyptian Arabic Transcript" : "نص المحادثة الكامل بالعامية المصرية (مفرّغ صوتياً):"}</span>
                </h3>
                <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                  {benchmarkData.transcript?.length || 0} {currentLang === "en" ? "segments" : "مقطع"}
                </span>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pe-1">
                {benchmarkData.transcript?.map((item: TranscriptItem, idx: number) => {
                  const isAgent = item.speaker.includes("موظف") || item.speaker.includes("كول سنتر");
                  const isHold = item.speaker.includes("هولد") || item.speaker.includes("موسيقى");

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1 transition-colors ${
                        isHold
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200"
                          : isAgent
                          ? "bg-amber-50/40 dark:bg-amber-950/15 border-amber-200/50 dark:border-amber-900/30 text-stone-900 dark:text-stone-100"
                          : "bg-[#FAF8F5]/80 dark:bg-stone-850/60 border-[#EAE3D9] dark:border-stone-800 text-stone-900 dark:text-stone-100"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={isHold ? "text-indigo-600 dark:text-indigo-400" : isAgent ? "text-amber-700 dark:text-amber-400" : "text-stone-600 dark:text-stone-400"}>
                          {item.speaker}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">
                          {item.timeStart} - {item.timeEnd}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Pharmaceutical Protocol Review */}
          {activeSection === "medical" && (
            <div className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#EAE3D9] dark:border-stone-800 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-emerald-600" />
                <span>{currentLang === "en" ? "Medical Protocol & Medscape Review" : "المراجعة الطبية والصيدلانية المعتمدة:"}</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">
                    {currentLang === "en" ? "1. Prescription & Dosage Inquiry" : "1. التحقق من الجرعة والاستفسار الطبي"}
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed">
                    {currentLang === "en" 
                      ? "The pharmacist inquired about the dosage and confirmed that Augmentin 1g is appropriate according to the medical recommendation."
                      : "قام الصيدلي بالاستفسار عن الجرعة وتأكيد أن تركيز الأوجمنتين واحد جرام هو المناسب حسب التوصية الطبية للحالة."}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">
                    {currentLang === "en" ? "2. Active Ingredients & Interaction Check" : "2. مطابقة المادة الفعالة والتداخلات الدوائية"}
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed">
                    {currentLang === "en"
                      ? "Verified Paracetamol + Amoxicillin/Clavulanate compatibility without adverse drug interactions."
                      : "تمت مراجعة البنادول أزرق (باراسيتامول) مع الأوجمنتين (أموكسيسيلين + كلافولانيك) والتأكد من عدم وجود تعارض أو تداخل دوائي."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
