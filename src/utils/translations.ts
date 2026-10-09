export type Language = "ar" | "en";

export interface Translations {
  appName: string;
  appSubtitle: string;
  tabs: {
    home: string;
    transcription: string;
    invoice_audit: string;
    reports: string;
    memory: string;
    benchmark: string;
    settings: string;
    about: string;
  };
  sidebar: {
    title: string;
    appearance: string;
    light: string;
    dark: string;
    language: string;
    arabic: string;
    english: string;
    uploadInvoice: string;
    supportedFormats: string;
    supportedFormatsList: string;
    systemBadge: string;
    version: string;
    soon: string;
    info: string;
  };
  topbar: {
    systemTitle: string;
    uploadInvoice: string;
    benchmark: string;
    exportExcel: string;
    receiptModal: string;
    lightMode: string;
    darkMode: string;
    toggleTheme: string;
    langButton: string;
  };
  landing: {
    heroTitle: string;
    heroDesc: string;
    dropzoneTitle: string;
    dropzoneDesc: string;
    supportedAudioFormats: string;
    benchmarkButton: string;
    receiptCardTitle: string;
    receiptCardDesc: string;
    receiptFormats: string;
    receiptCondition: string;
    uploadInvoiceBtn: string;
    auditWindowBtn: string;
    errorTitle: string;
    retry: string;
    startTranscription: string;
    reset: string;
    analyzingTitle: string;
  };
  homeView: {
    systemBadge: string;
    heroTitle: string;
    heroDesc: string;
    activeAlertTitle: string;
    activeAlertDesc: string;
    viewReportBtn: string;
    transcriptionCardTitle: string;
    transcriptionCardDesc: string;
    transcriptionCardAction: string;
    invoiceCardTitle: string;
    invoiceCardDesc: string;
    invoiceCardAction: string;
    reportsCardTitle: string;
    reportsCardDesc: string;
    reportsCardAction: string;
    benchmarkCardTitle: string;
    benchmarkCardDesc: string;
    benchmarkCardAction: string;
    standardComplaint: string;
    standardMedscape: string;
    standardSilence: string;
  };
  results: {
    benchmarkTitle: string;
    benchmarkBadge: string;
    benchmarkCertified: string;
    completeTitle: string;
    completeSubtitle: string;
    exportExcelBtn: string;
    receiptAuditBtn: string;
    benchmarkToggleActive: string;
    benchmarkToggleInactive: string;
    newCall: string;
    excelHubTitle: string;
    excelHubBadge: string;
    excelHubDesc: string;
    directDownload: string;
    inspectSheets: string;
    receiptBannerTitle: string;
    receiptBannerDesc: string;
    receiptBannerFormats: string;
    silenceSectionTitle: string;
    silenceSectionDesc: string;
    totalSilenceTime: string;
    seconds: string;
    overallStatus: string;
    silenceDetected: string;
    noExcessiveSilence: string;
    times: string;
    silenceTableTitle: string;
    noSilenceDetectedMsg: string;
  };
  about: {
    title: string;
    subtitle: string;
    backHome: string;
    overviewTitle: string;
    overviewDesc: string;
    p1Title: string;
    p1Desc: string;
    p2Title: string;
    p2Desc: string;
    p3Title: string;
    p3Desc: string;
    p4Title: string;
    p4Desc: string;
    standardsTitle: string;
    std1: string;
    std2: string;
    std3: string;
    footerPortal: string;
    footerAction: string;
  };
  newTab: {
    awaitingBadge: string;
    blueprintDesc: string;
    placeholderTitle: string;
    placeholderDesc: string;
    backHome: string;
  };
  invoiceAudit: {
    title: string;
    subtitle: string;
    badge: string;
    dropzoneTitle: string;
    dropzoneDesc: string;
    pasteHint: string;
    openModal: string;
    uploadNewReceipt: string;
    noTranscriptWarning: string;
    ocrSuccess: string;
    itemsCount: string;
    matchedCount: string;
    substitutesCount: string;
  };
  qaReports: {
    title: string;
    subtitle: string;
    badge: string;
    searchPlaceholder: string;
    filterAll: string;
    filterConsultation: string;
    filterHold: string;
    filterComplaint: string;
    colleagueName: string;
    consultationTitle: string;
    holdTitle: string;
    complaintTitle: string;
    toneTitle: string;
    scoreTitle: string;
    viewCallBtn: string;
    exportExcelBtn: string;
    emptyTitle: string;
    emptyDesc: string;
    backHome: string;
  };
  footer: {
    desc: string;
    copyright: string;
  };
}

export const translations: Record<Language, Translations> = {
  ar: {
    appName: "مُفرِّغ المكالمات",
    appSubtitle: "وتدقيق جودة المكالمات",
    tabs: {
      home: "الرئيسية",
      transcription: "تفريغ المكالمات",
      invoice_audit: "تدقيق الفواتير",
      reports: "التقارير",
      memory: "ذاكرة النظام (Hindsight)",
      benchmark: "المكالمة المعيارية",
      settings: "الإعدادات",
      about: "ABOUT",
    },
    sidebar: {
      title: "شريط التبويبات",
      appearance: "مظهر التطبيق",
      light: "نهاري",
      dark: "ليلي",
      language: "لغة التطبيق",
      arabic: "العربية",
      english: "English",
      uploadInvoice: "رفع ملف الفاتورة",
      supportedFormats: "الصيغ المدعومة:",
      supportedFormatsList: "PNG • JPG • WEBP • PDF",
      systemBadge: "نظام تدقيق الجودة",
      version: "v1.2.0",
      soon: "قريباً",
      info: "INFO",
    },
    topbar: {
      systemTitle: "نظام تدقيق الجودة الصيدلانية",
      uploadInvoice: "رفع ملف الفاتورة",
      benchmark: "المكالمة المعيارية",
      exportExcel: "تصدير إكسيل",
      receiptModal: "نافذة الريسيت",
      lightMode: "الوضع النهاري",
      darkMode: "الوضع الليلي",
      toggleTheme: "تبديل المظهر",
      langButton: "English",
    },
    landing: {
      heroTitle: "تفريغ المحادثات وتحليل جودة المكالمة",
      heroDesc: "أنزل ملف تسجيل المكالمة (بأي صيغة مثل MP3، WAV، M4A) الخاص بزميل السنتر لتفريغ المكالمة بدقة متناهية وفصل أطراف الحديث وتحليل عناصر الجودة.",
      dropzoneTitle: "اسحب وأفلت ملف تسجيل المكالمة الصوتي هنا",
      dropzoneDesc: "أو انقر في أي مكان لتصفح واختيار الملف من جهازك",
      supportedAudioFormats: "WAV • MP3 • M4A • WEBM • OGG • AAC",
      benchmarkButton: "عرض المكالمة المعيارية المعتمدة (Benchmark)",
      receiptCardTitle: "تدقيق ريسيت الفاتورة ومطابقة طلب العميل",
      receiptCardDesc: "ارفع صورة الفاتورة / الريسيت للتأكد من توفير كافة الأصناف التي طلبها العميل، أو التأكد من استئذان وموافقة العميل الصريحة على أي صنف بديل أو مثيل.",
      receiptFormats: "الصيغ المدعومة: PNG • JPG • JPEG • WEBP • PDF",
      receiptCondition: "شرط المطابقة: ارفع تسجيل المكالمة الصوتي أولاً ليتمكن النظام من مطابقة أصناف الفاتورة مع طلب العميل.",
      uploadInvoiceBtn: "رفع ملف الفاتورة",
      auditWindowBtn: "نافذة التدقيق (Ctrl+V)",
      errorTitle: "أخطأ ما حدث:",
      retry: "إعادة المحاولة",
      startTranscription: "ابدأ التفريغ الصوتي واستخراج فترات الصمت الذكي",
      reset: "إعادة التعيين والتراجع",
      analyzingTitle: "جاري تحليل المكالمة بدقة",
    },
    homeView: {
      systemBadge: "منظومة تقييم وضمان الجودة الشاملة (QA)",
      heroTitle: "إدارة الجودة والتدقيق الذكي للمكالمات",
      heroDesc: "المنظومة المعتمدة لتدقيق مكالمات خدمة العملاء والصيدليات، فحص معايير الشكوى والاعتذار الفوري، مراجعة البدائل الطبية عبر Medscape، واحتساب فترات الصمت والهولد بدقة.",
      activeAlertTitle: "يوجد تقرير مكالمة صوتية نشط ومحلل",
      activeAlertDesc: "تم استخراج فترات الصمت، تدقيق معايير الشكوى، ومطابقة Medscape بنجاح.",
      viewReportBtn: "عرض التفريغ والتقييم الكامل ←",
      transcriptionCardTitle: "تفريغ وتحليل المكالمات",
      transcriptionCardDesc: "رفع التسجيل الصوتي وتفريغه واستخراج الصمت والهولد",
      transcriptionCardAction: "بدء التحليل ←",
      invoiceCardTitle: "تدقيق ومطابقة الفواتير",
      invoiceCardDesc: "مطابقة أصناف الفاتورة واستئذان البدائل والمثائل",
      invoiceCardAction: "تدقيق الفاتورة ←",
      reportsCardTitle: "تقارير الجودة ومؤشرات QA",
      reportsCardDesc: "سجل المكالمات، تصدير ملفات Excel الشاملة والتقييمات",
      reportsCardAction: "التقارير ←",
      benchmarkCardTitle: "المكالمة المعيارية Benchmark",
      benchmarkCardDesc: "معايرة القياس، مراجعة معايير الشكوى والسكربت المعتمد",
      benchmarkCardAction: "المعيار القياسي ←",
      standardComplaint: "معيار الشكوى: التحقق من الاعتذار الخاص وسكريبت ضمان عدم التكرار",
      standardMedscape: "تدقيق Medscape: جدول الأصناف المطلوبة والبدائل والمثائل المعروضة",
      standardSilence: "احتساب فترات الصمت: استئذان الهولد ورصد الـ Dead Air",
    },
    results: {
      benchmarkTitle: "المكالمة المعيارية المعتمدة (BENCHMARK)",
      benchmarkBadge: "مرجع تدقيق الجودة القياسي",
      benchmarkCertified: "معايرة معتمدة",
      completeTitle: "اكتمال تفريغ وتحليل المكالمة الصوتية",
      completeSubtitle: "العامّية المصرية، الإنصات العميق للهمسات، والتفرقة بين المتحدثين",
      exportExcelBtn: "تصدير التقييم إكسيل (Excel)",
      receiptAuditBtn: "تدقيق ريسيت الفاتورة (قص ولصق)",
      benchmarkToggleActive: "معيار معتمد (Benchmark)",
      benchmarkToggleInactive: "اعتماد كـ Benchmark",
      newCall: "تحليل مكالمة جديدة",
      excelHubTitle: "استخراج تقرير التقييم على صيغة إكسيل (Excel Export)",
      excelHubBadge: "5 أوراق عمل (.XLSX)",
      excelHubDesc: "ملف إكسيل قياسي متكامل يشمل: ملخص درجات الـ KPI، جداول فترات الصمت والهولد، بروتوكول الاستشارة الطبية وتدقيق Medscape، وتقرير تدقيق ريسيت الفاتورة وموافقة العميل.",
      directDownload: "تحميل مباشر (.xlsx)",
      inspectSheets: "تبويب ومعاينة الأوراق",
      receiptBannerTitle: "تدقيق ريسيت الفاتورة ومطابقة أصناف طلب العميل",
      receiptBannerDesc: "مطابقة الأصناف الموفرة في الفاتورة مع ما طلبه العميل بالمكالمة والتأكد من استئذانه الصريح لأي بديل.",
      receiptBannerFormats: "اسحب الصورة هنا أو الصق من الحافظة (Ctrl+V)",
      silenceSectionTitle: "كشف وتحليل فترات الصمت المفرط (> 10 ثوانٍ)",
      silenceSectionDesc: "استبعاد فترات الصمت الطبيعي (≤ 10 ثوانٍ) وحساب الفترات الزائدة فقط لدقة التقييم.",
      totalSilenceTime: "إجمالي مدة الصمت (> 10 ث)",
      seconds: "ثانية",
      overallStatus: "الحالة الإجمالية",
      silenceDetected: "رُصد صمت",
      noExcessiveSilence: "لا يوجد صمت يتعدى 10 ثوانٍ",
      times: "مرات",
      silenceTableTitle: "جدول لحظات الصمت التي تتجاوز 10 ثوانٍ مرتبة زمنياً:",
      noSilenceDetectedMsg: "لم يتم رصد أي فترات صمت تتجاوز 10 ثوانٍ في هذه المكالمة (تم استبعاد الفترات الطبيعية التي لا تتعدى 10 ثوانٍ).",
    },
    about: {
      title: "نظام تدقيق الجودة وتفريغ المكالمات (ABOUT)",
      subtitle: "منظومة مخصصة للعامية المصرية ودعم مراقبة جودة مكالمات خدمة العملاء والسنتر الصيدلاني",
      backHome: "العودة للرئيسية",
      overviewTitle: "نبذة عن النظام وأهدافه",
      overviewDesc: "تم بناء هذا النظام خصيصاً لخدمة فرق مراقبة الجودة (QA) في مراكز الاتصال الصيدلانية، حيث يوفر آلية متقدمة لتفريغ المكالمات بالعامية المصرية بأعلى درجات الدقة، والتفرقة الصوتية التامة بين صوت العميل وموظف خدمة العملاء، مع قياس لحظات الصمت وتدقيق فترات الهولد وفق القواعد الصارمة.",
      p1Title: "1. التفريغ الصوتي عالي الحساسية",
      p1Desc: "يدعم نماذج تفريغ مخصصة لالتقاط أدق الأصوات وردود التأكيد المكتومة والهمسات بالعامية المصرية مع الطوابع الزمنية الدقيقة لكل طرف.",
      p2Title: "2. معيار الهولد وموسيقى الانتظار",
      p2Desc: "احتساب الهولد مشروط قطعياً بوجود وبث صوت موسيقى الانتظار، ويُحسب التوقيت من أول صدور الموسيقى إلى انتهائها فقط حتى لو تحدث العميل أثناء عزفها.",
      p3Title: "3. تدقيق ريسيت الفاتورة (Tesseract OCR)",
      p3Desc: "قراءة ضوئية فورية ومطابقة الأصناف المكتوبة في الفاتورة مع طلب العميل في المكالمة، والتأكد الصارم من استئذان العميل وموافقته الصريحة على أي بديل.",
      p4Title: "4. تصدير تقارير الإكسيل الشاملة",
      p4Desc: "توليد ملفات إكسيل احترافية تضم 5 أوراق عمل (.xlsx) لكافة مؤشرات الأداء، الصمت، الهولد، الاستشارات، وسجل التفريغ الكامل.",
      standardsTitle: "المعايير المعتمدة في النظام:",
      std1: "فصل المتحدثين (Diarization)",
      std2: "استبعاد الصمت الطبيعي (≤ 10 ثوانٍ)",
      std3: "دعم السحب والإفلات واللصق Ctrl+V",
      footerPortal: "Egyptian Arabic Call Transcriber & QA Audit Portal",
      footerAction: "الانتقال للرئيسية وتفريغ المكالمات",
    },
    newTab: {
      awaitingBadge: "قيد التعريف لاحقاً",
      blueprintDesc: "هذا التبويب مدرج وفقاً للتصميم، وسيتم تفعيله لاحقاً خطوة بخطوة بناءً على توجيهاتكم الكريمة.",
      placeholderTitle: "في انتظار تحديد دلالة وإعدادات هذا التبويب",
      placeholderDesc: "التبويب جاهز في الواجهة تماماً طبقاً للتصميم. سنقوم بتعريف قواعده وربطها فور إخطارنا بدلالته واحتياجاته.",
      backHome: "العودة للرئيسية",
    },
    invoiceAudit: {
      title: "تدقيق ريسيت الفاتورة ومطابقة طلب العميل",
      subtitle: "مطابقة الأصناف المستخرجة ضوئياً من صورة الفاتورة مع طلب العميل بالمكالمة والتأكد من استئذان العميل لأي بديل",
      badge: "نظام التحقق البصري OCR",
      dropzoneTitle: "اسحب صورة الريسيت أو الفاتورة هنا",
      dropzoneDesc: "أو انقر لتصفح واختيار الصورة من جهازك",
      pasteHint: "يمكنك أيضاً الضغط على Ctrl+V للصق الصورة مباشرة من الحافظة",
      openModal: "فتح نافذة التدقيق الكامل والمطابقة",
      uploadNewReceipt: "رفع فاتورة أخرى للتدقيق",
      noTranscriptWarning: "تنبيه: لم يتم تفريغ مكالمة بعد. الرجاء رفع مكالمة صوتية لمقارنة أصناف الفاتورة مع طلب العميل الفعلي.",
      ocrSuccess: "تم استخراج أصناف الفاتورة بنجاح",
      itemsCount: "إجمالي الأصناف",
      matchedCount: "الأصناف المطابقة",
      substitutesCount: "البدائل المستأذن بها",
    },
    qaReports: {
      title: "سجل المكالمات المحللة",
      subtitle: "سجل للمكالمات التي تم تحليلها باسم الزميل مع نبذة مختصرة من التحليل مثل: كان بها استشارة - هولد - شكوى",
      badge: "سجل التحليلات المعتمد",
      searchPlaceholder: "ابحث باسم الزميل أو الصيدلي...",
      filterAll: "جميع المكالمات",
      filterConsultation: "بها استشارة",
      filterHold: "بها هولد",
      filterComplaint: "بها شكوى",
      colleagueName: "اسم الزميل",
      consultationTitle: "الاستشارة الطبية / الدوائية",
      holdTitle: "الهولد وموسيقى الانتظار",
      complaintTitle: "شكوى العميل",
      toneTitle: "نبرة صوت الزميل",
      scoreTitle: "درجة الجودة",
      viewCallBtn: "عرض التحليل والتفريغ الكامل",
      exportExcelBtn: "تصدير تقرير الإكسيل (.xlsx)",
      emptyTitle: "لا توجد مكالمات مطابقة في السجل",
      emptyDesc: "تفضل برفع وتحليل مكالمة صوتية في التبويب 'الرئيسية' لتسجيلها تلقائياً باسم الزميل.",
      backHome: "العودة للرئيسية لتحليل مكالمة",
    },
    footer: {
      desc: "دقة تامة لالتقاط اللهجة المصرية والتحليل الاستقرائي للصمت وموسيقى الهولد وتدقيق الفواتير ومطابقة الأصناف.",
      copyright: "QA Auditor Tool",
    },
  },
  en: {
    appName: "Call Transcriber",
    appSubtitle: "QA & Call Quality Auditor",
    tabs: {
      home: "Dashboard",
      transcription: "Transcription",
      invoice_audit: "Invoice Audit",
      reports: "QA Reports",
      memory: "System Memory (Hindsight)",
      benchmark: "Benchmark Call",
      settings: "Settings",
      about: "ABOUT",
    },
    sidebar: {
      title: "Navigation Tabs",
      appearance: "Theme Mode",
      light: "Light",
      dark: "Dark",
      language: "Language",
      arabic: "العربية",
      english: "English",
      uploadInvoice: "Upload Invoice",
      supportedFormats: "Supported Formats:",
      supportedFormatsList: "PNG • JPG • WEBP • PDF",
      systemBadge: "QA Quality System",
      version: "v1.2.0",
      soon: "Soon",
      info: "INFO",
    },
    topbar: {
      systemTitle: "Pharma Call Quality Audit System",
      uploadInvoice: "Upload Invoice",
      benchmark: "Benchmark Call",
      exportExcel: "Export Excel",
      receiptModal: "Receipt Modal",
      lightMode: "Light Mode",
      darkMode: "Dark Mode",
      toggleTheme: "Toggle Theme",
      langButton: "العربية",
    },
    landing: {
      heroTitle: "Call Transcription & Quality Analytics",
      heroDesc: "Upload customer service call recordings (MP3, WAV, M4A) for high-precision Egyptian Arabic transcription, speaker diarization, and strict QA metrics analysis.",
      dropzoneTitle: "Drag & drop audio recording here",
      dropzoneDesc: "or click anywhere to browse and choose a file from your device",
      supportedAudioFormats: "WAV • MP3 • M4A • WEBM • OGG • AAC",
      benchmarkButton: "View Certified Benchmark Call",
      receiptCardTitle: "Receipt OCR Audit & Order Item Matching",
      receiptCardDesc: "Upload receipt / invoice image to verify fulfillment of all items requested by the customer, and enforce verified consent for any substitute.",
      receiptFormats: "Supported: PNG • JPG • JPEG • WEBP • PDF",
      receiptCondition: "Requirement: Upload call audio first so the system can match invoice items with the customer's conversation.",
      uploadInvoiceBtn: "Upload Invoice",
      auditWindowBtn: "Audit Window (Ctrl+V)",
      errorTitle: "An error occurred:",
      retry: "Retry",
      startTranscription: "Start Transcription & Smart Silence Analysis",
      reset: "Reset & Clear",
      analyzingTitle: "Analyzing call accurately",
    },
    homeView: {
      systemBadge: "Comprehensive Quality Assurance (QA) System",
      heroTitle: "Intelligent Call Audit & Quality Management",
      heroDesc: "Certified platform for evaluating customer service & pharmacy calls, verifying complaint handling and apologies, reviewing medical alternatives via Medscape, and analyzing silence & hold durations.",
      activeAlertTitle: "Active Analyzed Call Report Available",
      activeAlertDesc: "Silence extraction, complaint compliance checks, and Medscape verification completed.",
      viewReportBtn: "View Full Transcript & Evaluation →",
      transcriptionCardTitle: "Call Transcription & Analysis",
      transcriptionCardDesc: "Upload audio call recording, transcribe, and extract silence & hold",
      transcriptionCardAction: "Start Analysis →",
      invoiceCardTitle: "Invoice Audit & Item Matching",
      invoiceCardDesc: "Match invoice items and verify customer consent for substitutes",
      invoiceCardAction: "Audit Invoice →",
      reportsCardTitle: "Quality Reports & QA Metrics",
      reportsCardDesc: "Call history logs, comprehensive Excel exports, and agent evaluations",
      reportsCardAction: "View Reports →",
      benchmarkCardTitle: "Standard Benchmark Call",
      benchmarkCardDesc: "Calibrate scoring, review complaint standards & certified script",
      benchmarkCardAction: "Benchmark →",
      standardComplaint: "Complaint Standard: Verify specific apology and non-recurrence script",
      standardMedscape: "Medscape Audit: Table of requested items vs offered alternatives",
      standardSilence: "Silence Calculation: Hold permission check and Dead Air detection",
    },
    results: {
      benchmarkTitle: "Certified Benchmark Call (BENCHMARK)",
      benchmarkBadge: "QA Standard Reference",
      benchmarkCertified: "Certified Benchmark",
      completeTitle: "Call Transcription & QA Completed",
      completeSubtitle: "Egyptian Arabic, deep acoustic whispers, and speaker diarization",
      exportExcelBtn: "Export Evaluation to Excel",
      receiptAuditBtn: "Audit Receipt (Paste Ctrl+V)",
      benchmarkToggleActive: "Certified Benchmark",
      benchmarkToggleInactive: "Set as Benchmark",
      newCall: "Analyze New Call",
      excelHubTitle: "Export Full Evaluation to Excel (.xlsx)",
      excelHubBadge: "5 Integrated Sheets (.XLSX)",
      excelHubDesc: "Comprehensive multi-sheet report including: KPI scorecard, Silence & Hold logs, Medical protocol & Medscape review, and Receipt OCR match results.",
      directDownload: "Direct Download (.xlsx)",
      inspectSheets: "Inspect Sheets",
      receiptBannerTitle: "Receipt OCR Audit & Customer Order Matching",
      receiptBannerDesc: "Match fulfilled invoice items against customer conversation and verify consent for alternatives.",
      receiptBannerFormats: "Drag image here or paste from clipboard (Ctrl+V)",
      silenceSectionTitle: "Excessive Silence Detection (> 10 seconds)",
      silenceSectionDesc: "Excludes normal pauses (≤ 10s) and calculates only excessive silences for precise QA scoring.",
      totalSilenceTime: "Total Silence Duration (> 10s)",
      seconds: "seconds",
      overallStatus: "Overall Status",
      silenceDetected: "Silence detected",
      noExcessiveSilence: "No silence exceeds 10 seconds",
      times: "times",
      silenceTableTitle: "Chronological Table of Silences Exceeding 10 Seconds:",
      noSilenceDetectedMsg: "No silence exceeding 10 seconds was detected in this call (normal pauses ≤ 10s excluded).",
    },
    about: {
      title: "Call Quality Audit & Transcription (ABOUT)",
      subtitle: "Dedicated system for Egyptian Arabic pharmaceutical call center quality assurance",
      backHome: "Back to Dashboard",
      overviewTitle: "About the System & Objectives",
      overviewDesc: "Built specifically for Quality Assurance (QA) teams in pharmacy contact centers, providing advanced Egyptian Arabic speech transcription, strict speaker separation, silence duration analytics, and compliant hold music audits.",
      p1Title: "1. High-Sensitivity Audio Transcription",
      p1Desc: "Customized models capturing subtle whispers, muted confirmations, and conversational Egyptian Arabic dialect with precise timestamps.",
      p2Title: "2. Hold Music Standard",
      p2Desc: "Hold time calculation is strictly conditioned on the broadcast of hold music, calculated exclusively from start to finish of the tune even if customer speaks.",
      p3Title: "3. Receipt OCR Audit (Tesseract)",
      p3Desc: "Instant optical scanning and matching of invoiced items against customer voice requests, strictly verifying customer consent for alternatives.",
      p4Title: "4. Multi-Sheet Excel Reports",
      p4Desc: "Generates 5-sheet standard Excel workbooks (.xlsx) for KPI scores, silence logs, hold audits, medical reviews, and full diarized transcripts.",
      standardsTitle: "Approved System Standards:",
      std1: "Speaker Diarization",
      std2: "Exclude Normal Pauses (≤ 10s)",
      std3: "Drag & Drop + Clipboard Ctrl+V",
      footerPortal: "Egyptian Arabic Call Transcriber & QA Audit Portal",
      footerAction: "Go to Dashboard & Call Transcriber",
    },
    newTab: {
      awaitingBadge: "Awaiting Definition",
      blueprintDesc: "This tab is included per the design specifications and will be activated step-by-step according to your instructions.",
      placeholderTitle: "Awaiting settings and logic for this tab",
      placeholderDesc: "The tab is ready in the interface according to the design. We will define its rules once notified.",
      backHome: "Back to Dashboard",
    },
    invoiceAudit: {
      title: "Invoice OCR Audit & Order Item Matching",
      subtitle: "Verify fulfilled items extracted via OCR against customer call requests and ensure verified consent for any substitute",
      badge: "Optical OCR Verification",
      dropzoneTitle: "Drag & drop receipt or invoice image here",
      dropzoneDesc: "or click anywhere to browse and choose an image from your device",
      pasteHint: "You can also press Ctrl+V to paste directly from clipboard",
      openModal: "Open Full Audit & Item Matching Window",
      uploadNewReceipt: "Upload Another Receipt to Audit",
      noTranscriptWarning: "Notice: No call transcription available yet. Please upload call audio first to match invoice items with customer voice requests.",
      ocrSuccess: "Receipt items extracted successfully",
      itemsCount: "Total Items",
      matchedCount: "Matched Items",
      substitutesCount: "Consented Substitutes",
    },
    qaReports: {
      title: "Analyzed Calls Log",
      subtitle: "Record of analyzed calls by colleague name with a concise summary of consultation, hold, and complaints",
      badge: "Official Call Registry",
      searchPlaceholder: "Search by colleague name...",
      filterAll: "All Calls",
      filterConsultation: "With Consultation",
      filterHold: "With Hold",
      filterComplaint: "With Complaint",
      colleagueName: "Colleague Name",
      consultationTitle: "Medical Consultation",
      holdTitle: "Hold & Wait Music",
      complaintTitle: "Customer Complaint",
      toneTitle: "Agent Voice Tone",
      scoreTitle: "QA Score",
      viewCallBtn: "View Full Analysis & Transcript",
      exportExcelBtn: "Export Excel Report (.xlsx)",
      emptyTitle: "No Matching Calls in Registry",
      emptyDesc: "Upload and analyze an audio call in the 'Dashboard' tab to automatically record it under the colleague's name.",
      backHome: "Back to Dashboard",
    },
    footer: {
      desc: "Precision transcription for Egyptian Arabic, inductive hold & silence analytics, and automated receipt item matching.",
      copyright: "QA Auditor Tool",
    },
  },
};
