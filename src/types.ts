export interface TranscriptItem {
  speaker: "العميل" | "موظف خدمة العملاء" | "فترة صمت الموظف" | string;
  text: string;
  timeStart: string;
  timeEnd: string;
  duration: number; // in seconds
}

export interface SilenceSegment {
  timeStart: string; // وقت بداية الصمت (نهاية آخر كلمة للمتحدث السابق)
  timeEnd: string;   // وقت نهاية الصمت (بداية أول كلمة للمتحدث اللاحق)
  duration: number;  // مدة الصمت بالثواني
  fromSpeaker: string; // المتحدث السابق قبل فترة الصمت (العميل أو موظف خدمة العملاء)
  toSpeaker: string;   // المتحدث اللاحق بعد فترة الصمت (العميل أو موظف خدمة العملاء)
  description: string; // تفصيل بالعامية المصرية يصف الفترة
  type?: "quiet_silence" | "hold_music"; // نوع الفترة (هدوء تام وخلو من الصوت)
}

export interface AgentSilenceSummary {
  totalSilenceSeconds: number;
  silenceCount: number;
  silenceRatio: number; // percentage (e.g., 15)
  silenceSegments?: SilenceSegment[];
}

export interface CustomerNameAnalysis {
  customerNameDetected: string; // الاسم المكتشف للعميل، أو فارغ إذا لم يكتشف
  isMentionedByAgent: boolean; // هل تم ذكره بواسطة الموظف أم لا
  mentionCount: number; // عدد مرات ذكر الاسم بواسطة الموظف
  mentionsTimestamps: string[]; // الطوابع الزمنية التي ذكر فيها الموظف اسم العميل
  nameSnippet?: string; // نص العبارة التي ذكر فيها الزميل اسم العميل
  evaluation?: string; // تقييم فني دقيق لمدى التزام الزميل بذكر اسم العميل
}

export type HoldClassificationType = "بداعي" | "بدون داعي";

export interface HoldSegment {
  timeStart: string;
  timeEnd: string;
  duration: number;
  hasLoudMusic?: boolean; // هل تصاحبها موسيقى انتظار عالية أو نغمة (النغمة أساسي)
  audioCharacteristic?: string; // وصف صوتي مثل: "موسيقى انتظار صريحة وعالية"، "نغمة هولد"
  connectedToHoldPhrase?: boolean; // هل ارتبط الهولد بعبارة طلب الانتظار مثل "لحظات عالانتظار"
  holdPhraseSnippet?: string; // نص عبارة الاستئذان بالانتظار المرصودة (مثل: "لحظات عالانتظار يا فندم")
  classification?: HoldClassificationType; // تصنيف الهولد: "بداعي" أو "بدون داعي"
  statedReasonSnippet?: string; // النص أو العبارة التي ذكر فيها الزميل سبب الخروج هولد
  reasonCategory?: string; // تصنيف السبب (مراجعة استشارات دوائية أو تجميلية / مراجعة توفر أصناف / مراجعة المعمل لتركيبة معملية / مراجعة شكوى عميل / وجود عطل سيستم / سبب غير معتمد / لم يذكر سبب)
  evaluation?: string; // تحليل وتقييم مشروعية الهولد بالعامية المصرية
  isDurationExceeded?: boolean; // هل تجاوز الزميل مدة الهولد المسموحة (تجاوز 90 ثانية، أو تجاوز 180 ثانية في حال طلب وقت أطول لنفس السبب)
  allowedDurationSeconds?: number; // المدة المسموحة لهذه الفترة (90 ثانية أساسية، أو 180 ثانية كحد أقصى عند طلب وقت أطول للمراجعة لنفس السبب)
  durationAlertMessage?: string; // تفصيل تنبيه تجاوز المدة المسموحة
  isExtensionForSameReason?: boolean; // هل هذا تمديد لنفس السبب مع استئذان بطلب وقت أطول
  isReasonStated?: boolean; // هل بلّغ الزميل بالسبب للعميل قبل الخروج هولد
  didWaitForConsent?: boolean; // هل انتظر الزميل رد فعل وموافقة العميل قبل وضع المكالمة على الهولد
  customerConsentSnippet?: string; // رد فعل وموافقة العميل المرصودة (مثل: "تمام", "اتفضل", "أوكي")
  didThankAfterHold?: boolean; // هل شكر الزميل العميل على الانتظار عند العودة من الهولد
  thankingSnippet?: string; // عبارة الشكر على الانتظار المرصودة
  didCheckCustomerPresence?: boolean; // هل تأكد من وجود العميل على الخط قبل الاسترسال بالكلام
  presenceCheckSnippet?: string; // عبارة التأكد من وجود العميل (مثل: "ألو", "مع حضرتك يا فندم")
  isMusicCompliant?: boolean; // هل استوفت فترة الهولد معيار وجود موسيقى الانتظار لاعتمادها
  customerSpokeDuringMusic?: boolean; // هل ظهر أي كلام أو صوت للعميل أثناء عزف موسيقى الهولد (مع استمرار احتساب الهولد كاملاً)
  musicCalculationNote?: string; // توثيق حساب المدة من أول صدور الموسيقى إلى انتهائها فقط
  alerts?: string[]; // علامات وتنبيهات التدقيق المرصودة لفترة الهولد
}

export interface HoldTimeSummary {
  totalHoldSeconds: number;
  holdCount: number;
  holdSegments: HoldSegment[];
  overallClassification?: "كل الهولد بداعي" | "يوجد هولد بدون داعي" | "بدون هولد"; // تصنيف إجمالي لحالات الهولد في المكالمة
  validHoldCount?: number; // عدد فترات الهولد بداعي
  unjustifiedHoldCount?: number; // عدد فترات الهولد بدون داعي
  hasExceededDurationHold?: boolean; // هل يوجد هولد تجاوز الحد الزمني المسموح به
  isMusicCriterionCompliant?: boolean; // ربط معيار الهولد بوجود موسيقى: هل تم الالتزام التام بوجود وبث موسيقى الانتظار لكافة فترات الهولد
  musicComplianceStatus?: string; // حالة الالتزام بمعيار الهولد بوجود موسيقى
  auditNotes?: string; // ملاحظات تدقيق شروط الخروج هولد وربط المعيار بوجود موسيقى
}

export interface GreetingAnalysis {
  isGreetingUsed: boolean; // هل تم استخدام عبارات الترحيب المعتمدة (أهلاً وسهلاً / أهلاً بحضرتك / أهلاً / نورتنا / شرفتنا)
  detectedGreetingPhrases: string[]; // عبارات الترحيب المحددة المكتشفة في المقدمة
  greetingTimestamps: string[]; // الطوابع الزمنية التي ذكر فيها الزميل عبارة الترحيب بصيغة MM:SS
  greetingTextSnippet: string; // نص الترحيب الذي نطق به الزميل في المقدمة
  agentStartSecond?: string; // وقت بداية تحدث الزميل فقط بالثانية بدقة (مثال: "00:02" أو "الثانية 2")
  agentStartSecondNumber?: number; // رقم الثانية الدقيق لبدء حديث الزميل فقط
  evaluation: string; // تقييم جودة الترحيب بالعامية المصرية
}

export interface EmpathyAnalysis {
  isEmpathyUsed: boolean; // هل تم استخدام عبارات التعاطف المحددة (ألف سلامة / بالشفاء)
  detectedEmpathyPhrases: string[]; // العبارات المكتشفة (ألف سلامة أو بالشفاء)
  empathyCount: number; // عدد مرات ذكر عبارات التعاطف المكتشفة
  empathyTimestamps: string[]; // الطوابع الزمنية التي قيلت فيها عبارات التعاطف بصيغة MM:SS
  empathyTextSnippet: string; // الجملة التي قيل فيها التعاطف
  evaluation: string; // تقييم التعاطف (مثلاً: "تم التعاطف" أو "لم يتم التعاطف")
}

export interface FurtherAssistanceAnalysis {
  isAssistanceOffered: boolean; // هل عرض الزميل خدمات أخرى قبل الانهاء (مثل أي مساعدة أخرى أو إضافة شيء آخر)
  assistanceCount?: number; // عدد مرات عرض المساعدة المكتشفة
  assistanceTimestamps?: string[]; // توقيتات العبارات المكتشفة
  detectedAssistancePhrases: string[]; // عبارات عرض المساعدة المكتشفة
  assistanceTextSnippet: string; // نص جملة عرض المساعدة الإضافية الفعلي
  evaluation: string; // تقييم عرض الخدمات الأخرى قبل الإنهاء (مثلاً: "تم عرض خدمات أخرى" أو "لم يتم عرض خدمات أخرى")
}

export interface UnprofessionalWordDetail {
  word: string;
  count: number;
  timestamps: string[];
  contextSnippet?: string; // نص الجملة التي نطق بها الزميل اللفظ غير الاحترافي
  professionalAlternative?: string; // البديل المهني المقترح
}

export interface UnprofessionalWordsAnalysis {
  hasUnprofessionalWords: boolean;
  totalUnprofessionalWordsCount: number;
  detectedWords: UnprofessionalWordDetail[];
  evaluation: string;
  alerts?: string[]; // تنبيهات مباشرة للألفاظ غير الاحترافية المرصودة
}

export interface CallEndingAnalysis {
  isEndingPhraseUsed: boolean; // هل تم قول شرفتنا أو شرتنا أو شكرا لاتصالك عند الانتهاء والوداع
  detectedEndingPhrases: string[]; // الكلمات المكتشفة من القائمة الحصرية (شرفتنا، شرفت، شكرا لاتصالك)
  endingTextSnippet: string; // نص جملة الإنهاء الفعلي التي تلفظ بها الزميل في نهاية المكالمة
  remainingTimeBeforeEnd?: string; // الوقت المتبقي قبل إنهاء المكالمة بعد آخر ظهور لصوت العميل أو الزميل (مثلاً: "4 ثوانٍ" أو "00:04")
  remainingTimeSeconds?: number; // عدد الثواني المتبقية قبل إغلاق الخط بعد آخر صوت مسموع
  lastSpokenTimestamp?: string; // توقيت آخر صوت مسموع صادر من العميل أو الزميل (مثلاً: "01:11")
  callTotalDuration?: string; // إجمالي مدة المكالمة حتى لحظة الإنهاء (مثلاً: "01:15")
  evaluation: string; // التقييم الفني لجودة الوداع وإنهاء المكالمة بالعامية المصرية
}

export interface CustomerTitleAnalysis {
  titleDetected: string; // اللقب الفعلي المكتشف للعميل (مثل دكتور / مستشار / مهندس / أستاذ)
  isTitleUsedByAgent: boolean; // هل أظهر الزميل اهتماماً ونطق لقب العميل المناسب باحترافية؟
  titleMentionCount: number; // عدد مرات ذكر اللقب بواسطة الموظف
  titleMentionsTimestamps: string[]; // الطوابع الزمنية لذكر اللقب بصيغة MM:SS
  titleTextSnippet: string; // السطر أو العبارة الفعلية التي تلفظ فيها الزميل باللقب
  evaluation: string; // التقييم والتحليل الفني لاستخدام الألقاب المهنية أو غيابها بالعامية المصرية
}

export interface AgentApologyAnalysis {
  isApologyNeeded: boolean; // هل تطلب سياق المكالمة اعتذاراً (مثل هولد طويل، خطأ، انقطاع)؟
  isApologyUsedByAgent: boolean; // هل قدم الزميل اعتذاراً صريحاً (آسف/بعتذر/متأسف/عذراً)؟
  apologyMentionCount: number; // عدد مرات تقديم الاعتذار
  apologyTimestamps: string[]; // الطوابع الزمنية للاعتذار بصيغة MM:SS
  apologyTextSnippet: string; // الجملة أو العبارة الفعلية للاعتذار من الزميل
  evaluation: string; // التقييم الفني لمرونة ولباقة الزميل في الاعتذار بالعامية المصرية
}

export interface Wav2Vec2EmotionScore {
  label: string; // Emotion label (e.g. neutral, happy, angry, sad, fearful, surprised, disgusted)
  labelArabic: string; // الوصف بالعربية (مثلاً: هادئ/طبيعي، سعيد/بشوش، توتر/تردد، غضب، قلق، حزن)
  score: number; // Confidence score between 0 and 1
  percentage: number; // Percentage 0-100%
}

export interface Wav2Vec2SegmentEmotion {
  segmentName: string; // "المقدمة والافتتاحية" أو "أثناء سير المكالمة"
  dominantEmotion: string;
  dominantEmotionArabic: string;
  dominantScore: number;
  confidencePercentage: number;
  isSmileSupported: boolean;
  acousticNotes: string;
  allScores: Wav2Vec2EmotionScore[];
}

export interface Wav2Vec2EmotionAnalysis {
  modelName: string; // e.g. "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
  isEmbeddedEngine?: boolean;
  engineSource?: string; // e.g. "مكتبة Hugging Face Wav2Vec2 Emotion المدمجة"
  dominantEmotion: string; // Dominant emotion in English
  dominantEmotionArabic: string; // المشاعر السائدة بالعامية/العربية
  dominantScore: number; // Confidence 0-1
  isSmileOrFriendlySupported: boolean; // هل تؤكد ترددات النبرة الابتسامة أو البشاشة
  confidencePercentage: number; // e.g. 88%
  allScores: Wav2Vec2EmotionScore[];
  acousticNotes: string; // ملاحظات تردد النبرة المستخرجة من ويف تو فيك
  introduction?: Wav2Vec2SegmentEmotion; // قياس نبرة صوت الزميل في المقدمة حصرياً عبر Wav2Vec2
  duringCall?: Wav2Vec2SegmentEmotion; // قياس نبرة صوت الزميل أثناء المكالمة حصرياً عبر Wav2Vec2
}

export interface AgentToneAnalysis {
  introductionSummary: string; // خلاصة نبرة الصوت في المقدمة بالعامية المصرية
  callSummary: string; // خلاصة نبرة الصوت خلال باقي المكالمة بالعامية المصرية
  hasSmile: boolean; // هل نبرة الصوت بها ابتسامة أم لا (مبتسمة / غير مبتسمة)
  smileEvaluation: string; // النقد والتعقيب على حضور الابتسامة والبشاشة بالعامية المصرية
  detectedTraits: string[]; // سمات النبرة الملحوظة مثل (بها ابتسامة، ينقصها الابتسامة، هادئة، بها تردد، ينقصها التفاعل، جافة، ودودة، إلخ.)
  score: number; // تقييم إجمالي للنبرة من 10
  wav2vec2Emotion?: Wav2Vec2EmotionAnalysis; // تحليل النبرة المعزز عبر موديل Hugging Face (Wav2Vec2 emotion)
}

export interface VerbalTicDetail {
  word: string;
  count: number;
  timestamps: string[];
}

export interface RepeatedQuestionDetail {
  questionSnippet: string; // نص أو صيغة السؤال المكرر
  initialQuestionTimestamp?: string; // توقيت طرح السؤال أول مرة
  initialCustomerAnswer?: string; // إجابة العميل الأولى
  repeatedQuestionTimestamp?: string; // توقيت تكرار السؤال بلا داعي
  alertMessage: string; // نص التنبيه
}

export interface VerbalTicsAnalysis {
  hasVerbalTics: boolean;
  detectedTics: VerbalTicDetail[];
  evaluation: string;
  hasUnnecessaryRepeatedQuestions?: boolean; // هل كرر الزميل سؤالاً سبقت إجابته من العميل بلا داعي
  repeatedQuestions?: RepeatedQuestionDetail[]; // تفاصيل الأسئلة المكررة بلا داعي
  unnecessaryQuestionAlerts?: string[]; // قائمة التنبيهات المرصودة لتكرار الأسئلة
}

export interface MedicalConsultationStep {
  stepKey: 
    | "age" 
    | "otherSymptoms" 
    | "symptomsOnset" 
    | "pregnancyOrLactation" 
    | "currentMedsTaken" 
    | "regularMeds" 
    | "chronicDiseases" 
    | "drugAllergies";
  stepTitle: string; // عنوان الخطوة (مثل: العمر كام؟ / هل فى اى اعراض اخرى؟ ...)
  standardQuestion: string; // صيغة السؤال المعياري
  wasAsked: boolean; // هل سأل الزميل العميل عن هذه الخطوة
  questionSnippet?: string; // العبارة المنطوقة التي سأل بها الزميل
  timestamp?: string; // توقيت السؤال
  notAskedAlert?: string; // نص التنبيه في حال إغفال السؤال
}

export interface MedicalConsultationAnalysis {
  isMedicalConsultationPresent: boolean; // هل تتضمن المكالمة استشارة طبية أو طلب دواء لعرض معين
  consultationTopic?: string; // موضوع أو عرض الاستشارة (مثل: إمساك، سخونية، صداع، كحة، إلخ)
  customerSymptomSnippet?: string; // نص أو عبارة العميل التي تفيد وجود عرض مرضي أو طلب علاج
  allStepsCompleted: boolean; // هل تم استيفاء جميع خطوات الاستشارة الطبية بنجاح
  steps: MedicalConsultationStep[]; // مصفوفة الخطوات الـ 8 الإلزامية
  missingStepsCount: number; // عدد الخطوات التي تم إغفالها
  missingStepsAlerts: string[]; // قائمة التنبيهات للخطوات التي لم يسأل عنها الزميل
  score?: number; // درجة خطوات الاستشارة بحسب عدد الأسئلة التي تم الرد وسؤال العميل عنها (من 8)
  totalSteps?: number; // إجمالي خطوات الاستشارة الإلزامية (8)
  scorePercentage?: number; // النسبة المئوية للدرجة
  evaluation: string; // تقييم فني بالعامية المصرية لمدى التزام الزميل بالبروتوكول الطبي
}

// ----------------------------------------------------
// معيار المعرفة العلمية للزميل ومراجعتها عبر MEDSCAPE
// ----------------------------------------------------
export interface ActiveIngredientAudit {
  item: string; // اسم الصنف التجاري
  activeIngredients: string; // المواد الفعالة والتركيزات
  medscapeReference: string; // توثيق المرجع العلمي المعتمد من Medscape
  isAccurate: boolean; // هل معلومات الزميل دقيقة وصحيحة
  agentStatement?: string; // ما ذكره الزميل بخصوص الصنف أو المادة الفعالة
  notes?: string;
}

export interface DrugInteractionAudit {
  drugsInvolved: string[]; // الأصناف أو المواد المتداخلة
  interactionLevel: "contraindicated" | "serious" | "monitor_closely" | "minor" | "none";
  interactionLevelArabic: string; // تعارض خطير / يستوجب المتابعة / طفيف / لا يوجد تعارض
  medscapeDetails: string; // تفاصيل التداخل وتوثيقه من Medscape Interaction Checker
  agentHandling: "properly_warned" | "missed_warning" | "incorrect_advice" | "not_applicable";
  agentHandlingArabic: string;
  alert?: string;
}

export interface DrugAlternativeAudit {
  originalDrug: string; // الدواء الأصلي
  suggestedDrug: string; // الصنف المقترح
  relationType: "generic" | "therapeutic_alternative" | "comparison"; // مثيل (نفس المادة) أم بديل علاجي أم مقارنة
  relationTypeArabic: string; // مثيل متطابق (نفس المادة الفعالة) / بديل علاجي (نفس الفئة العلاجية) / مقارنة صيدلانية
  isScientificallySound: boolean; // هل الترشيح سليم علمياً
  medscapeVerification: string; // التحقق الصيدلاني المعتمد عبر Medscape
  notes?: string;
}

export interface DrugComparisonAudit {
  drugsCompared: string; // الأصناف المقارن بينها
  agentClaim: string; // ما ذكره الزميل في المقارنة
  isAccurate: boolean; // هل المقارنة دقيقة علمياً
  medscapeFactCheck: string; // المراجعة والتحقق من الحقائق الصيدلانية عبر Medscape
}

export interface AgentScientificKnowledgeAnalysis {
  hasScientificDiscussion: boolean; // هل تضمنت المكالمة استفساراً أو حديثاً يقتضي مراجعة Medscape وفق الحالات الحصرية
  wasTriggeredByCustomerQuestions?: boolean; // هل تم التطرق إلى المعرفة الصيدلانية ومراجعة Medscape بناءً على سؤال العميل
  customerQuestionsSnippet?: string; // نص أو سياق استفسار العميل أو توفير الزميل للبديل/المثيل الذي استدعى مراجعة Medscape
  triggerReason?: "customer_difference_inquiry" | "customer_alternative_or_generic_request" | "customer_consultation_or_dosage" | "agent_provided_alternative_or_generic" | "none";
  triggerReasonArabic?: string; // سبب مراجعة Medscape (الفرق بين الأدوية / طلب بديل أو مثيل / استشارة وجرعات / توفير الزميل لمثيل أو بديل)
  medicationsMentioned: string[]; // جميع الأصناف والأدوية المذكورة في المكالمة
  overallScientificScore: number; // درجة المعرفة العلمية من 10
  medscapeAuditSummary: string; // خلاصة التدقيق العلمي المعتمد من Medscape
  activeIngredientsAudit: ActiveIngredientAudit[]; // تدقيق المواد الفعالة والتركيب
  drugInteractionsAudit: DrugInteractionAudit[]; // تدقيق التداخلات الدوائية
  alternativesAndEquivalents: DrugAlternativeAudit[]; // تدقيق المثائل والبدائل
  scientificComparisons?: DrugComparisonAudit[]; // تدقيق المقارنات الدوائية إن وجدت
  scientificStrengths: string[]; // نقاط القوة والمعرفة العلمية للزميل
  scientificErrorsOrAlerts: string[]; // أي تنبيهات أو مغالطات علمية أو إغفال لتداخلات
  evaluation: string; // تقييم شامل بالعامية المصرية للمعرفة العلمية للزميل ومطابقتها لمعايير Medscape
}

// ----------------------------------------------------
// معيار رصد وتنبيه شكاوى العميل أثناء كلامه
// ----------------------------------------------------
export type CustomerComplaintCategory =
  | "order_delay" // تأخير الأوردر
  | "missing_or_wrong_items" // صنف ناقص أو خطأ في التسليم
  | "defective_or_damaged_item" // مشكلة أو عيب في الصنف
  | "missing_service_or_accessory" // خدمة أو ملحق لم يُرسل (فيزا، تلج، فاتورة)
  | "delivery_attitude" // شكوى من سلوك مندوب التوصيل
  | "other"; // شكوى أخرى

export interface CustomerComplaintDetail {
  category: CustomerComplaintCategory;
  categoryArabic: string; // تأخير الأوردر / صنف ناقص أو خاطئ / مشكلة في الصنف / خدمة لم ترسل / شكوى من مندوب التوصيل
  complaintSnippet: string; // نص كلام العميل الدقيق الذي يعبر عن الشكوى
  timestamp?: string; // التوقيت التقريبي في المكالمة
  explanation: string; // توضيح الشكوى وسياقها
}

export interface ComplaintApologyAudit {
  didApologizeForComplaint: boolean; // هل اعتذر الزميل عن شكوى العميل بصفة خاصة وصريحة؟
  apologySnippet?: string; // نص كلام الزميل في الاعتذار عن الشكوى (مثل: بعتذر لحضرتك جداً عن التأخير)
  apologyTimestamp?: string; // توقيت الاعتذار عن الشكوى في المكالمة (MM:SS)
  evaluation: string; // تقييم الالتزام بالاعتذار الخاص بالشكوى مع ذكر التوقيت
}

export interface ComplaintHandlingScriptAudit {
  isScriptDelivered: boolean; // هل بلغ الزميل سكريبت تسجيل الشكوى لمنع التكرار أو فيما معناه؟
  scriptSnippet?: string; // نص كلام الزميل الفعلي للتبليغ
  scriptTimestamp?: string; // توقيت التبليغ في المكالمة (MM:SS)
  isStandardPhraseUsed: boolean; // هل تضمن المعنى المطلوب: سيتم تسجيل شكوى لمراجعة الأمر لضمان عدم التكرار
  evaluation: string; // تقييم هندلة الشكوى وتبليغ السكريبت
}

export interface OtherApologyDetail {
  reason: string; // سبب الاعتذار الآخر (مثل: هولد، انقطاع صوت، استفسار، لبس)
  apologySnippet: string; // نص الاعتذار المنطوق
  timestamp: string; // توقيت الاعتذار المنفصل (MM:SS)
}

export interface CustomerComplaintAnalysis {
  hasComplaint: boolean; // هل توجد شكوى أثناء كلام العميل
  complaintsCount: number; // عدد الشكاوى المكتشفة
  detectedComplaints: CustomerComplaintDetail[]; // تفاصيل كل شكوى مرصودة
  summaryText: string; // "لا يوجد" إذا لم تكن هناك شكوى، أو ملخص نصي دقيق بالشكوى
  alerts: string[]; // نصوص التنبيهات التي ستظهر في الواجهة
  complaintApology?: ComplaintApologyAudit; // التحقق الحصري من اعتذار الزميل عن شكوى العميل بصفة خاصة وذكر التوقيت
  handlingScript?: ComplaintHandlingScriptAudit; // تدقيق هندلة الشكوى وتبليغ سكريبت (سيتم تسجيل شكوى لمراجعة الأمر لضمان عدم التكرار أو فيما معناه)
  otherApologies?: OtherApologyDetail[]; // فصل أي اعتذارات أخرى بوقتها في بند مستقل تماماً
}

export interface EngineInfo {
  whisperApiUsed: boolean;
  qwenCleoUsed?: boolean;
  qwenCleoAvailable?: boolean;
  wav2vec2EmotionUsed?: boolean;
  engineName: string;
  faintAudioCaptured: boolean;
  speakerDiarizationEnabled: boolean;
}

export interface ReceiptItem {
  itemName: string; // اسم الصنف في الريسيت / الفاتورة
  quantity?: number | string; // الكمية المسجلة
  unitPrice?: number | string; // سعر الوحدة إن وجد
  totalPrice?: number | string; // السعر الإجمالي
  rawLine?: string; // السطر النصي المقروء
}

export type ReceiptItemStatus = 
  | "matched_exact" // متوفر نفس الصنف الأصلي المطلوب
  | "matched_generic_approved" // مثيل بنفس المادة الفعالة بموافقة العميل
  | "matched_substitute_approved" // بديل علاجي بموافقة العميل
  | "matched_substitute_unapproved" // مخالفة: مثيل أو بديل بدون موافقة العميل
  | "missing_not_provided" // صنف ناقص لم يتم توفيره في الفاتورة
  | "extra_item_unrequested"; // صنف إضافي بالفاتورة لم يطلبه العميل

export interface ReceiptAuditItemMatch {
  customerRequestedItem: string; // اسم الصنف المطلوب من العميل فقط
  customerRequestedQuantity?: string | number; // الكمية المطلوبة من العميل فقط بصوته في المكالمة
  receiptQuantity?: string | number; // الكمية المسجلة في الريسيت / الفاتورة
  isQuantityMatched?: boolean; // هل تطابقت الكمية المطلوبة من العميل مع كمية الريسيت
  quantityDiscrepancyAlert?: string; // نص التنبيه عند وجود فارق أو خطأ في الكمية
  agentReviewedQuantityOrItem?: string; // ما راجعه الزميل عند تأكيد ومراجعة الأوردر
  isAgentReviewCorrect?: boolean; // هل كانت مراجعة الزميل مطابقة لطلب العميل
  orderReviewAlert?: string; // تنبيه إذا راجع الزميل الصنف أو الكمية خطأ
  receiptItem: string; // الصنف المقابل المسجل في الريسيت / الفاتورة
  status: ReceiptItemStatus;
  statusArabic: string; // وصف الحالة بالعربية
  hasCustomerConsent: boolean; // هل وافق العميل في المكالمة
  consentSnippet?: string; // نص الموافقة المقتبس من تفريغ المكالمة مع توقيته
  pharmacologicalRelation?: string; // توضيح العلاقة الدوائية (نفس المادة الفعالة، بديل علاجي، صنف مختلف)
  unitPrice?: string | number;
  totalPrice?: string | number;
  auditNotes: string; // ملاحظات فاحص الجودة والتدقيق
}

export interface ReceiptTotalAudit {
  receiptTotal?: string | number; // إجمالي الفاتورة المسجل في الريسيت
  statedTotalByAgent?: string | number; // إجمالي الحساب الذي أبلغ به الزميل العميل في المكالمة
  wasStatedByAgent: boolean; // هل أبلغ وذكر الزميل الإجمالي للعميل في المكالمة
  isMatched: boolean; // هل الإجمالي الذي بلغه الزميل مطابق لإجمالي الريسيت
  difference?: string | number; // فارق المبلغ إن وجد
  agentStatementSnippet?: string; // نص كلام الزميل عند ذكر الإجمالي مع التوقيت من المكالمة
  status: "matched" | "mismatched" | "not_stated" | "unknown"; // مطابق / غير مطابق / لم يذكر الإجمالي
  statusArabic: string; // الوصف بالعربية
  evaluation: string; // تقييم فني بالعامية المصرية
  alert?: string; // نص التنبيه عند عدم ذكر الإجمالي أو وجود فارق
}

export interface ReceiptOrderReviewAudit {
  wasReviewedByAgent: boolean; // هل قام الزميل بمراجعة وتأكيد الأوردر مع العميل في نهاية المكالمة
  isReviewAccurate: boolean; // هل مراجعة الزميل مطابقة تماماً لما طلبه العميل فقط
  agentReviewSnippet?: string; // نص كلام الزميل عند مراجعة وتأكيد الأصناف والكميات
  customerOriginalRequestSummary?: string; // ملخص ما طلبه العميل فقط في المكالمة
  reviewDiscrepancies: string[]; // تفاصيل الأخطاء في مراجعة الأوردر أو تسجيله
  alert?: string; // نص التنبيه عند خطأ المراجعة أو التسجيل
}

export interface ReceiptQuantityAudit {
  customerTotalUnitsCount?: number | string; // إجمالي عدد الوحدات/العلب المطلوبة من العميل
  receiptTotalUnitsCount?: number | string; // إجمالي عدد الوحدات/العلب في الريسيت
  isAllQuantitiesMatched: boolean; // هل جميع كميات الأصناف مطابقة لطلب العميل فقط
  quantityDiscrepanciesCount: number; // عدد الأصناف التي فيها خطأ في الكمية
  alerts: string[]; // نصوص تنبيهات الفروقات في الكميات
}

export interface ReceiptComplianceAlert {
  alertType?: string;
  item?: string;
  description?: string;
  [key: string]: any;
}

export interface ReceiptDeliveryFeeAudit {
  isDeliveryPresentInReceipt: boolean; // هل ظهرت خدمة التوصيل في الريسيت
  deliveryFee?: string | number; // قيمة مصاريف التوصيل المطبوعة إن وجدت
  receiptBranch?: string; // اسم أو رقم الفرع المطبوع بالريسيت
  alert: string; // "تنبيه: مراجعة التأكد من صحتها مع الفرع المطبوع بالريسيت"
  notes?: string;
}

export interface ReceiptAuditResult {
  receiptExtractedText: string; // النص الكامل المستخرج عبر Tesseract OCR
  ocrConfidence?: number;
  receiptNumber?: string; // رقم الفاتورة إن وجد
  receiptDate?: string; // تاريخ الفاتورة إن وجد
  receiptTotal?: string | number; // إجمالي الفاتورة
  totalAudit?: ReceiptTotalAudit; // معيار الإجمالي: تطابق إجمالي الزميل مع الريسيت والتنبيه في حال عدم الذكر
  quantityAudit?: ReceiptQuantityAudit; // معيار التحقق من كمية وعدد الأصناف المطلوبة من العميل فقط والتنبيه عند الخطأ
  orderReviewAudit?: ReceiptOrderReviewAudit; // تدقيق مراجعة الزميل للأوردر وتأكيده مع العميل وكشف أي خطأ
  deliveryServiceAudit?: ReceiptDeliveryFeeAudit; // تدقيق خدمة التوصيل: لا تُحتسب كصنف مع تنبيه للتأكد من صحتها مع الفرع
  customerItemsCount?: number; // عدد الأصناف التي طلبها العميل فقط بصوته في المكالمة
  receiptItemsCount?: number; // عدد الأصناف المسجلة في الريسيت (دون احتساب خدمة التوصيل كصنف)
  isItemCountMatched?: boolean; // هل تطابق عدد الأصناف المطلوبة مع عدد أصناف الريسيت
  itemCountDiscrepancyAlert?: string; // تنبيه اختلاف عدد الأصناف
  totalRequestedItemsCount: number; // إجمالي الأصناف المطلوبة
  fulfilledItemsCount: number; // الأصناف المتوفرة
  missingItemsCount: number; // الأصناف الناقصة
  approvedSubstitutesCount: number; // البدائل والمثائل المعتمدة بموافقة
  unapprovedSubstitutesCount: number; // مخالفات: بدائل/مثائل بدون استئذان
  fulfillmentRatePercentage: number; // نسبة توفير الأوردر (مثلاً 100%)
  isFullyCompliant: boolean; // هل الأوردر مستوفٍ بالكامل بدون مخالفات
  itemsAudit: ReceiptAuditItemMatch[];
  unrequestedReceiptItems?: ReceiptItem[]; // أصناف إضافية لم يطلبها العميل (دون خدمة التوصيل)
  auditSummary: string; // خلاصة التدقيق بالعامية المصرية
  complianceAlerts: (string | ReceiptComplianceAlert)[]; // تنبيهات الجودة المكتشفة
}

// ----------------------------------------------------
// ذاكرة النظام الذكية المستمرة (Hindsight Agent Memory)
// ----------------------------------------------------
export type HindsightMemoryCategory = 
  | "world_facts"      // حقائق وقواعد الجودة والمعايير الصيدلانية
  | "experiences"      // تجارب سابقة وسجل أداء الزملاء
  | "observations"     // ملاحظات وتفاصيل الأصناف والعملاء المؤكدة
  | "mental_models";   // نماذج ذهنية وتوجيهات المشرف المؤكدة (Directives)

export interface HindsightMemoryEntry {
  id: string;
  category: HindsightMemoryCategory;
  categoryArabic: string;
  title: string;
  content: string;
  entities?: string[];
  tags?: string[];
  importance: "critical" | "high" | "medium" | "low";
  source: string;
  createdAt: string;
  updatedAt?: string;
  relevanceScore?: number;
}

export interface HindsightRecallResult {
  query: string;
  totalMemories: number;
  recalledCount: number;
  memories: HindsightMemoryEntry[];
  promptInjectionSnippet: string;
}

export interface HindsightBankStats {
  total: number;
  worldFactsCount: number;
  experiencesCount: number;
  observationsCount: number;
  mentalModelsCount: number;
  lastRetainedAt?: string;
}

export interface TranscriptionResponse {
  customerName?: string; // الاسم المستخرج من نداء الموظف للعميل عند وجود دليل
  agentName?: string; // اسم الزميل / الصيدلي
  transcript: TranscriptItem[]; // تفريغ نص المكالمة
  recalledHindsightMemories?: HindsightMemoryEntry[]; // الذكريات والتوجيهات المسترجعة عبر Hindsight لهذه المكالمة
  agentSilenceSummary: AgentSilenceSummary;
  customerNameAnalysis: CustomerNameAnalysis;
  customerTitleAnalysis?: CustomerTitleAnalysis;
  agentApologyAnalysis?: AgentApologyAnalysis;
  holdTimeSummary: HoldTimeSummary;
  greetingAnalysis: GreetingAnalysis;
  empathyAnalysis: EmpathyAnalysis;
  furtherAssistanceAnalysis: FurtherAssistanceAnalysis;
  unprofessionalWordsAnalysis?: UnprofessionalWordsAnalysis;
  callEndingAnalysis?: CallEndingAnalysis;
  agentToneAnalysis?: AgentToneAnalysis; // التحديث الجديد لنبرة صوت الزميل
  verbalTicsAnalysis?: VerbalTicsAnalysis; // تحليل اللازمات اللفظية وتكرار الكلمات المتكرر للزملاء
  medicalConsultationAnalysis?: MedicalConsultationAnalysis; // تدقيق بروتوكول الاستشارة الطبية في حال وجود استشارة
  agentScientificKnowledge?: AgentScientificKnowledgeAnalysis; // معيار المعرفة العلمية للزميل وتدقيقها عبر MEDSCAPE
  customerComplaintAnalysis?: CustomerComplaintAnalysis; // رصد وتنبيه شكاوى العميل أثناء المكالمة
  receiptAudit?: ReceiptAuditResult; // تدقيق مطابقة ريسيت الأصناف مع طلب العميل بموافقة على البدائل/المثائل
  isBenchmark?: boolean; // هل المكالمة معيارية مرجعية Benchmark
  benchmarkNotes?: string; // ملاحظات المعايرة القياسية للمكالمة
  _engineInfo?: EngineInfo;
  audioHash?: string; // البصمة الرقمية التشفيرية لملف الصوت SHA-256
  savedAt?: string; // تاريخ ووقت حفظ التحليل
  cacheHit?: boolean; // هل تم استرجاع النتيجة الفورية من كاش البصمة الصوتية
  sileroVad?: {
    engine: string;
    speechSegments: { start: number; end: number; confidence: number }[];
    silenceSegments: any[];
    speechRatio: number;
    totalAudioDuration: number;
    speechDuration: number;
    silenceDuration: number;
  };
  pipelineReviewMeta?: {
    reviewCount: number;
    consensusStatus: string;
    agreementScore: number;
    discrepancies: string[];
  };
  transcriptionAudit?: {
    isTranscriptComplete: boolean;
    lastTranscribedTimestamp: string;
    callTotalDuration: string;
    totalTurns: number;
    auditVerdict: string;
    coverageRatio: number;
  };
  pipelineStages?: PipelineStageInfo[];
  pydanticValidation?: {
    status: string;
    engine: string;
    validatedAt: string;
  };
}

export interface PipelineStageInfo {
  step: number;
  name: string;
  nameArabic: string;
  tool: string;
  status: "completed" | "in_progress" | "skipped";
  durationMs?: number;
  details?: string;
}

// سجل المكالمة المحللة الخاص بتبويب التقارير
export interface AnalyzedCallRecord {
  id: string;
  audioHash?: string; // البصمة الرقمية للمكالمة
  savedAt?: string; // توقيت الحفظ الفعلي بصيغة ISO
  agentName: string; // اسم الزميل
  customerName?: string; // اسم العميل إن وجد
  callDate: string; // تاريخ ووقت المكالمة
  duration: string; // مدة المكالمة
  overallScore: number; // درجة الجودة الكلية من 100
  // نبذة مختصرة من التحليل
  hasConsultation: boolean; // هل كان بها استشارة
  consultationSummary: string; // نبذة الاستشارة
  hasHold: boolean; // هل كان بها هولد
  holdSummary: string; // نبذة الهولد
  hasComplaint: boolean; // هل كان بها شكوى
  complaintSummary: string; // نبذة الشكوى
  toneSummary?: string; // نبذة نبرة صوت الزميل (Wav2Vec2)
  fullResult?: TranscriptionResponse; // البيانات الكاملة للمكالمة
}

// وضع معالجة المكالمات: تفريغ صوتي للمكالمة فقط أو تفريغ مع تحليل
export type CallProcessingMode = "transcription_only" | "transcription_with_analysis";

// بنود قياس وتقييم المكالمة وإعدادات الترتيب والإظهار/الإخفاء
export type MeasurementItemId =
  | "agentTone" // نبرة صوت الزميل والمشاعر
  | "holdTime" // فترات الهولد وموسيقى الانتظار
  | "silence" // لحظات الصمت المفرط
  | "greeting" // التحية والافتتاحية
  | "customerName" // اسم العميل
  | "customerTitle" // اللقب المفضل للعميل
  | "empathy" // التعاطف
  | "complaint" // شكاوى العميل
  | "apology" // اعتذار الزميل
  | "scientificKnowledge" // المعرفة الصيدلانية و Medscape
  | "medicalConsultation" // بروتوكول الاستشارة الطبية
  | "unprofessionalWords" // الألفاظ غير الاحترافية
  | "verbalTics" // اللازمات اللفظية وتكرار الأسئلة
  | "furtherAssistance" // المساعدة الإضافية
  | "callEnding"; // ختام المكالمة

export interface MeasurementItemSetting {
  id: MeasurementItemId;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  category: "acoustic" | "protocol" | "customer_experience" | "pharma";
  categoryArabic: string;
  visible: boolean;
  order: number;
}

export const DEFAULT_MEASUREMENT_SETTINGS: MeasurementItemSetting[] = [
  {
    id: "agentTone",
    title: "قياس نبرة ومشاعر صوت الزميل",
    titleEn: "Agent Voice Tone & Emotion",
    description: "قياس ترددات النبرة في المقدمة وأثناء المكالمة، ومؤشر الابتسامة والبشاشة والتردد",
    descriptionEn: "Voice tone analysis in greeting & call, smile index, and hesitation detection",
    category: "acoustic",
    categoryArabic: "التحليل الصوتي",
    visible: true,
    order: 1,
  },
  {
    id: "holdTime",
    title: "فترات الهولد وموسيقى الانتظار",
    titleEn: "Hold Time & Music Audit",
    description: "تدقيق مدة الهولد، ربط المعيار بوجود موسيقى، والاستئذان والشكر",
    descriptionEn: "Hold durations, music compliance, permission & thanking audit",
    category: "acoustic",
    categoryArabic: "التحليل الصوتي",
    visible: true,
    order: 2,
  },
  {
    id: "silence",
    title: "لحظات الصمت المفرط (> 10 ثوانٍ)",
    titleEn: "Excessive Silence (> 10s)",
    description: "رصد فترات الصمت التام بين الطرفين التي تتجاوز 10 ثوانٍ واستبعاد الطبيعية",
    descriptionEn: "Dead-air periods exceeding 10 seconds between agent & customer",
    category: "acoustic",
    categoryArabic: "التحليل الصوتي",
    visible: true,
    order: 3,
  },
  {
    id: "greeting",
    title: "التحية والافتتاحية وسرعة الرد",
    titleEn: "Greeting & Opening",
    description: "الترحيب الرسمي، ذكر اسم الصيدلية، وسرعة الرد خلال أول 3 ثوانٍ",
    descriptionEn: "Formal greeting, pharmacy brand mention, response speed in 3s",
    category: "protocol",
    categoryArabic: "بروتوكول المكالمة",
    visible: true,
    order: 4,
  },
  {
    id: "customerName",
    title: "رصد واستخدام اسم العميل",
    titleEn: "Customer Name Usage",
    description: "التقاط اسم العميل وعدد مرات مناداته به باحترام خلال المكالمة",
    descriptionEn: "Capturing customer name and frequency of addressing the customer",
    category: "customer_experience",
    categoryArabic: "تجربة العميل",
    visible: true,
    order: 5,
  },
  {
    id: "customerTitle",
    title: "اللقب المفضل للعميل",
    titleEn: "Customer Title Usage",
    description: "استخدام الألقاب المناسبة باحترام (يا فندم / أستاذ / دكتور)",
    descriptionEn: "Appropriate titles used respectfully throughout the conversation",
    category: "customer_experience",
    categoryArabic: "تجربة العميل",
    visible: true,
    order: 6,
  },
  {
    id: "empathy",
    title: "التعاطف والذوق الإنساني",
    titleEn: "Empathy Expressions",
    description: "عبارات التمني بالشفاء والسلامة (ألف سلامة / بالشفاء)",
    descriptionEn: "Empathy & wishing well upon illness or medical complaints",
    category: "customer_experience",
    categoryArabic: "تجربة العميل",
    visible: true,
    order: 7,
  },
  {
    id: "complaint",
    title: "رصد وتنبيه شكاوى العميل",
    titleEn: "Customer Complaints Detection",
    description: "اكتشاف أي شكوى أو اعتراض من العميل والإنذار المبكر بها",
    descriptionEn: "Immediate detection and alerting for customer complaints or distress",
    category: "customer_experience",
    categoryArabic: "تجربة العميل",
    visible: true,
    order: 8,
  },
  {
    id: "apology",
    title: "مرونة واعتذار الزميل",
    titleEn: "Agent Apology Analysis",
    description: "تقديم اعتذار لبق عند حدوث تأخير أو هولد طويل أو خطأ",
    descriptionEn: "Courteous apologies when needed for hold delays or mistakes",
    category: "protocol",
    categoryArabic: "بروتوكول المكالمة",
    visible: true,
    order: 9,
  },
  {
    id: "scientificKnowledge",
    title: "المعرفة الصيدلانية وتدقيق Medscape",
    titleEn: "Pharma Scientific Knowledge (Medscape)",
    description: "تدقيق البدائل، المواد الفعالة، والتداخلات الدوائية علمياً",
    descriptionEn: "Active ingredients, generic alternatives, and drug interactions audit",
    category: "pharma",
    categoryArabic: "المعايير الصيدلانية",
    visible: true,
    order: 10,
  },
  {
    id: "medicalConsultation",
    title: "بروتوكول الاستشارة الطبية",
    titleEn: "Medical Consultation Protocol",
    description: "خطوات الاستشارة عند طلب العميل نصيحة أو علاج لأعراض مرضية",
    descriptionEn: "Consultation workflow when customer seeks advice for symptoms",
    category: "pharma",
    categoryArabic: "المعايير الصيدلانية",
    visible: true,
    order: 11,
  },
  {
    id: "unprofessionalWords",
    title: "الألفاظ غير الاحترافية أو الدارجة",
    titleEn: "Unprofessional Words Filter",
    description: "فلترة الكلمات غير اللائقة أو المبتذلة للزميل مثل (معنديش معلومة)",
    descriptionEn: "Detection of banned colloquialisms or unprofessional phrases",
    category: "protocol",
    categoryArabic: "بروتوكول المكالمة",
    visible: true,
    order: 12,
  },
  {
    id: "verbalTics",
    title: "اللازمات اللفظية وتكرار الأسئلة",
    titleEn: "Verbal Tics & Repeated Questions",
    description: "رصد تكرار الكلمات غير المبرر أو تكرار نفس السؤال للعميل",
    descriptionEn: "Tracking repetitive vocal crutches and redundant questions",
    category: "protocol",
    categoryArabic: "بروتوكول المكالمة",
    visible: true,
    order: 13,
  },
  {
    id: "furtherAssistance",
    title: "عرض الخدمات الإضافية والمساعدة",
    titleEn: "Further Assistance Offer",
    description: "السؤال عن أي طلب آخر (أقدر أساعدك في أي حاجة تانية)",
    descriptionEn: "Asking if customer needs any additional assistance before closing",
    category: "protocol",
    categoryArabic: "بروتوكول المكالمة",
    visible: true,
    order: 14,
  },
  {
    id: "callEnding",
    title: "ختام وتوديع المكالمة",
    titleEn: "Call Ending & Sign-off",
    description: "استخدام صيغة الختام المتفق عليها فقط (شرفتنا أو شكراً للتواصل)",
    descriptionEn: "Compliant closing statement and thanking the caller",
    category: "protocol",
    categoryArabic: "بروتوكول المكالمة",
    visible: true,
    order: 15,
  },
];


