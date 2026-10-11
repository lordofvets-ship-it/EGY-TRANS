import fs from "fs";
import path from "path";

export const GOLDEN_DIR = path.join(__dirname, "golden");
export const loadGolden = (): any[] =>
  fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, f), "utf-8")));
