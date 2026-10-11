import { describe, it, expect } from "vitest";
import { loadGolden } from "./helpers";
import { validateAndSanitizeQAResult } from "../src/utils/pydanticValidator";
import { buildAnalyzedCallRecord } from "../src/utils/callRecordBuilder";
import { migrateCachedResult } from "../src/utils/cacheMigration";

const calls = loadGolden();

describe("golden set: 17 real analysed calls", () => {
  it("loads 17 calls with transcripts", () => {
    expect(calls).toHaveLength(17);
    for (const c of calls) expect(c.transcript.length).toBeGreaterThan(5);
  });

  it("schema validation: at most one legacy record needs coercion", () => {
    const invalid = calls.filter((c) => !validateAndSanitizeQAResult(c).isValid);
    expect(invalid.length).toBeLessThanOrEqual(1);
  });

  it("schema no longer invents scores for missing fields", () => {
    const out = validateAndSanitizeQAResult({ transcript: [] }).sanitizedData;
    expect(out.totalScore).toBeUndefined();
    expect(out.confidenceScore).toBeUndefined();
    expect(out.agentName).toBe("");
    expect(out.agentScientificKnowledge.overallScientificScore).toBeUndefined();
  });

  it("scientific score is normalised to the 0-10 scale", () => {
    const f = (v: number) => validateAndSanitizeQAResult({ agentScientificKnowledge: { overallScientificScore: v } }).sanitizedData.agentScientificKnowledge.overallScientificScore;
    expect(f(8)).toBe(8);
    expect(f(85)).toBe(8.5);
    expect(f(-3)).toBe(0);
  });

  it("every record builds a score in 0..100", () => {
    for (const c of calls) {
      const r = buildAnalyzedCallRecord(c);
      expect(r.overallScore).toBeGreaterThanOrEqual(0);
      expect(r.overallScore).toBeLessThanOrEqual(100);
    }
  });

  it("scoring formula is stable (regression guard): average stays in the verified band", () => {
    const scores = calls.map((c) => buildAnalyzedCallRecord(c).overallScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(avg).toBeGreaterThan(75);
    expect(avg).toBeLessThan(88);
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(55);
  });

  it("the phantom benchmark flag existed in the old data and the migration removes it", () => {
    const flagged = calls.filter((c) => c.isBenchmark);
    expect(flagged.length).toBe(7);
    for (const c of calls) {
      const out = migrateCachedResult(c);
      expect(out.result.isBenchmark).toBeUndefined();
      expect(out.result.benchmarkNotes).toBeUndefined();
      expect(out.result.totalScore).toBeUndefined();
    }
  });

  it("migration is idempotent and keeps the analysis intact", () => {
    for (const c of calls) {
      const once = migrateCachedResult(c).result;
      const twice = migrateCachedResult(once);
      expect(twice.changed).toBe(false);
      expect(once.transcript).toEqual(c.transcript);
      expect(once.audioHash).toBe(c.audioHash);
    }
  });

  it("flagged calls no longer render as benchmark in records", () => {
    for (const c of calls.filter((x) => x.isBenchmark)) {
      const rec = buildAnalyzedCallRecord(migrateCachedResult(c).result);
      expect(rec.agentName).not.toMatch(/المعيارية المعتمدة/);
    }
  });

  it("placeholder agent names are never shown as 'د. الزميل'", () => {
    for (const c of calls) {
      const rec = buildAnalyzedCallRecord(migrateCachedResult(c).result);
      expect(rec.agentName).not.toMatch(/^د\.\s*(الزميل|موظف)/);
    }
  });
});
