import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { validateMemoryInput, applyAuthoritativeBudget } from "../src/utils/memoryGovernance";

const archive = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "hindsight_archive_removed.json"), "utf-8"));
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "hindsight_memory_bank.json"), "utf-8"));
const find = (id: string) => archive.find((m: any) => m.id === id);

describe("governance rejects the memories that polluted the real bank", () => {
  it("developer changelog (mem-dir-014)", () => expect(validateMemoryInput(find("mem-dir-014")).ok).toBe(false));
  it("UI instruction (mem-dir-004)", () => expect(validateMemoryInput(find("mem-dir-004")).ok).toBe(false));
  it("call-specific critical rule (mem-dir-015)", () => expect(validateMemoryInput(find("mem-dir-015")).ok).toBe(false));
  it("accepts the same fact as a non-critical experience", () => {
    expect(validateMemoryInput({ ...find("mem-dir-015"), category: "experiences", importance: "medium" }).ok).toBe(true);
  });
});

describe("governance accepts legitimate QA rules", () => {
  it("every memory in the cleaned bank passes", () => {
    for (const m of bank) { const r = validateMemoryInput(m); expect(r.ok, `${m.id}: ${r.reasons.join(" | ")}`).toBe(true); }
  });
  it("rejects empty and oversized input", () => {
    expect(validateMemoryInput({ title: "", content: "" }).ok).toBe(false);
    expect(validateMemoryInput({ title: "t", content: "x".repeat(1600), category: "world_facts" }).ok).toBe(false);
  });
});

describe("cleaned memory bank", () => {
  it("no longer contains developer/UI/call-specific critical directives", () => {
    const injected = bank.filter((m: any) => m.category === "mental_models" || m.importance === "critical");
    for (const id of ["mem-dir-004", "mem-dir-011", "mem-dir-014", "mem-dir-015"]) expect(injected.find((m: any) => m.id === id)).toBeUndefined();
    expect(JSON.stringify(injected)).not.toMatch(/result\.transcript|App\.tsx|ffprobe/);
  });
  it("keeps the always-injected set under the prompt budget", () => {
    const injected = bank.filter((m: any) => m.category === "mental_models" || m.importance === "critical");
    const { dropped } = applyAuthoritativeBudget(injected);
    expect(dropped).toHaveLength(0);
  });
});

describe("prompt budget", () => {
  it("drops the least important/oldest directives first", () => {
    const mk = (id: string, imp: string, d: string) => ({ id, title: id, content: "x".repeat(100), importance: imp, createdAt: d });
    const { kept, dropped } = applyAuthoritativeBudget([mk("old-high", "high", "2026-01-01"), mk("crit", "critical", "2026-02-01"), mk("new-high", "high", "2026-03-01")], 230);
    expect(kept.map((k) => k.id)).toEqual(["crit", "new-high"]);
    expect(dropped.map((k) => k.id)).toEqual(["old-high"]);
  });
});
