/**
 * Usage:  npx tsx scripts/migrate-cache.ts [dir]      (default: data/audio_cache)
 * Writes a .bak copy before touching any file. Safe to run more than once.
 */
import fs from "fs";
import path from "path";
import { migrateCachedResult } from "../src/utils/cacheMigration";

const dir = path.resolve(process.argv[2] || path.join("data", "audio_cache"));
if (!fs.existsSync(dir)) { console.error("directory not found:", dir); process.exit(1); }
let changed = 0, total = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  total++;
  const p = path.join(dir, f);
  const out = migrateCachedResult(JSON.parse(fs.readFileSync(p, "utf-8")));
  if (!out.changed) continue;
  fs.copyFileSync(p, p + ".bak");
  fs.writeFileSync(p, JSON.stringify(out.result, null, 2), "utf-8");
  changed++;
  console.log(`✔ ${f.slice(0, 12)}…  ${out.notes.join("; ")}`);
}
console.log(`done: ${changed}/${total} files migrated`);
