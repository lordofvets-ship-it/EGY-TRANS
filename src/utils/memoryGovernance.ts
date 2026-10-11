/**
 * Governance rules for the Hindsight memory bank.
 * Memories marked "critical" (or of category mental_models) are injected into EVERY analysis prompt,
 * so they must be (1) QA rules rather than developer instructions, (2) not tied to a single call,
 * and (3) kept within a prompt budget.
 */

export interface MemoryInput {
  title?: string;
  content?: string;
  category?: string;
  importance?: string;
  /** "global" (default) applies to every call; "call-specific" memories are never auto-injected as directives. */
  scope?: "global" | "call-specific";
}

export interface GovernanceResult {
  ok: boolean;
  reasons: string[];
}

const DEV_PATTERNS: Array<[RegExp, string]> = [
  [/\bresult\.[a-zA-Z_]+/, "يحتوي على إشارة إلى كود برمجي (result.*)؛ هذه تعليمات مبرمج وليست قاعدة جودة"],
  [/\b(App|server|index)\.(tsx?|jsx?)\b/i, "يشير إلى ملف برمجي"],
  [/\b(useState|useEffect|localStorage|express|endpoint|API\s*route|npm\s)/i, "يحتوي على مصطلحات تطوير برمجي"],
  [/(تحديث\s+حالة|واجهة\s+المستخدم|زر\s+ال|تبويب\s+سحب|الواجهة\s+الإنجليزية)/, "يتعلق بالواجهة وليس بتقييم المكالمات"],
];

const CALL_SPECIFIC_PATTERNS: Array<[RegExp, string]> = [
  // "المكالمة الحالية" is deliberately NOT matched: legitimate rules use it generically ("من منطوق المكالمة الحالية").
  [/(في\s+(هذه|تلك)\s+المكالمة|مكالمة\s+(الأمس|اليوم))/, "مرتبط بمكالمة بعينها"],
  [/اسم\s+(?:ال)?عميل[ةه]?\s+(?:في\s+(?:هذه|تلك)\s+المكالمة\s+)?(?:هو|هي)\s+['"«]/, "يثبّت اسم عميل محدد"],
];

export const MAX_DIRECTIVE_CHARS = 1500;
export const AUTHORITATIVE_BUDGET_CHARS = Number(process.env.MEMORY_AUTHORITATIVE_MAX_CHARS) || 6000;

export function validateMemoryInput(m: MemoryInput): GovernanceResult {
  const reasons: string[] = [];
  const text = `${m.title || ""}\n${m.content || ""}`;
  const injectsEverywhere = m.importance === "critical" || m.category === "mental_models";

  if (!String(m.title || "").trim() || !String(m.content || "").trim()) reasons.push("العنوان والمحتوى مطلوبان");
  if ((m.content || "").length > MAX_DIRECTIVE_CHARS) reasons.push(`المحتوى أطول من ${MAX_DIRECTIVE_CHARS} حرفاً؛ قسّمه إلى قواعد أقصر`);

  for (const [re, why] of DEV_PATTERNS) if (re.test(text)) reasons.push(why);

  if (injectsEverywhere) {
    if (m.scope === "call-specific") reasons.push("الذاكرة الحرجة تُحقن في كل مكالمة ولا يجوز أن تكون خاصة بمكالمة واحدة");
    for (const [re, why] of CALL_SPECIFIC_PATTERNS) if (re.test(text)) reasons.push(why + " — سجّلها كـ«خبرة» (experience) بدلاً من قاعدة حرجة");
  }
  return { ok: reasons.length === 0, reasons };
}

/** Keeps the injected directives within the prompt budget: most important/newest first. */
export function applyAuthoritativeBudget<T extends { title: string; content: string; importance?: string; createdAt?: string }>(
  memories: T[],
  budget = AUTHORITATIVE_BUDGET_CHARS
): { kept: T[]; dropped: T[] } {
  const rank = (x: T) => (x.importance === "critical" ? 0 : 1);
  const sorted = [...memories].sort((a, b) => rank(a) - rank(b) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const kept: T[] = [];
  const dropped: T[] = [];
  let used = 0;
  for (const m of sorted) {
    const size = m.title.length + m.content.length;
    if (used + size <= budget) { kept.push(m); used += size; } else dropped.push(m);
  }
  return { kept, dropped };
}
