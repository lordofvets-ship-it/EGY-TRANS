import type { TranscriptionResponse, AnalyzedCallRecord } from "../types.ts";

/**
 * Generates a deterministic short hash from transcript turns if audioHash is not present.
 */
export function getDeterministicCallId(result: TranscriptionResponse): string {
  if (result.audioHash && String(result.audioHash).trim()) {
    return `call-${String(result.audioHash).trim()}`;
  }
  const turnsKey = (result.transcript || [])
    .slice(0, 12)
    .map((t) => `${t.timeStart || ""}:${t.speaker || ""}:${(t.text || "").slice(0, 30)}`)
    .join("|");
  let hash = 5381;
  for (let i = 0; i < turnsKey.length; i++) {
    hash = ((hash << 5) + hash) ^ turnsKey.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `call-${hex}-${(result.transcript || []).length}`;
}

/**
 * Extracts colleague (agent) name from result.agentName or opening agent turns.
 */
export function resolveAgentNameFromResult(result: TranscriptionResponse, customName?: string): string {
  if (customName && customName.trim() && customName !== "الزميل (محلل المكالمة)") {
    return customName.trim();
  }
  if (result.agentName && String(result.agentName).trim()) {
    const raw = String(result.agentName).trim();
    return raw.startsWith("د.") || raw.startsWith("دكتور") ? raw : `د. ${raw}`;
  }

  // Search opening agent turns in transcript
  const agentTurns = (result.transcript || [])
    .filter((t) => !String(t.speaker || "").includes("العميل") && !String(t.speaker || "").includes("صمت"))
    .slice(0, 4);

  const searchTexts = [
    ...agentTurns.map((t) => String(t.text || "")),
    String(result.greetingAnalysis?.greetingTextSnippet || ""),
  ];

  const stopWords = new Set([
    "أتشرف", "اتشرف", "تشرف", "الاسم", "إسم", "اسم", "يا", "فندم", "أهلاً", "اهلا",
    "تحت", "أمرك", "امرك", "حاضر", "ثواني", "لحظات", "مساء", "صباح", "الخير"
  ]);

  for (const text of searchTexts) {
    // Pattern 1: "مع حضرتك <name>" or "معاك <name>"
    const m1 = text.match(/(?:مع\s+حضرتك|معاك[ي]?)\s+(?:دكتور[ةه]?|د\.)?\s*([أ-يa-zA-Z]+(?:\s+[أ-يa-zA-Z]+)?)/i);
    if (m1 && m1[1]) {
      const words = m1[1].trim().split(/\s+/).filter((w) => !stopWords.has(w));
      if (words.length > 0) {
        const name = words.slice(0, 2).join(" ");
        return `د. ${name}`;
      }
    }
    // Pattern 2: "الطرشوبي <name> مع حضرتك"
    const m2 = text.match(/الطرشوبي[،,\s]+(?:دكتور[ةه]?|د\.)?\s*([أ-يa-zA-Z]+)\s+مع\s+حضرتك/i);
    if (m2 && m2[1] && !stopWords.has(m2[1].trim())) {
      return `د. ${m2[1].trim()}`;
    }
  }

  if (result.isBenchmark) {
    return "د. أحمد (المكالمة المعيارية المعتمدة)";
  }
  return "الزميل (محلل المكالمة)";
}

/**
 * Computes a realistic overall QA percentage score (0-100) from the evaluated criteria.
 */
export function computeOverallQAScore(result: TranscriptionResponse): number {
  let earned = 0;
  let totalWeight = 0;

  // 1. Greeting (12 pts)
  totalWeight += 12;
  if (result.greetingAnalysis?.isGreetingUsed) earned += 12;

  // 2. Agent Tone (15 pts)
  totalWeight += 15;
  // Missing tone evidence must not silently receive an above-neutral score.
  const rawToneScore = result.agentToneAnalysis?.score;
  const toneScore = rawToneScore == null || !Number.isFinite(Number(rawToneScore)) ? 0 : Number(rawToneScore);
  earned += Math.min(15, Math.max(0, (toneScore / 10) * 15));

  // 3. Customer Name (10 pts)
  totalWeight += 10;
  if (result.customerNameAnalysis?.isMentionedByAgent) {
    earned += 10;
  } else if (
    !result.customerNameAnalysis?.customerNameDetected ||
    result.customerNameAnalysis.customerNameDetected === "لم يذكر"
  ) {
    earned += 7; // Partial if customer never clearly gave name or only in passing
  }

  // 4. Customer Title (8 pts)
  totalWeight += 8;
  if (result.customerTitleAnalysis?.isTitleUsedByAgent) {
    earned += 8;
  } else if (
    !result.customerTitleAnalysis?.titleDetected ||
    result.customerTitleAnalysis.titleDetected === "لم يذكر" ||
    result.customerTitleAnalysis.titleDetected === "غير محدد"
  ) {
    earned += 8; // Not penalized if no formal title was stated by customer
  }

  // 5. Apology when needed (10 pts)
  totalWeight += 10;
  if (result.agentApologyAnalysis?.isApologyNeeded) {
    if (result.agentApologyAnalysis.isApologyUsedByAgent) earned += 10;
  } else {
    earned += 10;
  }

  // 6. Hold compliance (12 pts)
  totalWeight += 12;
  if ((result.holdTimeSummary?.holdCount || 0) > 0) {
    let holdPts = 6;
    if (result.holdTimeSummary?.isMusicCriterionCompliant) holdPts += 3;
    if (!String(result.holdTimeSummary?.overallClassification || "").includes("بدون داعي")) holdPts += 3;
    earned += holdPts;
  } else {
    earned += 12;
  }

  // 7. Silence / Dead Air (10 pts)
  totalWeight += 10;
  if ((result.agentSilenceSummary?.silenceCount || 0) === 0) {
    earned += 10;
  } else if ((result.agentSilenceSummary?.totalSilenceSeconds || 0) <= 30) {
    earned += 8;
  } else {
    earned += 5;
  }

  // 8. Further Assistance (8 pts)
  totalWeight += 8;
  if (result.furtherAssistanceAnalysis?.isAssistanceOffered) {
    earned += 8;
  }

  // 9. Call Ending (8 pts)
  totalWeight += 8;
  if (result.callEndingAnalysis?.isEndingPhraseUsed) {
    earned += 8;
  }

  // 10. Professional Words (7 pts)
  totalWeight += 7;
  if (!result.unprofessionalWordsAnalysis?.hasUnprofessionalWords) {
    earned += 7;
  }

  if (totalWeight <= 0) return 90;
  return Math.round((earned / totalWeight) * 100);
}

/**
 * Formats ISO date string into readable Arabic date/time.
 */
export function formatCallDateArabic(isoDate?: string): string {
  if (!isoDate) return "مكالمة محللة فعلياً";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "مكالمة محللة فعلياً";
    return d.toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "مكالمة محللة فعلياً";
  }
}

/**
 * Ensures any call result (from server cache or browser localStorage) strictly enforces:
 * 1. Never infer hold-music presence from speech-activity segments; preserve findings for proper acoustic verification.
 * 2. Preserve every transcript turn. Potential template echoes must be reviewed, not deleted by text matching.
 */
export function sanitizeCallResultForHoldAndEcho(result: TranscriptionResponse): TranscriptionResponse {
  if (!result || typeof result !== "object") return result;

  const toSec = (t?: string): number => {
    if (!t) return 0;
    const p = String(t).trim().split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] || 0;
  };

  // Work on a copy because downstream normalization mutates nested analysis objects.
  // Do not remove transcript turns based on phrase matching: those words may have been spoken.
  let cloned = structuredClone(result);

  // Do not infer hold-music presence from Silero VAD speech segments.
  // VAD segments represent detected speech activity, not a dedicated hold-music classifier.
  // Keep hold findings intact until a purpose-built acoustic/music detector can verify them.

  // 3. Enforce strict vocative-only customerNameAnalysis, customerTitleAnalysis, and furtherAssistanceAnalysis
  if (Array.isArray(cloned.transcript) && cloned.transcript.length > 0) {
    const agentTurns = cloned.transcript.filter((t: any) => {
      const spk = String(t?.speaker || "");
      return (spk.includes("موظف") || spk.includes("زميل") || spk.includes("خدمة العملاء")) && !spk.includes("صمت");
    });

    const invalidStopWords = new Set([
      "فندم", "يافندم", "يا فندم", "حضرتك", "سيادتك", "باشا", "بيه", "يا باشا", "صاحبي", "صاحبى", "بنتي", "بنتى", "ابني", "ابنى", "حبيبي", "حبيبى", "غالي", "غالى", "ريت", "رب", "ترى", "سيدي", "سيدى", "ستي", "ستى", "جماعة", "جماعه",
      "السيستم", "الأوردر", "الاوردر", "الصيدلية", "الطرشوبي", "علاج", "دواء", "كلاسيد", "اكس", "إكس", "ال", "كليكزان", "ديمرا", "انتينال", "نيكسيام", "كلاريتين", "اسبازيولان", "ايزنت", "تريم", "مايوفين", "فيبيوريك", "بلافيكس", "ريفاروسباير", "سيريتاد", "سيجنال", "فوكس", "ريمواكس", "ميليتيكس", "ميراج", "سيرا", "فلامون", "تربسالين", "أوميجا", "اوميجا", "دايجستين", "كالسيترون", "كي", "شول", "بيكمان", "زيرتك", "ميوكو", "سانسو", "سيستون", "بولي", "فريش",
      "فاتورة", "توصيل", "فرع", "كارت", "فيزا", "شركة", "صنف", "تركيز", "أهلاً", "شكراً",
      "أستاذ", "أستاذة", "استاذ", "استاذة", "استاذه", "دكتور", "دكتورة", "دكتوره", "مهندس", "باشمهندس", "مدام", "آنسة", "انسه", "حاج", "حاجة", "شيخ",
      "آل", "ال", "الـ", "الى", "إلى", "على", "عن", "مع", "في", "فى", "من", "هو", "هي", "دي", "ده", "كده", "تمام", "طيب",
      "اسم", "اسمي", "الاسم", "باسم", "عبد اللطيف", "عبداللطيف", "تشوبي", "لحظة", "لحظه", "لحظات", "ثواني", "ثوانى", "بصراحة", "بصراحه", "تانية", "تانيه", "ثانية", "ثانيه",
      "مراجعة", "مراجعه", "البيانات", "بيانات", "بالبنات", "بالبيانات", "أراجع", "اراجع", "اتأكد", "أتأكد", "أوفر", "اوفر", "توفير",
      "هنحتفظ", "بنحتفظ", "تحتفظ", "نحتفظ", "يحتفظ", "بياخدها", "كاتب", "العميل", "العميلة", "مسجل", "الرقم", "رقم", "مين", "إيه", "ايه"
    ]);

    const agClean = String(cloned.agentName || "")
      .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
      .replace(/^(?:دكتور[ةه]?|د\.|الزميل[ةه]?)\s*/i, "")
      .trim()
      .toLowerCase();
    const agentNamesSet = new Set<string>();
    if (agClean && agClean !== "الزميل") agentNamesSet.add(agClean);
    agentTurns.slice(0, 1).forEach((seg: any) => {
      const mAg = String(seg.text || "").match(/(?:مع\s*حضرتك|معاك[يِ]?)\s+(?:دكتور[ةه]?|د\.|[أإآا]ستاذ[ةه]?)?\s*([\p{L}]{2,14})/ui);
      if (mAg && mAg[1]) {
        const ex = mAg[1].trim().toLowerCase();
        if (!["فندم", "يافندم", "باسم", "غير", "مؤكد", "واضح"].includes(ex)) agentNamesSet.add(ex);
      }
    });

    const normalizeCustName = (n: string): string => {
      let c = String(n || "").trim();
      c = c.replace(/^(?:يا\s+)?(?:باسم\s+)?(?:ال)?(?:[أإآا]ستاذ[ةه]?|دكتور[ةه]?|باشمهندس[ةه]?|مهندس[ةه]?|مدام|[آا]نس[ةه]|حاج[ةه]?|شيخ)\s+/ui, "").trim();
      c = c.replace(/^باسم\s+/ui, "").trim();
      if (/^من[ىي]$/ui.test(c)) return "منى";
      return c;
    };

    const isValidCustName = (n: string): boolean => {
      const c = normalizeCustName(n);
      if (!c || c.length < 2 || c.length > 22) return false;
      const lower = c.toLowerCase();
      if (invalidStopWords.has(lower)) return false;
      const parts = c.split(/\s+/);
      if (parts.some((p) => invalidStopWords.has(p.toLowerCase()))) return false;
      if (parts.some((p) => /^(?:هن|بن|هت|بت|مت|مست)[\p{L}]{3,}$/u.test(p.toLowerCase()))) return false;
      if (lower.includes("فندم") || lower.includes("حضرتك") || lower.includes("كلاسيد")) return false;
      for (const ag of agentNamesSet) {
        if (lower === ag || lower.includes(ag)) return false;
      }
      return true;
    };

    const compoundPattern = "(?:(?:عز|سيف|نور|صلاح|حسام|بهاء|ضياء|علاء|تقي|شرف|جمال|محيي|نجم|كمال|جلال|شمس|بدر|عماد|خير|سعد|ناصر|مجد|شهاب|تاج|سراج)\\s*الدين|(?:عبد|أمة)\\s*[\\p{L}]{3,10}|[\\p{L}]{2,14})";
    const yaTitleNameRx = new RegExp(`(?:^|[^\\p{L}\\p{N}])يا\\s+(?:[أإآا]ستاذ[ةه]?|دكتور[ةه]?|باشمهندس[ةه]?|مهندس[ةه]?|مدام|[آا]نس[ةه]|حاج[ةه]?|شيخ)\\s+(${compoundPattern})(?:[^\\p{L}\\p{N}]|$)`, "ui");
    const directVocativeRx = new RegExp(`(?:^|[.،,؟!]\\s*|(?:أهلاً|اهلا|أهلاً\\s*وسهلاً|اهلا\\s*وسهلا|أهلاً\\s*بحضرتك|اهلا\\s*بحضرتك|مرحباً|مرحبا|صباح\\s*الخير|مساء\\s*الخير|تمام|حاضر|تحت\\s*أمرك|تحت\\s*أمر\\s*حضرتك|عفواً|عفوا|شكراً|شكرا|اتفضل|اتفضلي|معايا|معانا|آسف|اسف|بعتذر|عذراً|عذرا|أكيد|اكيد|طبعاً|طبعا|أيوة|ايوه|طيب|ماشي)\\s+)(?:[أإآا]ستاذ[ةه]?|دكتور[ةه]?|باشمهندس[ةه]?|مهندس[ةه]?|[آا]نس[ةه])\\s+(${compoundPattern})(?:[^\\p{L}\\p{N}]|$)`, "ui");
    const midOstazRx = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:[أإآا]ستاذ[ةه]?|باشمهندس[ةه]?)\\s+(${compoundPattern})(?:[^\\p{L}\\p{N}]|$)`, "ui");
    const regReadRx = /(?:مسجل[ةه]?|باسم|حساب|رقم\s*حضرتك|الرقم|العنوان|عنوان|بيانات|البيانات|بالبنات|لدينا|صنف|دواء|علاج|صيدلي[ةه]|مستشفى|شارع|برج|عمار[ةه])/ui;
    const nonVocPreRx = /(?:باسم|مسجل[ةه]?|الاسم|إسم|اسم|حساب|رقم|عنوان|العنوان|شارع|ميدان|مستشفى|صيدلي[ةه]|صيدليات|عياد[ةه]|برج|عمار[ةه])\s*(?:باسم|لدينا|عندنا|حضرتك|يا\s*فندم)?\s*(?:ال)?$/ui;

    const foundNames: { name: string; timestamp: string; snippet: string }[] = [];
    let candName = "";

    agentTurns.forEach((seg: any, idx: number) => {
      const text = String(seg.text || "");
      const mYa = text.match(yaTitleNameRx);
      if (mYa && isValidCustName(mYa[1])) {
        const cn = normalizeCustName(mYa[1]);
        if (!candName) candName = cn;
        foundNames.push({ name: candName, timestamp: String(seg.timeStart || "00:00").trim(), snippet: text.trim() });
        return;
      }
      if (!regReadRx.test(text)) {
        const mDir = text.match(directVocativeRx);
        if (mDir && isValidCustName(mDir[1])) {
          const cn = normalizeCustName(mDir[1]);
          if (!candName) candName = cn;
          foundNames.push({ name: candName, timestamp: String(seg.timeStart || "00:00").trim(), snippet: text.trim() });
          return;
        }
      }
      if (idx > 0) {
        const mMid = text.match(midOstazRx);
        if (mMid && isValidCustName(mMid[1])) {
          const before = text.slice(0, mMid.index || 0).trim();
          if (!/(?:مسجل[ةه]?|باسم|حساب\s+[أإآا]ستاذ|صيدلي[ةه]\s+[أإآا]ستاذ)/ui.test(before) && !nonVocPreRx.test(before)) {
            const cn = normalizeCustName(mMid[1]);
            if (!candName) candName = cn;
            foundNames.push({ name: candName, timestamp: String(seg.timeStart || "00:00").trim(), snippet: text.trim() });
          }
        }
      }
    });

    if (foundNames.length > 0 && candName) {
      const uniqueTs = Array.from(new Set(foundNames.map((m) => m.timestamp))).sort((a, b) => toSec(a) - toSec(b));
      cloned = {
        ...cloned,
        customerName: candName,
        customerNameAnalysis: {
          customerNameDetected: candName,
          isMentionedByAgent: true,
          mentionCount: foundNames.length,
          mentionsTimestamps: uniqueTs,
          nameSnippet: foundNames[0].snippet,
          evaluation:
            foundNames.length === 1
              ? `نادى الزميل على العميل باسمه الشخصي (${candName}) مرة واحدة في المكالمة بعبارة: "${foundNames[0].snippet}" بالتوقيت الدقيق (${uniqueTs[0]})، ولم يقم بتكرار ذكر اسم العميل في باقي المكالمة (يُوصى بإعادة مناداة العميل باسمه لتعزيز التواصل الإيجابي وتوطيد العلاقة).`
              : `التزم الزميل بمناداة ومخاطبة العميل باسمه الشخصي (${candName}) وتكراره باحترافية على مدار المكالمة (${foundNames.length} مرات بالتوقيتات الدقيقة: ${uniqueTs.join(", ")}).`,
        },
      };
    } else {
      cloned = {
        ...cloned,
        customerName: "لم يذكر",
        customerNameAnalysis: {
          customerNameDetected: "لم يذكر",
          isMentionedByAgent: false,
          mentionCount: 0,
          mentionsTimestamps: [],
          nameSnippet: "",
          evaluation: "لم يقم الزميل بمناداة العميل باسمه الشخصي خلال المكالمة واقتصر على الصيغ العامة، وتجنب تخمين أي اسم لم ينادِ به الزميل العميل صراحة.",
        },
      };
    }

    // 4. Further Assistance ("أي خدمة ثانية؟" and synonymous offers after order/total review or before call ending)
    const explicitOfferRx = /(?:[أإآا]ي\s*(?:خدم[ةه]|خدمات|إضاف[ةه]|اضاف[ةه]|إضافات|اضافات|طلب|طلبات|استفسار|سؤال|أمر|امر|اوامر|أوامر)\s*(?:[تث]اني[ةه]?|[أإآا]خر[ىي]?|غيرها)?|(?:محتاج[ةه]?|تحتاج[ي]?|عايز[ةه]?|في|فيه|تحب[ي]?|أؤمر[يني]*|اؤمر[يني]*|تؤمر[يني]*)\s*(?:[أإآا]ضفلك\s*|[أإآا]ضيف\s*(?:لحضرتك\s*)?)?(?:[أإآا]ي\s*)?(?:خدم[ةه]|خدمات|حاج[ةه]|إضاف[ةه]|اضاف[ةه]|إضافات|اضافات|طلب|طلبات|استفسار)\s*(?:[تث]اني[ةه]?|[أإآا]خر[ىي]?)|(?:خدم[ةه]|خدمات|إضاف[ةه]|اضاف[ةه]|إضافات|اضافات|طلبات|استفسار)\s*(?:[تث]اني[ةه]?|[أإآا]خر[ىي])|[أإآا]ساعد(?:ك|\s*حضرتك)\s*في\s*(?:[أإآا]ي\s*)?(?:حاج[ةه]|خدم[ةه]|استفسار)\s*(?:[تث]اني[ةه]?|[أإآا]خر[ىي])?)/ui;
    const nonOfferCtxRx = /(?:بتسأل[ي]?\s*على\s*حاج[ةه]\s*[تث]اني[ةه]|حاج[ةه]\s*[تث]اني[ةه]\s*من\s*المعجون|السلسل[ةه]\s*بحاج[ةه]\s*[تث]اني[ةه])/ui;
    const orderRevRx = /(?:[أإآا]جمالي|المجموع|شامل\s*(?:مصاريف\s*|خدم[ةه]\s*|رسوم\s*)?التوصيل|بالتوصيل|نراجع\s*الأوردر|أراجع\s*مع\s*حضرتك\s*الأوردر|الأوردر\s*(?:حضرتك\s*)?هيكون\s*عبار[ةه])/ui;

    const callEndSec = toSec(cloned.transcript[cloned.transcript.length - 1].timeEnd || cloned.transcript[cloned.transcript.length - 1].timeStart);
    let firstRevSec = 0;
    agentTurns.forEach((s: any) => {
      const sec = toSec(s.timeStart);
      if (sec > 30 && orderRevRx.test(s.text || "")) {
        if (firstRevSec === 0 || sec < firstRevSec) firstRevSec = sec;
      }
    });

    const validOffers = agentTurns.filter((s: any, idx: number) => {
      const txt = String(s.text || "");
      if (nonOfferCtxRx.test(txt)) return false;
      if (!explicitOfferRx.test(txt)) return false;
      const sec = toSec(s.timeStart);
      if (sec <= 30 && idx <= 2) return false;
      const isAfterRev = firstRevSec > 0 && sec >= firstRevSec - 25;
      const isBeforeEnd = (callEndSec > 0 && sec >= Math.max(35, callEndSec - 150)) || idx >= Math.max(2, agentTurns.length - 12);
      return isAfterRev || isBeforeEnd;
    });

    if (validOffers.length > 0) {
      const primarySeg = validOffers[validOffers.length - 1];
      const tsList = Array.from(new Set(validOffers.map((s: any) => s.timeStart || "00:00")));
      cloned = {
        ...cloned,
        furtherAssistanceAnalysis: {
          isAssistanceOffered: true,
          assistanceCount: validOffers.length,
          assistanceTextSnippet: primarySeg.text,
          assistanceTimestamps: tsList,
          detectedAssistancePhrases: validOffers.map((s: any) => s.text),
          evaluation: `التزم الزميل بعرض خدمات أخرى ومساعدة إضافية قبل إنهاء المكالمة وبعد مراجعة الطلب بالدقيقة (${tsList.join("، ")}): "${primarySeg.text}".`,
        },
      };
    }
  }

  return cloned;
}

/**
 * Builds a complete AnalyzedCallRecord from a TranscriptionResponse.
 */
export function buildAnalyzedCallRecord(
  rawResult: TranscriptionResponse,
  existingRecord?: Partial<AnalyzedCallRecord>
): AnalyzedCallRecord {
  const result = sanitizeCallResultForHoldAndEcho(rawResult);
  const id = existingRecord?.id || getDeterministicCallId(result);
  const audioHash = result.audioHash || existingRecord?.audioHash;
  const savedAt = result.savedAt || existingRecord?.savedAt || new Date().toISOString();

  const hasCons = Boolean(
    result.medicalConsultationAnalysis?.isMedicalConsultationPresent
  );
  const consSumm = hasCons
    ? result.medicalConsultationAnalysis?.evaluation ||
      result.medicalConsultationAnalysis?.consultationTopic ||
      "استشارة طبية لأعراض مرضية محددة ومطابقة البروتوكول الطبي."
    : "لا توجد استشارة طبية (طلب أو استفسار مباشر عن أصناف محددة دون أعراض طبية).";

  const hasH = Boolean(result.holdTimeSummary?.holdCount && result.holdTimeSummary.holdCount > 0);
  const hSumm = hasH
    ? `${result.holdTimeSummary.holdCount} فترات هولد (${result.holdTimeSummary.totalHoldSeconds} ثانية) - ${result.holdTimeSummary.overallClassification} ${result.holdTimeSummary.isMusicCriterionCompliant ? "مع موسيقى انتظار معتمدة" : ""}`
    : "لم يتم الخروج هولد أثناء المكالمة.";

  const hasC = Boolean(result.customerComplaintAnalysis?.hasComplaint);
  const cSumm = hasC
    ? result.customerComplaintAnalysis?.summaryText || "تم رصد شكوى من العميل أثناء المكالمة."
    : "المكالمة خالية تماماً من أي شكوى.";

  const toneSumm = result.agentToneAnalysis?.wav2vec2Emotion?.dominantEmotionArabic
    ? `${result.agentToneAnalysis.wav2vec2Emotion.dominantEmotionArabic} - ${result.agentToneAnalysis.detectedTraits?.join(" ، ") || "التحليل الصوتي"}`
    : result.agentToneAnalysis?.callSummary || "قياس نبرة صوت الزميل وفق التحليل الترددي المباشر.";

  const resolvedAgentName = resolveAgentNameFromResult(result, existingRecord?.agentName);
  const detectedCustomer = result.customerNameAnalysis?.customerNameDetected;
  const customerName =
    result.customerNameAnalysis?.isMentionedByAgent &&
    detectedCustomer &&
    detectedCustomer !== "لم يذكر" &&
    detectedCustomer !== "غير محدد"
      ? detectedCustomer
      : "لم يذكر";

  const overallScore = computeOverallQAScore(result);

  return {
    id,
    audioHash,
    savedAt,
    agentName: resolvedAgentName,
    customerName,
    callDate: formatCallDateArabic(savedAt),
    duration: result.callEndingAnalysis?.callTotalDuration || existingRecord?.duration || "02:40",
    overallScore,
    hasConsultation: hasCons,
    consultationSummary: consSumm,
    hasHold: hasH,
    holdSummary: hSumm,
    hasComplaint: hasC,
    complaintSummary: cSumm,
    toneSummary: toneSumm,
    fullResult: result,
  };
}
