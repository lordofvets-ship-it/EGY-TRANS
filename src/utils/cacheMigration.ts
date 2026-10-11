import { stripPhantomBenchmark } from "./qaIntegrity";

const GENERIC_AGENT = /^(?:د\.\s*)?(?:الزميل[ةه]?|موظف(?:ة)?\s+خدمة\s+العملاء|غير\s+محدد|لم\s+يذكر)$/;

export interface MigrationOutcome {
  changed: boolean;
  notes: string[];
  result: any;
}

/**
 * Cleans an analysis saved by an older version:
 *  - drops the phantom `isBenchmark` / `benchmarkNotes` the model copied from the prompt example
 *  - drops the Zod-invented `totalScore` (never computed, never used)
 *  - blanks placeholder agent names so the builder looks for the spoken name instead
 * `analysisVersion` is intentionally left unset so a re-upload of the same audio is re-analysed.
 */
export function migrateCachedResult(input: any): MigrationOutcome {
  const result = { ...input };
  const notes: string[] = [];
  if (result.isBenchmark !== undefined || result.benchmarkNotes !== undefined) {
    stripPhantomBenchmark(result, !result.audioHash);
    notes.push("removed phantom isBenchmark/benchmarkNotes");
  }
  if (result.totalScore !== undefined) {
    delete result.totalScore;
    notes.push("removed invented totalScore");
  }
  if (typeof result.agentName === "string" && GENERIC_AGENT.test(result.agentName.trim()) && !result.userEditedAgentName) {
    result.agentName = "";
    notes.push("blanked placeholder agentName");
  }
  return { changed: notes.length > 0, notes, result };
}
