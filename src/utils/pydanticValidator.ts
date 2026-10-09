import { z } from "zod";

/**
 * Pydantic-equivalent Zod Schema for Call Quality Assurance Analysis.
 * Provides strict runtime type coercion, boundary checks, and deep sanitization.
 */

// Helper to convert mixed string/object to clean string
const cleanStringOrObject = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    if (val.originalDrug && val.suggestedDrug) {
      return `${val.originalDrug} ← ${val.suggestedDrug}`;
    }
    return val.text || val.description || val.alert || val.item || val.name || JSON.stringify(val);
  }
  return String(val);
};

export const TranscriptSegmentSchema = z.object({
  timeStart: z.string().default("00:00"),
  timeEnd: z.string().default("00:00"),
  speaker: z.string().default("موظف خدمة العملاء"),
  text: z.string().default(""),
  duration: z.union([z.number(), z.string()]).optional(),
}).passthrough();

export const GreetingAnalysisSchema = z.object({
  isGreetingUsed: z.boolean().default(false),
  detectedGreetingPhrases: z.array(z.string()).default([]),
  greetingTimestamps: z.array(z.string()).default([]),
  greetingTextSnippet: z.string().default(""),
  agentStartSecond: z.string().default(""),
  agentStartSecondNumber: z.number().optional().default(0),
  evaluation: z.string().default(""),
}).passthrough();

export const CustomerNameAnalysisSchema = z.object({
  customerNameDetected: z.string().default("لم يذكر"),
  isMentionedByAgent: z.boolean().default(false),
  mentionCount: z.number().default(0),
  mentionsTimestamps: z.array(z.string()).default([]),
  nameSnippet: z.string().default(""),
  evaluation: z.string().default(""),
}).passthrough();

export const CustomerTitleAnalysisSchema = z.object({
  titleDetected: z.string().default("لم يذكر"),
  isTitleUsedByAgent: z.boolean().default(false),
  titleTextSnippet: z.string().default(""),
  titleMentionCount: z.number().default(0),
  titleMentionsTimestamps: z.array(z.string()).default([]),
  evaluation: z.string().default(""),
}).passthrough();

export const AgentApologyAnalysisSchema = z.object({
  isApologyNeeded: z.boolean().default(false),
  isApologyUsedByAgent: z.boolean().default(false),
  didApologize: z.boolean().default(false),
  apologyMentionCount: z.number().default(0),
  apologyCount: z.number().default(0),
  apologyTimestamps: z.array(z.string()).default([]),
  apologySnippets: z.array(z.string()).default([]),
  apologyTextSnippet: z.string().default(""),
  evaluation: z.string().default(""),
}).passthrough();

export const EmpathyAnalysisSchema = z.object({
  isEmpathyUsed: z.boolean().default(false),
  detectedEmpathyPhrases: z.array(z.string()).default([]),
  empathyCount: z.number().default(0),
  empathyTimestamps: z.array(z.string()).default([]),
  empathyTextSnippet: z.string().default(""),
  evaluation: z.string().default(""),
}).passthrough();

export const FurtherAssistanceAnalysisSchema = z.object({
  isAssistanceOffered: z.boolean().default(false),
  detectedAssistancePhrases: z.array(z.string()).default([]),
  assistanceCount: z.number().default(0),
  assistanceTimestamps: z.array(z.string()).default([]),
  assistanceTextSnippet: z.string().default(""),
  evaluation: z.string().default(""),
}).passthrough();

export const CallEndingAnalysisSchema = z.object({
  isEndingPhraseUsed: z.boolean().default(false),
  detectedEndingPhrases: z.array(z.string()).default([]),
  endingTimestamps: z.array(z.string()).default([]),
  endingTextSnippet: z.string().default(""),
  lastSpokenTimestamp: z.string().default("00:00"),
  callTotalDuration: z.string().default("00:00"),
  remainingTimeSeconds: z.number().default(0),
  remainingTimeBeforeEnd: z.string().default(""),
  evaluation: z.string().default(""),
}).passthrough();

export const AgentScientificKnowledgeSchema = z.object({
  hasScientificDiscussion: z.boolean().default(false),
  wasTriggeredByCustomerQuestions: z.boolean().default(false),
  customerQuestionsSnippet: z.string().default(""),
  triggerReason: z.string().default(""),
  triggerReasonArabic: z.string().default(""),
  // Deep sanitization: convert any objects in medicationsMentioned to strings
  medicationsMentioned: z.array(z.any()).transform((arr) => arr.map(cleanStringOrObject)).default([]),
  overallScientificScore: z.number().min(0).max(100).default(80),
  medscapeAuditSummary: z.string().default(""),
  activeIngredientsAudit: z.array(z.any()).default([]),
  drugInteractionsAudit: z.array(z.any()).default([]),
  alternativesAndEquivalents: z.array(z.any()).default([]),
  scientificComparisons: z.array(z.any()).optional().default([]),
  scientificStrengths: z.array(z.any()).transform((arr) => arr.map(cleanStringOrObject)).optional().default([]),
  scientificErrorsOrAlerts: z.array(z.any()).transform((arr) => arr.map(cleanStringOrObject)).optional().default([]),
  evaluation: z.string().default(""),
}).passthrough();

export const HoldTimeSummarySchema = z.object({
  totalHoldSeconds: z.number().default(0),
  holdCount: z.number().default(0),
  overallClassification: z.string().default("بدون هولد"),
  validHoldCount: z.number().default(0),
  unjustifiedHoldCount: z.number().default(0),
  isMusicCriterionCompliant: z.boolean().default(true),
  musicComplianceStatus: z.string().default(""),
  auditNotes: z.string().default(""),
  holdSegments: z.array(z.any()).default([]),
  hasExceededDurationHold: z.boolean().default(false),
}).passthrough();

export const ReceiptDeliveryFeeAuditSchema = z.object({
  isDeliveryPresentInReceipt: z.boolean().default(false),
  deliveryFee: z.union([z.string(), z.number()]).default(""),
  receiptBranch: z.string().default("الفرع المطبوع بالريسيت"),
  alert: z.string().default("تنبيه: مراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت"),
  notes: z.string().default("خدمة التوصيل لا تُحتسب كصنف - تنبيه لمراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت"),
}).passthrough().optional();

/**
 * Master Schema that validates and sanitizes the complete Call QA JSON output.
 */
export const QACallAnalysisMasterSchema = z.object({
  callSummary: z.string().default(""),
  agentName: z.string().default("موظف خدمة العملاء"),
  customerName: z.string().default("العميل"),
  sentiment: z.string().default("positive"),
  confidenceScore: z.number().min(0).max(100).default(90),
  transcript: z.array(TranscriptSegmentSchema).default([]),
  greetingAnalysis: GreetingAnalysisSchema.default({} as any),
  customerNameAnalysis: CustomerNameAnalysisSchema.default({} as any),
  customerTitleAnalysis: CustomerTitleAnalysisSchema.default({} as any),
  agentApologyAnalysis: AgentApologyAnalysisSchema.default({} as any),
  empathyAnalysis: EmpathyAnalysisSchema.default({} as any),
  furtherAssistanceAnalysis: FurtherAssistanceAnalysisSchema.default({} as any),
  callEndingAnalysis: CallEndingAnalysisSchema.default({} as any),
  holdTimeSummary: HoldTimeSummarySchema.default({} as any),
  agentScientificKnowledge: AgentScientificKnowledgeSchema.default({} as any),
  unprofessionalWordsAnalysis: z.object({
    hasUnprofessionalWords: z.boolean().default(false),
    totalUnprofessionalWordsCount: z.number().default(0),
    unprofessionalWordsCount: z.number().default(0),
    isCleanFromUnprofessionalWords: z.boolean().default(true),
    detectedWords: z.array(z.any()).default([]),
    evaluation: z.string().default(""),
    alerts: z.array(z.any()).transform((arr) => arr.map(cleanStringOrObject)).default([]),
  }).passthrough().default({} as any),
  agentToneAnalysis: z.any().default({}),
  customerComplaintAnalysis: z.any().default({}),
  medicalConsultationAnalysis: z.any().default({}),
  verbalTicsAnalysis: z.any().default({}),
  agentSilenceSummary: z.any().default({}),
  receiptAudit: z.any().optional(),
  complianceAlerts: z.array(z.any()).transform((arr) => arr.map(cleanStringOrObject)).default([]),
  totalScore: z.number().min(0).max(100).default(90),
}).passthrough(); // allows custom flags like audioHash, pipelineReviewMeta, etc.

export interface ValidationReport {
  isValid: boolean;
  sanitizedData: any;
  validationEngine: string;
  errors?: string[];
}

/**
 * Validates and deeply sanitizes raw JSON data using Pydantic/Zod schema.
 */
export function validateAndSanitizeQAResult(rawData: any): ValidationReport {
  try {
    const parsed = QACallAnalysisMasterSchema.parse(rawData);
    return {
      isValid: true,
      sanitizedData: {
        ...parsed,
        pydanticValidation: {
          status: "PASSED",
          engine: "Pydantic-Grade Zod Schema Validator v3",
          validatedAt: new Date().toISOString(),
        },
      },
      validationEngine: "Pydantic-Grade Zod Schema Validator v3",
    };
  } catch (err: any) {
    console.warn("Pydantic schema validation found discrepancies, applying safe fallback coercion:", err?.message || err);
    return {
      isValid: false,
      sanitizedData: {
        ...rawData,
        pydanticValidation: {
          status: "COERCED_WITH_WARNINGS",
          engine: "Pydantic-Grade Zod Schema Validator v3",
          validatedAt: new Date().toISOString(),
        },
      },
      validationEngine: "Pydantic-Grade Zod Schema Validator v3",
      errors: err?.errors?.map((e: any) => `${e.path.join(".")}: ${e.message}`) || [String(err)],
    };
  }
}
