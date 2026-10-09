import * as XLSX from "xlsx";
import { TranscriptionResponse, MeasurementItemId } from "../types";

/**
 * Downloads a Blob as a file in browser
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Exports the entire QA evaluation report into a well-formatted multi-sheet Excel (.xlsx) file.
 */
export function exportEvaluationToExcel(
  result: TranscriptionResponse,
  customFilename?: string,
  isMeasurementVisible?: (id: MeasurementItemId) => boolean
): void {
  try {
    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = customFilename || `QA_Evaluation_Report_${dateStr}.xlsx`;

    // -------------------------------------------------------------
    // SHEET 1: ملخص التقييم العام (Executive QA Summary)
    // -------------------------------------------------------------
    const headerRows: (string | number)[][] = [
      ["تقرير تقييم جودة المكالمة الصيدلانية (QA Call Evaluation Report)"],
      ["تاريخ التقرير:", new Date().toLocaleString("ar-EG")],
      ["نوع المكالمة:", result.isBenchmark ? "مكالمة معيارية مرجعية (Benchmark)" : "مكالمة اعتيادية"],
      ["محرك التفريغ الصوتي:", result._engineInfo?.engineName || "QwenCleo-ASR + Whisper"],
      [""],
      ["معيار التقييم (KPI)", "النتيجة / الحالة", "التقييم الفني والملاحظات", "الدرجة / الإحصائية"]
    ];

    const allKpiRows: { id?: MeasurementItemId; row: (string | number)[] }[] = [
      {
        id: "greeting",
        row: [
          "1. الترحيب بالمقدمة (Greeting)",
          result.greetingAnalysis?.isGreetingUsed ? "مستوفى (تم الترحيب)" : "غير مستوفى",
          result.greetingAnalysis?.evaluation || "-",
          `بداية تحدث الزميل: ${result.greetingAnalysis?.agentStartSecond || "-"} | العبارات: ${result.greetingAnalysis?.detectedGreetingPhrases?.join(", ") || "-"}`
        ]
      },
      {
        id: "agentTone",
        row: [
          "2. نبرة الصوت والابتسامة (Tone & Smile)",
          result.agentToneAnalysis?.hasSmile ? "نبرة بشوشة وبها ابتسامة" : "ينقصها الابتسامة / جافة",
          result.agentToneAnalysis?.smileEvaluation || "-",
          `التقييم: ${result.agentToneAnalysis?.score ?? "-"} / 10`
        ]
      },
      {
        id: "customerName",
        row: [
          "3. ذكر اسم العميل (Customer Name)",
          result.customerNameAnalysis?.isMentionedByAgent ? "تم ذكر الاسم باحترافية" : "لم يُذكر الاسم",
          result.customerNameAnalysis?.customerNameDetected ? `اسم العميل: ${result.customerNameAnalysis.customerNameDetected}` : "لم يتم التعرف على اسم",
          `عدد المرات: ${result.customerNameAnalysis?.mentionCount || 0}`
        ]
      },
      {
        id: "customerTitle",
        row: [
          "4. استخدام اللقب المهني (Customer Title)",
          result.customerTitleAnalysis?.isTitleUsedByAgent ? "تم استخدام اللقب" : "لم يُستخدم لقب",
          result.customerTitleAnalysis?.evaluation || "-",
          result.customerTitleAnalysis?.titleDetected || "غير محدد"
        ]
      },
      {
        id: "empathy",
        row: [
          "5. التعاطف والدعم النفسي (Empathy)",
          result.empathyAnalysis?.isEmpathyUsed ? "مستوفى (تم التعاطف)" : "لم يتم التعاطف",
          result.empathyAnalysis?.evaluation || "-",
          result.empathyAnalysis?.detectedEmpathyPhrases?.join(", ") || "-"
        ]
      },
      {
        id: "furtherAssistance",
        row: [
          "6. تقديم المساعدة الإضافية (Further Assistance)",
          result.furtherAssistanceAnalysis?.isAssistanceOffered ? "مستوفى (تم العرض)" : "لم يتم العرض",
          result.furtherAssistanceAnalysis?.evaluation || "-",
          result.furtherAssistanceAnalysis?.detectedAssistancePhrases?.join(", ") || "-"
        ]
      },
      {
        id: "callEnding",
        row: [
          "7. إنهاء المكالمة والوداع (Call Ending)",
          result.callEndingAnalysis?.isEndingPhraseUsed ? "مستوفى (وداع احترافي)" : "غير مستوفى",
          result.callEndingAnalysis?.evaluation || "-",
          `المتبقي قبل الإنهاء بعد آخر صوت: ${result.callEndingAnalysis?.remainingTimeBeforeEnd || "-"} | العبارات: ${result.callEndingAnalysis?.detectedEndingPhrases?.join(", ") || "-"}`
        ]
      },
      {
        id: "unprofessionalWords",
        row: [
          "8. الألفاظ غير الاحترافية (Unprofessional Words)",
          result.unprofessionalWordsAnalysis?.hasUnprofessionalWords ? "تنبيه: تم رصد ألفاظ غير احترافية" : "نظيف (خالٍ من الألفاظ غير الاحترافية)",
          result.unprofessionalWordsAnalysis?.evaluation || "-",
          result.unprofessionalWordsAnalysis?.detectedWords?.length 
            ? `الكلمات: ${result.unprofessionalWordsAnalysis.detectedWords.map(w => `${w.word} (${w.count})`).join(" - ")}`
            : `العدد: ${result.unprofessionalWordsAnalysis?.totalUnprofessionalWordsCount || 0}`
        ]
      },
      {
        id: "verbalTics",
        row: [
          "9. اللازمات اللفظية وتكرار الأسئلة (Verbal Tics)",
          result.verbalTicsAnalysis?.hasVerbalTics ? "يوجد لازمات متكررة" : "ممتاز (لا توجد لازمات)",
          result.verbalTicsAnalysis?.evaluation || "-",
          `أسئلة مكررة بلا داعي: ${result.verbalTicsAnalysis?.hasUnnecessaryRepeatedQuestions ? "نعم" : "لا"}`
        ]
      },
      {
        id: "silence",
        row: [
          "10. فترات صمت الموظف (Dead Air / Silence)",
          result.agentSilenceSummary ? `إجمالي الصمت: ${result.agentSilenceSummary.totalSilenceSeconds} ثانية` : "-",
          `نسبة الصمت من المكالمة: ${result.agentSilenceSummary?.silenceRatio || 0}%`,
          `عدد الفترات: ${result.agentSilenceSummary?.silenceCount || 0}`
        ]
      },
      {
        id: "holdTime",
        row: [
          "11. معيار الهولد والانتظار (مرتبط بوجود موسيقى)",
          result.holdTimeSummary?.overallClassification || (result.holdTimeSummary?.holdCount ? "يوجد هولد" : "بدون هولد"),
          `${result.holdTimeSummary?.auditNotes || "-"}${result.holdTimeSummary?.isMusicCriterionCompliant !== undefined ? ` | معيار الهولد بوجود موسيقى: ${result.holdTimeSummary?.isMusicCriterionCompliant ? "ملتزم بوجود موسيقى الانتظار ✓" : "غير ملتزم (بدون موسيقى) ✕"}` : ""}`,
          `عدد مرات الهولد: ${result.holdTimeSummary?.holdCount || 0} (${result.holdTimeSummary?.totalHoldSeconds || 0} ثانية)`
        ]
      },
      {
        id: "medicalConsultation",
        row: [
          "12. بروتوكول الاستشارة الطبية (Medical Consultation)",
          result.medicalConsultationAnalysis?.isMedicalConsultationPresent
            ? (result.medicalConsultationAnalysis.allStepsCompleted ? "مستوفى بالكامل (8/8)" : `ناقص (${result.medicalConsultationAnalysis.missingStepsCount} خطوات مفقودة)`)
            : "لا توجد استشارة طبية بالمكالمة",
          result.medicalConsultationAnalysis?.evaluation || "-",
          result.medicalConsultationAnalysis?.consultationTopic || "-"
        ]
      },
      {
        id: "scientificKnowledge",
        row: [
          "13. المعرفة العلمية الدوائية (Medscape Knowledge)",
          result.agentScientificKnowledge?.hasScientificDiscussion ? `الدرجة: ${result.agentScientificKnowledge.overallScientificScore} / 10` : "لا يوجد نقاش دوائي معقد",
          result.agentScientificKnowledge?.medscapeAuditSummary || result.agentScientificKnowledge?.evaluation || "-",
          `الأصناف: ${result.agentScientificKnowledge?.medicationsMentioned?.map((m: any) => typeof m === "string" ? m : (m?.originalDrug || m?.suggestedDrug || m?.name || JSON.stringify(m))).join(", ") || "-"}`
        ]
      },
      {
        id: "complaint",
        row: [
          "14. شكاوى العميل (Customer Complaints)",
          result.customerComplaintAnalysis?.hasComplaint
            ? `يوجد شكوى (${result.customerComplaintAnalysis.complaintsCount}) | اعتذار الشكوى: ${result.customerComplaintAnalysis.complaintApology?.didApologizeForComplaint ? `نعم (${result.customerComplaintAnalysis.complaintApology.apologyTimestamp || "-"})` : "لم يعتذر"} | الهندلة: ${result.customerComplaintAnalysis.handlingScript?.isScriptDelivered ? "تم التبليغ" : "لم يبلغ"}`
            : "لا توجد أي شكاوى",
          result.customerComplaintAnalysis?.summaryText || "لم يشتكِ العميل من أي مشكلة أثناء المكالمة",
          result.customerComplaintAnalysis?.alerts?.map((a: any) => typeof a === "string" ? a : (a?.description || a?.alert || JSON.stringify(a))).join(" | ") || "-"
        ]
      },
      {
        row: [
          "15. تدقيق ريسيت الفاتورة",
          result.receiptAudit
            ? (result.receiptAudit.isFullyCompliant ? "متوافق 100% (بموافقة العميل)" : `نسبة التوفير: ${result.receiptAudit.fulfillmentRatePercentage}%`)
            : "لم يتم رفع ريسيت بعد",
          result.receiptAudit?.auditSummary || "-",
          result.receiptAudit ? `مطلوب: ${result.receiptAudit.totalRequestedItemsCount} | متوفر: ${result.receiptAudit.fulfilledItemsCount} | نواقص: ${result.receiptAudit.missingItemsCount} | مخالفات: ${result.receiptAudit.unapprovedSubstitutesCount}` : "-"
        ]
      }
    ];

    const activeKpiRows = allKpiRows
      .filter((item) => !item.id || !isMeasurementVisible || isMeasurementVisible(item.id))
      .map((item) => item.row);

    const summaryRows = [...headerRows, ...activeKpiRows];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [
      { wch: 32 },
      { wch: 28 },
      { wch: 55 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص التقييم العام");

    // -------------------------------------------------------------
    // SHEET 2: تدقيق فترات الصمت والهولد (Silence & Hold Details)
    // -------------------------------------------------------------
    const silenceAndHoldRows: (string | number)[][] = [
      ["أولاً: تفاصيل فترات صمت الموظف (Dead Air & Silence Segments)"],
      ["م", "وقت البداية", "وقت النهاية", "المدة (بالثواني)", "المتحدث السابق", "المتحدث اللاحق", "التوصيف والسبب التقديري"],
    ];

    const silenceSegments = result.agentSilenceSummary?.silenceSegments || [];
    if (silenceSegments.length > 0) {
      silenceSegments.forEach((seg, idx) => {
        silenceAndHoldRows.push([
          idx + 1,
          seg.timeStart,
          seg.timeEnd,
          seg.duration,
          seg.fromSpeaker || "-",
          seg.toSpeaker || "-",
          seg.description || "-"
        ]);
      });
    } else {
      silenceAndHoldRows.push(["-", "-", "-", "-", "-", "-", "لا توجد فترات صمت ملحوظة"]);
    }

    silenceAndHoldRows.push([""]);
    silenceAndHoldRows.push(["ثانياً: تفاصيل فترات الهولد والانتظار - معيار الهولد مرتبط بوجود موسيقى (Hold Segments Audit)"]);
    silenceAndHoldRows.push([
      "م",
      "وقت البداية",
      "وقت النهاية",
      "المدة (ثانية)",
      "التصنيف (بداعي / بدون)",
      "معيار وجود موسيقى الانتظار",
      "سبب الهولد المذكور",
      "الاستئذان بالانتظار",
      "موافقة العميل الصريحة",
      "الشكر بعد العودة",
      "تجاوز المدة (90 ثانية)",
      "التقييم الفني والتنبيهات"
    ]);

    const holdSegments = result.holdTimeSummary?.holdSegments || [];
    if (holdSegments.length > 0) {
      holdSegments.forEach((h, idx) => {
        silenceAndHoldRows.push([
          idx + 1,
          h.timeStart,
          h.timeEnd,
          h.duration,
          h.classification || (h.connectedToHoldPhrase ? "بداعي" : "بدون داعي"),
          (h.hasLoudMusic !== false && h.isMusicCompliant !== false) ? "ملتزم بمعيار الهولد (بث موسيقى) ✓" : "غير ملتزم (بدون موسيقى) ✕",
          h.statedReasonSnippet || h.reasonCategory || "لم يذكر سبب",
          h.holdPhraseSnippet ? `نعم: "${h.holdPhraseSnippet}"` : "لا",
          h.customerConsentSnippet ? `وافق: "${h.customerConsentSnippet}"` : (h.didWaitForConsent ? "نعم" : "لم ينتظر الموافقة"),
          h.thankingSnippet ? `شكر: "${h.thankingSnippet}"` : (h.didThankAfterHold ? "نعم" : "لم يشكر"),
          h.isDurationExceeded ? `تجاوز الحد المسموح (${h.duration} ث)` : "ضمن المدة المسموحة",
          (h.alerts && Array.isArray(h.alerts) ? h.alerts.map((a: any) => typeof a === "string" ? a : (a?.description || a?.alert || JSON.stringify(a))).join(" | ") : (h.evaluation || "-"))
        ]);
      });
    } else {
      silenceAndHoldRows.push(["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "لم يخرج الموظف في أي فترة هولد"]);
    }

    const wsSilence = XLSX.utils.aoa_to_sheet(silenceAndHoldRows);
    wsSilence["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 25 },
      { wch: 22 },
      { wch: 24 },
      { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSilence, "فترات الصمت والهولد");

    // -------------------------------------------------------------
    // SHEET 3: البروتوكول الطبي والمعرفة العلمية (Medical & Science)
    // -------------------------------------------------------------
    const medicalRows: (string | number)[][] = [
      ["أولاً: بروتوكول الاستشارة الطبية (8 خطوات إلزامية)"],
      ["موضوع الاستشارة:", result.medicalConsultationAnalysis?.consultationTopic || "لا توجد استشارة"],
      ["الالتزام الإجمالي:", result.medicalConsultationAnalysis?.allStepsCompleted ? "مكتمل بنسبة 100%" : "يوجد خطوات مفقودة"],
      [""],
      ["م", "الخطوة الإلزامية", "السؤال المعياري", "هل سأل الموظف؟", "العبارة المنطوقة بالمكالمة", "التوقيت", "ملاحظات وتنبيهات"]
    ];

    if (result.medicalConsultationAnalysis?.steps?.length) {
      result.medicalConsultationAnalysis.steps.forEach((st, idx) => {
        medicalRows.push([
          idx + 1,
          st.stepTitle,
          st.standardQuestion,
          st.wasAsked ? "نعم ✓" : "لا ✗",
          st.questionSnippet || "-",
          st.timestamp || "-",
          st.notAskedAlert || "مستوفى"
        ]);
      });
    } else {
      medicalRows.push(["-", "لا توجد استشارة طبية مسجلة في هذه المكالمة", "-", "-", "-", "-", "-"]);
    }

    medicalRows.push([""]);
    medicalRows.push(["ثانياً: تدقيق المعرفة العلمية والأصناف الدوائية (Medscape Drug Audit)"]);
    medicalRows.push(["سبب مراجعة Medscape:", result.agentScientificKnowledge?.triggerReasonArabic || (result.agentScientificKnowledge?.hasScientificDiscussion ? "طلب العميل / توفير بديل أو مثيل" : "طلب عادي (لم تتطلب مراجعة Medscape)")]);
    medicalRows.push(["خلاصة التدقيق العلمي:", result.agentScientificKnowledge?.medscapeAuditSummary || "-"]);
    medicalRows.push(["درجة المعرفة العلمية:", `${result.agentScientificKnowledge?.overallScientificScore ?? "-"} / 10`]);
    medicalRows.push([""]);
    medicalRows.push([
      "نوع التدقيق",
      "الصنف الأصلي / الأطراف",
      "الصنف المقترح / المادة الفعالة",
      "العلاقة الصيدلانية",
      "الدقة العلمية",
      "التوثيق المعتمد من Medscape",
      "الملاحظات والتنبيهات"
    ]);

    // Primary: Alternatives & Generic Table (جدول الأصناف المطلوبة من العميل والمعروضة كبديل أو مثيل مع MEDSCAPE)
    if (result.agentScientificKnowledge?.alternativesAndEquivalents?.length) {
      result.agentScientificKnowledge.alternativesAndEquivalents.forEach((alt) => {
        medicalRows.push([
          "جدول بدائل ومثائل MEDSCAPE",
          alt.originalDrug,
          alt.suggestedDrug,
          alt.relationTypeArabic || alt.relationType,
          alt.isScientificallySound ? "سليم علمياً" : "غير سليم",
          alt.medscapeVerification,
          alt.notes || "-"
        ]);
      });
    } else if (result.receiptAudit?.itemsAudit?.length) {
      // Fallback if receipt matches exist
      result.receiptAudit.itemsAudit.forEach((m) => {
        const isSub = m.status === "matched_generic_approved" || m.status === "matched_substitute_approved" || m.status === "matched_substitute_unapproved";
        medicalRows.push([
          "جدول بدائل ومثائل MEDSCAPE",
          m.customerRequestedItem || m.receiptItem || "-",
          isSub ? m.receiptItem : `${m.receiptItem} (نفس الصنف المطلوب)`,
          m.statusArabic || (isSub ? "بديل/مثيل" : "مطابق"),
          m.status !== "matched_substitute_unapproved" ? "سليم علمياً" : "غير مصرح به",
          `تحقق Medscape Drug Reference لـ ${m.receiptItem || m.customerRequestedItem}`,
          m.auditNotes || "-"
        ]);
      });
    }

    // Active ingredients
    if (result.agentScientificKnowledge?.activeIngredientsAudit?.length) {
      result.agentScientificKnowledge.activeIngredientsAudit.forEach((ai) => {
        medicalRows.push([
          "المواد الفعالة والتركيز",
          ai.item,
          ai.activeIngredients,
          "تحليل مادة فعالة",
          ai.isAccurate ? "صحيح ودقيق" : "غير دقيق",
          ai.medscapeReference,
          ai.agentStatement || ai.notes || "-"
        ]);
      });
    }

    // Drug interactions
    if (result.agentScientificKnowledge?.drugInteractionsAudit?.length) {
      result.agentScientificKnowledge.drugInteractionsAudit.forEach((dia) => {
        medicalRows.push([
          "تداخلات وتعارضات دوائية",
          dia.drugsInvolved?.join(" + ") || "-",
          dia.interactionLevelArabic || dia.interactionLevel,
          dia.agentHandlingArabic,
          dia.interactionLevel === "none" ? "آمن" : "يتطلب انتباه",
          dia.medscapeDetails,
          dia.alert || "-"
        ]);
      });
    }

    const wsMedical = XLSX.utils.aoa_to_sheet(medicalRows);
    wsMedical["!cols"] = [
      { wch: 22 },
      { wch: 26 },
      { wch: 30 },
      { wch: 18 },
      { wch: 16 },
      { wch: 45 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMedical, "الاستشارة والمعرفة العلمية");

    // -------------------------------------------------------------
    // SHEET 4: تدقيق ريسيت الفاتورة وموافقة العميل (Receipt & Consent Audit)
    // -------------------------------------------------------------
    const totalAuditObj = result.receiptAudit?.totalAudit;
    const totalStatusText = totalAuditObj
      ? totalAuditObj.wasStatedByAgent === false
        ? "مخالفة: لم يقم الزميل بذكر أو إبلاغ العميل بإجمالي الفاتورة"
        : totalAuditObj.isMatched
        ? `مطابق تماماً (${totalAuditObj.statedTotalByAgent} ج.م)`
        : `غير مطابق (المكالمة: ${totalAuditObj.statedTotalByAgent} ج.م | الريسيت: ${totalAuditObj.receiptTotal} ج.م)`
      : "-";

    const qtyAuditObj = result.receiptAudit?.quantityAudit;
    const orderReviewObj = result.receiptAudit?.orderReviewAudit;

    const receiptRows: (string | number)[][] = [
      ["تقرير مطابقة وتدقيق ريسيت الفاتورة مع طلبات العميل بالمكالمة"],
      ["حالة الأوردر الإجمالية:", result.receiptAudit?.isFullyCompliant ? "متوافق 100% (تم استئذان العميل وتطابق الكميات والإجمالي والمراجعة)" : "يوجد مخالفات أو أصناف ناقصة أو خطأ في الكمية/المراجعة/الإجمالي"],
      ["نسبة توفير الأوردر المعتمد:", `${result.receiptAudit?.fulfillmentRatePercentage ?? 0}%`],
      ["معيار كمية طلب العميل:", qtyAuditObj ? (qtyAuditObj.isAllQuantitiesMatched ? "مطابقة لطلب العميل تماماً" : `يوجد خطأ في كمية ${qtyAuditObj.quantityDiscrepanciesCount} صنف`) : "-"],
      ["معيار مراجعة الزميل للأوردر:", orderReviewObj ? (orderReviewObj.wasReviewedByAgent === false ? "لم يقم الزميل بمراجعة الأوردر" : orderReviewObj.isReviewAccurate ? "مراجعة صحيحة ومطابقة" : "خطأ في مراجعة وتأكيد الأوردر") : "-"],
      ["معيار الإجمالي (Total Audit):", totalStatusText],
      ["إجمالي الفاتورة في الريسيت:", `${result.receiptAudit?.receiptTotal || totalAuditObj?.receiptTotal || "-"} ج.م`],
      ["الإجمالي المبلغ به للعميل بالمكالمة:", totalAuditObj?.wasStatedByAgent === false ? "لم يقم الزميل بذكره (تنبيه جودة)" : `${totalAuditObj?.statedTotalByAgent || "-"} ج.م`],
      ["توثيق ذكر الإجمالي بالمكالمة:", totalAuditObj?.agentStatementSnippet || "-"],
      ["إجمالي الأصناف المطلوبة من العميل:", result.receiptAudit?.customerItemsCount ?? result.receiptAudit?.totalRequestedItemsCount ?? 0],
      ["الأصناف بالريسيت:", result.receiptAudit?.receiptItemsCount ?? result.receiptAudit?.fulfilledItemsCount ?? 0],
      ["الأصناف المتوفرة:", result.receiptAudit?.fulfilledItemsCount ?? 0],
      ["الأصناف الناقصة:", result.receiptAudit?.missingItemsCount ?? 0],
      ["البدائل/المثائل بموافقة العميل:", result.receiptAudit?.approvedSubstitutesCount ?? 0],
      ["مخالفات بدائل بدون موافقة:", result.receiptAudit?.unapprovedSubstitutesCount ?? 0],
      ["خلاصة التدقيق:", result.receiptAudit?.auditSummary || "لم يتم إجراء تدقيق ريسيت لهذه المكالمة"],
      [""],
      [
        "م",
        "الصنف المطلوب من العميل",
        "كمية طلب العميل",
        "الصنف المقابل في الفاتورة",
        "كمية الفاتورة",
        "تطابق الكمية",
        "حالة التوفير",
        "هل وافق العميل في المكالمة؟",
        "نص وتوقيت موافقة العميل (Snippet)",
        "العلاقة الدوائية (مثيل / بديل)",
        "السعر الإجمالي",
        "ملاحظات التدقيق والتنبيهات"
      ]
    ];

    if (result.receiptAudit?.itemsAudit?.length) {
      result.receiptAudit.itemsAudit.forEach((item, idx) => {
        const qtyMatchText = item.isQuantityMatched === false || item.quantityDiscrepancyAlert
          ? "غير متطابق (تنبيه خطأ كمية)"
          : (item.isQuantityMatched === true ? "مطابق" : "-");

        const noteWithAlerts = [
          item.quantityDiscrepancyAlert,
          item.orderReviewAlert,
          item.auditNotes
        ].filter(Boolean).join(" | ");

        receiptRows.push([
          idx + 1,
          item.customerRequestedItem,
          item.customerRequestedQuantity || "-",
          item.receiptItem || "(غير متوفر بالفاتورة)",
          item.receiptQuantity || "-",
          qtyMatchText,
          item.statusArabic,
          item.hasCustomerConsent ? "نعم (بموافقة صريحة)" : (item.status === "matched_exact" ? "صنف أصلي مطابق" : "لا (بدون موافقة - مخالفة)"),
          item.consentSnippet || "-",
          item.pharmacologicalRelation || "-",
          item.totalPrice ? `${item.totalPrice} ج.م` : "-",
          noteWithAlerts
        ]);
      });
    } else {
      receiptRows.push(["-", "لم يتم تدقيق ريسيت الفاتورة بعد", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
    }

    const wsReceipt = XLSX.utils.aoa_to_sheet(receiptRows);
    wsReceipt["!cols"] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 18 },
      { wch: 28 },
      { wch: 15 },
      { wch: 22 },
      { wch: 25 },
      { wch: 22 },
      { wch: 45 },
      { wch: 24 },
      { wch: 15 },
      { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, wsReceipt, "تدقيق الريسيت وموافقة العميل");

    // -------------------------------------------------------------
    // SHEET 5: تدقيق شكاوى العميل والاعتذار والهندلة (Customer Complaints & Apology Audit)
    // -------------------------------------------------------------
    const complaintRows: (string | number)[][] = [
      ["تقرير تدقيق شكاوى العميل، الاعتذار المخصص، تبليغ الاسكريبت، وفصل الاعتذارات الأخرى"],
      ["حالة الشكوى بالمكالمة:", result.customerComplaintAnalysis?.hasComplaint ? `يوجد شكوى (${result.customerComplaintAnalysis.complaintsCount || 1} شكاوى مرصودة)` : "لا يوجد أي شكاوى"],
      ["ملخص الشكوى العام:", result.customerComplaintAnalysis?.summaryText || "لا يوجد"],
      [""],
      ["أولاً: التحقق من اعتذار الزميل عن شكوى العميل بصفة خاصة (مع ذكر التوقيت)"],
      [
        "حالة الاعتذار عن الشكوى:",
        result.customerComplaintAnalysis?.complaintApology?.didApologizeForComplaint
          ? "نعم، اعتذر الزميل عن الشكوى بصفة خاصة وصريحة"
          : "لم يقم الزميل بالاعتذار بصفة خاصة عن الشكوى (مخالفة جودة)"
      ],
      ["توقيت الاعتذار عن الشكوى:", result.customerComplaintAnalysis?.complaintApology?.apologyTimestamp || "-"],
      ["نص اعتذار الزميل عن الشكوى:", result.customerComplaintAnalysis?.complaintApology?.apologySnippet || "-"],
      ["تقييم اعتذار الشكوى:", result.customerComplaintAnalysis?.complaintApology?.evaluation || "-"],
      [""],
      ["ثانياً: هندلة الشكوى وتبليغ سكريبت (سيتم تسجيل شكوى لمراجعة الأمر لضمان عدم التكرار)"],
      [
        "حالة تبليغ الاسكريبت:",
        result.customerComplaintAnalysis?.handlingScript?.isScriptDelivered
          ? "تم تبليغ الاسكريبت المعتمد أو ما يفيد معناه"
          : "لم يبلغ الزميل سكريبت تسجيل الشكوى لمنع التكرار (مخالفة)"
      ],
      ["الاسكريبت الإلزامي المعتمد:", "سيتم تسجيل شكوى لمراجعة الأمر لضمان عدم التكرار (أو فيما معناه)"],
      ["توقيت تبليغ الاسكريبت:", result.customerComplaintAnalysis?.handlingScript?.scriptTimestamp || "-"],
      ["نص كلام الزميل الفعلي في التبليغ:", result.customerComplaintAnalysis?.handlingScript?.scriptSnippet || "-"],
      ["مطابقة عبارة (ضمان عدم التكرار):", result.customerComplaintAnalysis?.handlingScript?.isStandardPhraseUsed ? "مطابق لصيغة ضمان عدم التكرار" : "أفاد المعنى العام"],
      ["تقييم هندلة الشكوى:", result.customerComplaintAnalysis?.handlingScript?.evaluation || "-"],
      [""],
      ["ثالثاً: تفاصيل الشكاوى المرصودة من كلام العميل"],
      ["م", "تصنيف الشكوى", "توقيت الشكوى", "نص كلام العميل الملتقط", "توضيح سياق الشكوى"]
    ];

    if (result.customerComplaintAnalysis?.detectedComplaints?.length) {
      result.customerComplaintAnalysis.detectedComplaints.forEach((comp, idx) => {
        complaintRows.push([
          idx + 1,
          comp.categoryArabic || comp.category,
          comp.timestamp || "-",
          comp.complaintSnippet,
          comp.explanation
        ]);
      });
    } else {
      complaintRows.push(["-", "لا يوجد", "-", "لم يُرصد أي شكوى في كلام العميل", "المكالمة خالية من الشكاوى"]);
    }

    complaintRows.push([""]);
    complaintRows.push(["رابعاً: بند مستقل - أي اعتذارات أخرى للزميل في المكالمة (مفصولة بوقتها وسببها)"]);
    complaintRows.push(["م", "سبب الاعتذار الآخر", "نص الاعتذار المنطوق", "توقيت الاعتذار"]);

    if (result.customerComplaintAnalysis?.otherApologies?.length) {
      result.customerComplaintAnalysis.otherApologies.forEach((other, idx) => {
        complaintRows.push([
          idx + 1,
          other.reason,
          other.apologySnippet,
          other.timestamp
        ]);
      });
    } else {
      complaintRows.push(["-", "لا توجد اعتذارات أخرى", "-", "-"]);
    }

    const wsComplaint = XLSX.utils.aoa_to_sheet(complaintRows);
    wsComplaint["!cols"] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 18 },
      { wch: 45 },
      { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, wsComplaint, "شكاوى العميل والاعتذارات");

    // -------------------------------------------------------------
    // SHEET 6: تفريغ المكالمة الكامل (Full Transcript)
    // -------------------------------------------------------------
    const transcriptRows: (string | number)[][] = [
      ["تفريغ نص المكالمة الصوتية بالكامل (Full Call Transcript)"],
      ["م", "المتحدث", "وقت البداية", "وقت النهاية", "المدة (ثانية)", "النص المنطوق بالعامية المصرية"]
    ];

    if (result.transcript?.length) {
      result.transcript.forEach((t, idx) => {
        transcriptRows.push([
          idx + 1,
          t.speaker,
          t.timeStart,
          t.timeEnd,
          t.duration,
          t.text
        ]);
      });
    }

    const wsTranscript = XLSX.utils.aoa_to_sheet(transcriptRows);
    wsTranscript["!cols"] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 90 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTranscript, "تفريغ المكالمة بالكامل");

    // Generate buffer & trigger download
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    triggerDownload(blob, filename);

  } catch (err) {
    console.error("Failed to export Excel report:", err);
    throw err;
  }
}
