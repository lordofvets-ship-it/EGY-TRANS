import fs from "fs";
import path from "path";
import { 
  HindsightMemoryEntry, 
  HindsightMemoryCategory, 
  HindsightRecallResult, 
  HindsightBankStats 
} from "../types.js";

// Optional Hindsight official client
let hindsightClientInstance: any = null;
let isHindsightClientInitializing = false;

async function getHindsightClient(): Promise<any> {
  if (hindsightClientInstance || isHindsightClientInitializing) return hindsightClientInstance;
  isHindsightClientInitializing = true;
  try {
    const hindsightModule = await import("@vectorize-io/hindsight-client");
    if (hindsightModule && hindsightModule.HindsightClient) {
      const hindsightUrl = process.env.HINDSIGHT_API_URL || "http://localhost:8888";
      hindsightClientInstance = new hindsightModule.HindsightClient({ baseUrl: hindsightUrl });
      console.log(`[Hindsight] Official client initialized for ${hindsightUrl}`);
    }
  } catch (err) {
    console.log("[Hindsight] Running embedded autonomous memory engine.");
  } finally {
    isHindsightClientInitializing = false;
  }
  return hindsightClientInstance;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const BANK_FILE = path.join(DATA_DIR, "hindsight_memory_bank.json");

// Pre-seeded memory base reflecting all confirmed project details and quality standards
const DEFAULT_CONFIRMED_MEMORIES: HindsightMemoryEntry[] = [
  {
    id: "mem-dir-001",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "إلزامية إضافة درجة خطوات الاستشارة بجانب اسم المعيار",
    content: "تم التأكيد بشكل قاطع على وجوب إضافة درجة على حسب ما تم الرد وسؤال العميل عنه من أسئلة الاستشارة الطبية (من 8) ونسبتها المئوية، بجانب اسم المعيار فقط في بطاقة التقييم.",
    entities: ["خطوات الاستشارة", "الدرجة", "معيار الاستشارة الطبية"],
    tags: ["استشارة", "درجات", "توجيه_مشرف"],
    importance: "critical",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-09-28T07:00:00.000Z"
  },
  {
    id: "mem-dir-002",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "جدول الأصناف المطلوبة والبدائل والمثائل في مراجعة MEDSCAPE",
    content: "في المراجعة مع MEDSCAPE، المطلوب إلزامياً عمل جدول متصدر بالأصناف التي طلبها العميل والأصناف التي عرضها الزميل كبديل أو مثيل، يوضح اسم الصنف المطلوب، الصنف المعروض، نوع العلاقة (generic / alternative)، السلامة العلمية، والتحقق المعتمد من Medscape Drug Reference.",
    entities: ["Medscape", "بدائل", "مثائل", "جدول الأصناف"],
    tags: ["ميدسكاب", "بدائل", "أدوية", "توجيه_مشرف"],
    importance: "critical",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-09-29T01:24:00.000Z"
  },
  {
    id: "mem-dir-003",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "معيار شكوى العميل: الاعتذار الخاص وسكريبت عدم التكرار",
    content: "عند رصد أي شكوى من العميل بأي صيغة بالعامية المصرية (تأخير أوردر، صنف ناقص، عيب في صنف)، يلزم النظام بالتحقق الصارم من الاعتذار الخاص بالشكوى، وتطبيق سكريبت ضمان عدم التكرار المعتمد، والتنبيه الفوري في حال إغفال أحدهما.",
    entities: ["شكوى العميل", "اعتذار خاص", "عدم التكرار", "تأخير الأوردر"],
    tags: ["شكاوى", "اعتذار", "سكريبت", "جودة"],
    importance: "critical",
    source: "معايير الجودة المعتمدة",
    createdAt: "2026-09-20T10:00:00.000Z"
  },
  {
    id: "mem-wf-001",
    category: "world_facts",
    categoryArabic: "حقائق وقواعد الجودة العالمية",
    title: "ضوابط فترات الهولد وموسيقى الانتظار المعتمدة",
    content: "مدة الهولد المسموحة 90 ثانية أساسية (و180 ثانية كحد أقصى ممتد عند الاستئذان المسبق لنفس السبب). يجب الاستئذان بعبارة معتمدة، انتظار موافقة العميل، عزف نغمة أو موسيقى الانتظار، وشكر العميل والتأكد من وجوده عند العودة.",
    entities: ["الهولد", "موسيقى الانتظار", "90 ثانية", "استئذان"],
    tags: ["هولد", "صمت", "بروتوكول"],
    importance: "high",
    source: "بروتوكول كول سنتر صيدليات الطرشوبي",
    createdAt: "2026-09-20T10:00:00.000Z"
  },
  {
    id: "mem-wf-002",
    category: "world_facts",
    categoryArabic: "حقائق وقواعد الجودة العالمية",
    title: "قواعد الترحيب بالعميل واعتماد المرادفات الترحيبية",
    content: "يمنع منعاً باتاً احتساب 'لم يتم الترحيب' إذا نطق الزميل أي لفظ ترحيبي مثل 'أهلاً وسهلاً'، 'أهلاً بحضرتك'، 'أهلاً' (بمفردها)، 'أهلاً بيك/بيكي'، 'نورتنا'، 'شرفتنا'، أو رحب بالعميل باسمه بعد حديث العميل.",
    entities: ["الترحيب", "أهلاً وسهلاً", "أهلاً بحضرتك", "أهلاً", "نورتنا", "شرفتنا"],
    tags: ["ترحيب", "بروتوكول", "خدمة_عملاء"],
    importance: "high",
    source: "قواعد التدقيق القياسية",
    createdAt: "2026-09-20T10:00:00.000Z"
  },
  {
    id: "mem-obs-001",
    category: "observations",
    categoryArabic: "الملاحظات وتفاصيل الأصناف المؤكدة",
    title: "صيغة تدوين وتفريغ الأصناف ومطابقة MEDSCAPE",
    content: "عند تفريغ الأصناف المطلوبة من العميل: اكتب ما سُمع صوتياً حتى لو كان خطأً أو مشوشاً متبوعاً بالاسم الأقرب للصحة على Medscape بين قوسين: 'ما سُمع (الاسم الأقرب للصحة)'، مثل: 'كونجستال (Congestal)' و 'اوجمانتين (Augmentin)'.",
    entities: ["تفريغ الأصناف", "أسماء الأدوية", "كتابة_صوتية"],
    tags: ["أصناف", "تفريغ", "دقة"],
    importance: "high",
    source: "قواعد التدقيق الصيدلاني الصوتي",
    createdAt: "2026-09-20T10:00:00.000Z"
  },
  {
    id: "mem-exp-001",
    category: "experiences",
    categoryArabic: "التجارب والخبرات السابقة",
    title: "تدقيق المعرفة الصيدلانية لمركبات الضغط (كوتارج وتارج)",
    content: "في المكالمات السابقة تم تأكيد دقة التمييز بين Tareg 160 (فالسارتان أحادي) و Cotareg 160/12.5 (فالسارتان مع مدر بول هيدروكلوروثيازيد)، مع فحص تداخلات حاصرات مستقبلات الأنجيوتنسين ARBs عبر Medscape Interaction Checker.",
    entities: ["Cotareg", "Tareg", "فالسارتان", "ضغط الدم"],
    tags: ["فحص_سابق", "أدوية_ضغط", "خبرة_سابقة"],
    importance: "medium",
    source: "سجل التدقيق الصيدلاني المعتمد",
    createdAt: "2026-09-22T14:30:00.000Z"
  },
  {
    id: "mem-dir-004",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "ضوابط الواجهة الإنجليزية وتبيويب سحب الملفات",
    content: "عند تحويل التطبيق للغة الإنجليزية، تم التأكيد على تعديل كامل الواجهة للإنجليزية، حصر تبويب سحب الملفات في تبويب تفريغ الملفات فقط، ونقل شريط المهام الجانبي إلى اليسار لتناسب اتجاه LTR.",
    entities: ["اللغة الإنجليزية", "شريط المهام", "سحب الملفات"],
    tags: ["واجهة", "تنسيق", "توجيه_مشرف"],
    importance: "high",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-09-28T06:00:00.000Z"
  },
  {
    id: "mem-dir-005",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "الترحيب الحصري بعد المقدمة واستبعاد ما يسبق كلام العميل",
    content: "المقدمة هي أول كلام الزميل (التحية + اسم الشركة + اسمه). الترحيب المعتمد يأتي حصرياً بعد المقدمة في بداية المكالمة من الزميل فقط (أهلاً وسهلاً، أهلاً، أهلاً بحضرتك، أهلاً يا فندم، نورتنا، شرفتنا، منوّر، حبيبنا). لا يُحسب إذا كان ضمن المقدمة نفسها قبل أن يتحدث العميل، ولا لو قاله العميل، ولا في آخر المكالمة كوداع. إذا لم يُرحب الزميل بعد المقدمة تُرجع قائمة فارغة.",
    entities: ["الترحيب بعد المقدمة", "المقدمة", "أهلاً بحضرتك", "أهلاً وسهلاً"],
    tags: ["ترحيب", "مقدمة", "معيار_مؤكد", "hindsight"],
    importance: "critical",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-10-02T21:44:00.000Z"
  },
  {
    id: "mem-dir-006",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "معيار قياس فترات الصمت (Dead Air) وحساب الأوقات الحقيقية",
    content: "الصمت = وقت بداية كلام السطر التالي ناقص وقت نهاية كلام السطر السابق. يُحسب الصمت بين أي متحدثين (زميل ← عميل، عميل ← زميل، أو نفس المتحدث). استبعاد وتجاهل أي مدة صمت 10 ثوانٍ أو أقل (duration <= 10s)، واحتساب وعرض فترات الصمت التي تزيد عن 10 ثوانٍ فقط (duration > 10s) مع عرض الحساب الدقيق بدون تقدير ولا تقريب. وإذا كان التفريغ خالياً من الأوقات يرجع خطأ {'error': 'no_timestamps'}.",
    entities: ["لحظات الصمت", "Dead Air", "أكثر من 10 ثواني", "توقيتات"],
    tags: ["صمت", "أوقات", "معيار_مؤكد", "hindsight"],
    importance: "critical",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-10-02T21:47:00.000Z"
  },
  {
    id: "mem-dir-007",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "تدقيق مناداة اسم العميل ولقبه بالأدلة الحرفية والتوقيت",
    content: "يُدقق ذكر الزميل لاسم العميل المعتمد أو المستنتج من أول المكالمة (الاسم الأول أو الأخير أو الكامل أو بلقب مع الاسم). يُمنع منعاً باتاً احتساب 'حضرتك' أو 'يا فندم' وحدها كاسم أو لقب، واستبعاد ذكر العميل لاسمه بنفسه أو ذكر اسم شخص آخر. لكل مرة يُشترط ذكر الجملة الكاملة بنسخ حرفي وتوقيتها الدقيق (MM:SS) وتكرار الرصد إذا تكرر الاسم بنفس الجملة، وإذا لم يُذكر يرجع قائمة فارغة.",
    entities: ["اسم العميل", "لقب العميل", "يا فندم", "مناداة الاسم"],
    tags: ["اسم_العميل", "ألقاب", "معيار_مؤكد", "hindsight"],
    importance: "critical",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-10-02T21:48:00.000Z"
  },
  {
    id: "mem-dir-008",
    category: "mental_models",
    categoryArabic: "النماذج الذهنية وتوجيهات التقييم",
    title: "موضع عرض خدمات أخرى بعد مراجعة الأوردر أو بعد الإجمالي حصراً",
    content: "معيار عرض خدمات أخرى (مثل: 'تحب أساعدك في حاجة تانية؟'، 'أي خدمة تانية؟') يُشترط لاعتماده أن يكون قد طُرح حصرياً بعد الانتهاء من مراجعة تفاصيل الطلب أو بعد ذكر وإبلاغ العميل بالمبلغ الإجمالي للطلب. يتم استخراج لحظات مراجعة الأوردر والإجمالي وعبارات العرض حرفياً مع أوقاتها من التفريغ دون تقدير.",
    entities: ["عرض خدمات أخرى", "مراجعة الأوردر", "الإجمالي", "توقيت العرض"],
    tags: ["خدمات_أخرى", "أوردر", "إجمالي", "معيار_مؤكد", "hindsight"],
    importance: "critical",
    source: "تأكيد مباشر من المشرف (User Request)",
    createdAt: "2026-10-02T21:49:00.000Z"
  }
];

class HindsightMemoryEngine {
  private memories: HindsightMemoryEntry[] = [];
  private isLoaded = false;

  constructor() {
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(BANK_FILE)) {
        const raw = fs.readFileSync(BANK_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memories = parsed;
          this.isLoaded = true;
          return;
        }
      }
      // Initialize with default confirmed memories
      this.memories = [...DEFAULT_CONFIRMED_MEMORIES];
      this.persist();
      this.isLoaded = true;
    } catch (err) {
      console.error("[Hindsight] Error loading memory bank, using defaults:", err);
      this.memories = [...DEFAULT_CONFIRMED_MEMORIES];
      this.isLoaded = true;
    }
  }

  private persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${BANK_FILE}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.memories, null, 2), "utf-8");
      fs.renameSync(tempFile, BANK_FILE);
    } catch (err) {
      console.error("[Hindsight] Error saving memory bank to disk:", err);
    }
  }

  /**
   * Retrieve all authoritative directives (mental_models and critical rules)
   * so they are never omitted by relevance-only ranking.
   */
  public getAuthoritativeDirectives(): HindsightMemoryEntry[] {
    this.ensureLoaded();
    return this.memories.filter(
      (m) => m.category === "mental_models" || m.importance === "critical"
    );
  }

  /**
   * Retain: Store a new fact, experience, observation, or mental model into Hindsight.
   */
  public async retain(entry: {
    category: HindsightMemoryCategory;
    title: string;
    content: string;
    entities?: string[];
    tags?: string[];
    importance?: "critical" | "high" | "medium" | "low";
    source?: string;
  }): Promise<HindsightMemoryEntry> {
    this.ensureLoaded();

    const normalizedTitle = entry.title.trim();
    const normalizedContent = entry.content.trim();

    // B-003: Prevent duplicate directives if title and content match an existing entry
    const existingDuplicate = this.memories.find(
      (m) =>
        m.title.trim().toLowerCase() === normalizedTitle.toLowerCase() &&
        m.content.trim().toLowerCase() === normalizedContent.toLowerCase()
    );
    if (existingDuplicate) {
      return existingDuplicate;
    }

    const categoryArabicMap: Record<HindsightMemoryCategory, string> = {
      world_facts: "حقائق وقواعد الجودة العالمية",
      experiences: "التجارب والخبرات السابقة",
      observations: "الملاحظات وتفاصيل الأصناف المؤكدة",
      mental_models: "النماذج الذهنية وتوجيهات التقييم"
    };

    const newMemory: HindsightMemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: entry.category,
      categoryArabic: categoryArabicMap[entry.category] || "توجيه مؤكد",
      title: normalizedTitle,
      content: normalizedContent,
      entities: entry.entities || [],
      tags: entry.tags || [],
      importance: entry.importance || "high",
      source: entry.source || "تأكيد المشرف",
      createdAt: new Date().toISOString()
    };

    // Push to local memory array (prepend to keep latest on top)
    this.memories.unshift(newMemory);
    this.persist();

    // Try sending to official Hindsight client if reachable
    try {
      const client = await getHindsightClient();
      if (client && typeof client.retain === "function") {
        await client.retain({
          content: `${newMemory.title}: ${newMemory.content}`,
          context: `Category: ${newMemory.category}, Source: ${newMemory.source}`
        });
        console.log(`[Hindsight Client] Memory retained remotely: ${newMemory.title}`);
      }
    } catch (clientErr: any) {
      console.warn(`[Hindsight Client] Remote retain skipped: ${clientErr?.message || clientErr}`);
    }

    return newMemory;
  }

  /**
   * Recall: Retrieve relevant memories matching a query/context with similarity scores.
   */
  public async recall(
    query: string, 
    options?: { limit?: number; category?: HindsightMemoryCategory; minRelevance?: number }
  ): Promise<HindsightRecallResult> {
    this.ensureLoaded();

    const limit = options?.limit || 6;
    const minRelevance = options?.minRelevance || 0.15;
    const queryTokens = this.tokenize(query);

    // Compute relevance scores using biomimetic weighting (importance + token matching + category priority)
    const scoredMemories = this.memories
      .filter((mem) => !options?.category || mem.category === options.category)
      .map((mem) => {
        const memText = `${mem.title} ${mem.content} ${(mem.entities || []).join(" ")} ${(mem.tags || []).join(" ")}`;
        const memTokens = this.tokenize(memText);

        let matches = 0;
        for (const token of queryTokens) {
          if (memTokens.some((t) => t.includes(token) || token.includes(t))) {
            matches++;
          }
        }

        // Base token overlap score
        let score = queryTokens.length > 0 ? (matches / Math.sqrt(queryTokens.length * Math.min(memTokens.length, 25))) : 0.5;

        // Importance boost
        if (mem.importance === "critical") score += 0.35;
        else if (mem.importance === "high") score += 0.2;
        else if (mem.importance === "medium") score += 0.1;

        // Mental models (directives confirmed by user) receive highest recall priority
        if (mem.category === "mental_models") score += 0.25;

        return {
          ...mem,
          relevanceScore: Math.min(Math.round(score * 100) / 100, 1.0)
        };
      });

    // Sort by relevance score descending
    scoredMemories.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Filter by minRelevance or take top entries
    let recalled = scoredMemories.filter((m) => (m.relevanceScore || 0) >= minRelevance);
    if (recalled.length === 0 && scoredMemories.length > 0) {
      // Fallback to top critical directives
      recalled = scoredMemories.slice(0, 3);
    }
    recalled = recalled.slice(0, limit);

    // Format prompt injection string
    const promptInjectionSnippet = this.formatRecalledForPrompt(recalled);

    return {
      query,
      totalMemories: this.memories.length,
      recalledCount: recalled.length,
      memories: recalled,
      promptInjectionSnippet
    };
  }

  /**
   * Format recalled memories into a high-authority prompt injection block for Gemini.
   */
  public formatRecalledForPrompt(recalled: HindsightMemoryEntry[]): string {
    if (!recalled || recalled.length === 0) return "";

    const lines: string[] = [
      "=== ذاكرة النظام المستمرة (HINDSIGHT RECALLED MEMORIES & DIRECTIVES) ===",
      "تنبيه فائق الأهمية لموديل الذكاء الاصطناعي: هذه الذاكرة مسترجعة من بنك الذاكرة الدائمة للنظام (Hindsight Agent Memory) وتتضمن تفاصيل وتوجيهات وقواعد أكد عليها المشرف في جلسات سابقة. يجب الالتزام التام والحرفي بكل قاعدة وملاحظة مسترجعة أدناه أثناء التقييم والتفريغ:",
      ""
    ];

    recalled.forEach((mem, idx) => {
      lines.push(`${idx + 1}. [${mem.categoryArabic} - ${mem.importance.toUpperCase()}]: ${mem.title}`);
      lines.push(`   * التفصيل المؤكد: ${mem.content}`);
      lines.push(`   * المصدر: ${mem.source}`);
      if (mem.entities && mem.entities.length > 0) {
        lines.push(`   * الكيانات المرتبطة: ${mem.entities.join(", ")}`);
      }
      lines.push("");
    });

    lines.push("=== نهاية الذاكرة المسترجعة ===");
    return lines.join("\n");
  }

  /**
   * List memories with optional filtering.
   */
  public listMemories(filter?: { category?: HindsightMemoryCategory; search?: string }): HindsightMemoryEntry[] {
    this.ensureLoaded();
    let result = [...this.memories];

    if (filter?.category) {
      result = result.filter((m) => m.category === filter.category);
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          (m.entities || []).some((e) => e.toLowerCase().includes(q)) ||
          (m.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }

  /**
   * Delete a memory item by ID.
   */
  public deleteMemory(id: string): boolean {
    this.ensureLoaded();
    const initialLen = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Reset memories to certified defaults.
   */
  public resetToDefaults(): void {
    this.memories = [...DEFAULT_CONFIRMED_MEMORIES];
    this.persist();
  }

  /**
   * Get bank statistics.
   */
  public getStats(): HindsightBankStats {
    this.ensureLoaded();
    return {
      total: this.memories.length,
      worldFactsCount: this.memories.filter((m) => m.category === "world_facts").length,
      experiencesCount: this.memories.filter((m) => m.category === "experiences").length,
      observationsCount: this.memories.filter((m) => m.category === "observations").length,
      mentalModelsCount: this.memories.filter((m) => m.category === "mental_models").length,
      lastRetainedAt: this.memories[0]?.createdAt
    };
  }

  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }
}

// Export singleton instance
export const hindsightEngine = new HindsightMemoryEngine();
