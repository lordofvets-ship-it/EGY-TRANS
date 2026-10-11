import { describe, it, expect } from "vitest";
import { loadGolden } from "./helpers";
import { detectGenuineIllnessConsultation, symptomGroupsIn, consultationTopicFor, symptomTurnsOf, normalizeArabic } from "../src/utils/medicalConsultation";

const turn = (speaker: string, text: string) => ({ speaker, text, timeStart: "00:00", timeEnd: "00:05" });
const C = "العميل", A = "موظف خدمة العملاء";

describe("symptom-driven consultation detection", () => {
  it("detects a consultation where symptoms are described (the previously missed pattern)", () => {
    expect(detectGenuineIllnessConsultation([turn(C, "ابني كان سخن وبعدها بدأ يكح وعنده بلغم")])).toBe(true);
  });
  it("does not treat a plain product order as a consultation", () => {
    expect(detectGenuineIllnessConsultation([turn(C, "عايزة بنادول اكسترا وكلاسيد اكس ال"), turn(A, "تمام حاضر")])).toBe(false);
  });
  it("a single symptom needs the agent to run protocol questions", () => {
    const one = [turn(C, "عندي صداع")];
    expect(detectGenuineIllnessConsultation(one)).toBe(false);
    expect(detectGenuineIllnessConsultation([...one, turn(A, "العمر كام؟"), turn(A, "في أي أعراض تانية؟")])).toBe(true);
  });
  it("ignores symptom words said only by the agent", () => {
    expect(detectGenuineIllnessConsultation([turn(A, "ده بيعالج الكحة والسخونية")])).toBe(false);
  });
  it("normalises Arabic spelling variants", () => {
    expect(normalizeArabic("سُخونِيّة")).toBe(normalizeArabic("سخونية"));
    expect(symptomGroupsIn("كحه وسخونيه")).toEqual(expect.arrayContaining(["cough", "fever"]));
  });
  it("builds a topic from the real symptoms instead of a hard-coded string", () => {
    const t = [turn(C, "عنده سخونة وإسهال")];
    expect(consultationTopicFor(t)).toContain("سخونة");
    expect(consultationTopicFor(t)).toContain("أعراض هضمية");
    expect(consultationTopicFor(t)).not.toContain("نزلة البرد");
  });
  it("returns evidence turns", () => expect(symptomTurnsOf([turn(C, "عايز حاجة"), turn(C, "عنده كحة")])).toHaveLength(1));
});

describe("on the 17 real calls", () => {
  const calls = loadGolden();
  it("finds exactly the one genuine consultation (child with fever/cough/vomiting) and no false positives", () => {
    const hits = calls.filter((c) => detectGenuineIllnessConsultation(c.transcript));
    expect(hits).toHaveLength(1);
    expect(hits[0].callSummary).toContain("منى");
  });
});
