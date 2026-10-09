/**
 * Multi-Review Consensus Engine
 * Implements: Review 1 -> Review 2 -> Compare Results -> (If SAME -> Final; If DIFFERENT -> Review 3 Arbiter -> Final)
 */

export interface ComparisonResult {
  isConsistent: boolean;
  discrepancies: string[];
  agreementScore: number; // 0 to 100%
  checkedCriteriaCount: number;
}

/**
 * Compares two QA evaluation reviews across core quality criteria.
 */
export function compareEvaluationReviews(rev1: any, rev2: any): ComparisonResult {
  const discrepancies: string[] = [];
  let agreedCount = 0;
  const totalCriteria = 8;

  // 1. Greeting Check
  const g1 = !!rev1?.greetingAnalysis?.isGreetingUsed;
  const g2 = !!rev2?.greetingAnalysis?.isGreetingUsed;
  if (g1 === g2) {
    agreedCount++;
  } else {
    discrepancies.push(`الترحيب: مراجعة 1 سجلت (${g1 ? "تم الترحيب" : "لم يتم"}) بينما مراجعة 2 سجلت (${g2 ? "تم الترحيب" : "لم يتم"})`);
  }

  // 2. Customer Name Mention
  const n1 = !!rev1?.customerNameAnalysis?.isMentionedByAgent;
  const n2 = !!rev2?.customerNameAnalysis?.isMentionedByAgent;
  const name1 = String(rev1?.customerNameAnalysis?.customerNameDetected || "").trim();
  const name2 = String(rev2?.customerNameAnalysis?.customerNameDetected || "").trim();
  if (n1 === n2 && (name1 === name2 || !n1)) {
    agreedCount++;
  } else {
    discrepancies.push(`ذكر اسم العميل: مراجعة 1 سجلت (${n1 ? `تم الذكر: ${name1}` : "لم يُذكر"}) بينما مراجعة 2 سجلت (${n2 ? `تم الذكر: ${name2}` : "لم يُذكر"})`);
  }

  // 3. Customer Title
  const t1 = !!rev1?.customerTitleAnalysis?.isTitleUsedByAgent;
  const t2 = !!rev2?.customerTitleAnalysis?.isTitleUsedByAgent;
  if (t1 === t2) {
    agreedCount++;
  } else {
    discrepancies.push(`لقب العميل: مراجعة 1 سجلت (${t1 ? "استُخدم لقب" : "لم يُستخدم"}) بينما مراجعة 2 سجلت (${t2 ? "استُخدم لقب" : "لم يُستخدم"})`);
  }

  // 4. Apology Check
  const ap1 = !!rev1?.agentApologyAnalysis?.didApologize;
  const ap2 = !!rev2?.agentApologyAnalysis?.didApologize;
  if (ap1 === ap2) {
    agreedCount++;
  } else {
    discrepancies.push(`الاعتذار: مراجعة 1 سجلت (${ap1 ? "اعتذر" : "لم يعتذر"}) ومراجعة 2 سجلت (${ap2 ? "اعتذر" : "لم يعتذر"})`);
  }

  // 5. Further Assistance Offer
  const as1 = !!rev1?.furtherAssistanceAnalysis?.isAssistanceOffered;
  const as2 = !!rev2?.furtherAssistanceAnalysis?.isAssistanceOffered;
  if (as1 === as2) {
    agreedCount++;
  } else {
    discrepancies.push(`عرض خدمات أخرى: مراجعة 1 سجلت (${as1 ? "تم العرض" : "لم يتم"}) ومراجعة 2 سجلت (${as2 ? "تم العرض" : "لم يتم"})`);
  }

  // 6. Call Ending
  const e1 = !!rev1?.callEndingAnalysis?.isEndingPhraseUsed;
  const e2 = !!rev2?.callEndingAnalysis?.isEndingPhraseUsed;
  if (e1 === e2) {
    agreedCount++;
  } else {
    discrepancies.push(`إنهاء المكالمة بالصيغة: مراجعة 1 (${e1 ? "مطابق" : "غير مطابق"}) ومراجعة 2 (${e2 ? "مطابق" : "غير مطابق"})`);
  }

  // 7. Hold Classification
  const h1 = String(rev1?.holdTimeSummary?.overallClassification || "");
  const h2 = String(rev2?.holdTimeSummary?.overallClassification || "");
  if (h1 === h2) {
    agreedCount++;
  } else {
    discrepancies.push(`تصنيف الهولد: مراجعة 1 (${h1}) ومراجعة 2 (${h2})`);
  }

  // 8. Scientific Substitutes / Alternatives Consistency
  const alts1 = Array.isArray(rev1?.agentScientificKnowledge?.alternativesAndEquivalents) ? rev1.agentScientificKnowledge.alternativesAndEquivalents.length : 0;
  const alts2 = Array.isArray(rev2?.agentScientificKnowledge?.alternativesAndEquivalents) ? rev2.agentScientificKnowledge.alternativesAndEquivalents.length : 0;
  if (alts1 === alts2 || Math.abs(alts1 - alts2) <= 1) {
    agreedCount++;
  } else {
    discrepancies.push(`جدول البدائل والمثائل: مراجعة 1 رصدت (${alts1}) أصناف ومراجعة 2 رصدت (${alts2}) أصناف`);
  }

  const agreementScore = Math.round((agreedCount / totalCriteria) * 100);
  const isConsistent = discrepancies.length === 0;

  return {
    isConsistent,
    discrepancies,
    agreementScore,
    checkedCriteriaCount: totalCriteria,
  };
}

/**
 * Builds the Arbiter prompt for Review 3 when Review 1 and Review 2 have discrepancies.
 */
export function buildArbiterPrompt(discrepancies: string[], rev1Summary: string, rev2Summary: string): string {
  return `
[مهمة التحكيم الصيدلاني المرجعي الحاسم - Review 3 Arbiter & Tie-Breaker]:
تم إجراء فحصين متقدمين ومستقلين للمكالمة، وظهرت خلافات فنية محددة في المعايير التالية:
${discrepancies.map((d, i) => `${i + 1}. ${d}`).join("\n")}

خلاصة فحص المراجعة الأولى (Review 1):
${rev1Summary}

خلاصة فحص المراجعة الثانية (Review 2):
${rev2Summary}

التوجيه الإلزامي الحاسم للمحكم (Review 3):
استمع للترددات الصوتية والتفريغ الحرفي بأعلى درجات التركيز وافصل بشكل قاطع في هذه النقاط المختلف عليها تحديداً.
أصدر القرار النهائي الصارم مع توثيق التوقيت الزمني الدقيق (MM:SS) والنص المنطوق الفعلي، واعتمد النسخة النهائية الموحدة بدقة 100%.
`;
}
