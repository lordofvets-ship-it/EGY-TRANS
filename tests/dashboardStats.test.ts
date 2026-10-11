import { describe, it, expect } from "vitest";
import { loadGolden } from "./helpers";
import { buildAnalyzedCallRecord } from "../src/utils/callRecordBuilder";
import { migrateCachedResult } from "../src/utils/cacheMigration";
import { computeDashboardStats, buildCoachingPlan, computeRoi, DEFAULT_ROI, durationToSeconds, CRITERIA } from "../src/utils/dashboardStats";

const records = loadGolden().map((c) => buildAnalyzedCallRecord(migrateCachedResult(c).result));

describe("dashboard statistics on the real calls", () => {
  const s = computeDashboardStats(records);
  it("counts all calls", () => expect(s.totalCalls).toBe(17));
  it("average and pass rate are consistent with the records", () => {
    const avg = records.reduce((a, r) => a + r.overallScore, 0) / records.length;
    expect(Math.abs(s.avgScore - avg)).toBeLessThan(0.1);
    expect(s.passRate).toBe(Math.round((records.filter((r) => r.overallScore >= 80).length / 17) * 100));
    expect(s.belowThreshold).toBe(records.filter((r) => r.overallScore < 80).length);
  });
  it("criteria are sorted by failure rate and bounded", () => {
    for (let i = 1; i < s.criteria.length; i++) expect(s.criteria[i - 1].failRate).toBeGreaterThanOrEqual(s.criteria[i].failRate);
    for (const c of s.criteria) { expect(c.failed).toBeLessThanOrEqual(c.applicable); expect(c.failRate).toBeLessThanOrEqual(100); }
  });
  it("the unprofessional-words rate reflects the data (12 of 17)", () => {
    const u = s.criteria.find((c) => c.key === "unprofessionalWords")!;
    expect(u.failed).toBe(12);
    expect(u.applicable).toBe(17);
  });
  it("agents are sorted by average score and aggregate all calls", () => {
    for (let i = 1; i < s.agents.length; i++) expect(s.agents[i - 1].avgScore).toBeGreaterThanOrEqual(s.agents[i].avgScore);
    expect(s.agents.reduce((a, x) => a + x.calls, 0)).toBe(17);
  });
  it("days aggregate all calls", () => expect(s.byDay.reduce((a, d) => a + d.calls, 0)).toBe(17));
  it("handles an empty list without crashing", () => {
    const e = computeDashboardStats([]);
    expect(e.totalCalls).toBe(0);
    expect(e.criteria).toHaveLength(CRITERIA.length);
  });
});

describe("coaching plan", () => {
  it("returns at most 3 items, each with evidence-bearing structure", () => {
    const s = computeDashboardStats(records);
    const worst = s.agents[s.agents.length - 1].agent;
    const plan = buildCoachingPlan(records, worst);
    expect(plan.length).toBeLessThanOrEqual(3);
    for (const p of plan) { expect(p.failedCalls).toBeGreaterThan(0); expect(p.failedCalls).toBeLessThanOrEqual(p.ofCalls); expect(p.tipAr.length).toBeGreaterThan(10); }
  });
  it("is empty for an unknown agent", () => expect(buildCoachingPlan(records, "لا أحد")).toEqual([]));
});

describe("ROI calculator", () => {
  it("matches the hand-computed default scenario", () => {
    const r = computeRoi(DEFAULT_ROI);
    expect(r.manualMinutesPerCall).toBe(13);
    expect(r.analystsFor100).toBe(5);
    expect(r.manualCost100).toBe(60000);
    expect(r.autoCost).toBe(9000);
    expect(r.savingsVs100).toBe(51000);
    expect(r.coverageGain).toBe(98);
  });
  it("never divides by zero", () => expect(Number.isFinite(computeRoi({ ...DEFAULT_ROI, analystHours: 0 }).manualCost100)).toBe(true));
});

describe("duration parsing", () => {
  it.each([["07:03", 423], ["1:02:03", 3723], ["", 0], [undefined, 0]])("%s → %s", (d, n) => expect(durationToSeconds(d as any)).toBe(n));
});
