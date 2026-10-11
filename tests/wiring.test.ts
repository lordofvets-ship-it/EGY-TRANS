/**
 * Static "never again" checks. Each one encodes a defect that really shipped in the original code.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf-8");
const app = read("src/App.tsx");
const server = read("server.ts");

describe("App.tsx wiring (dead-modal / orphan-component detector)", () => {
  const imported = [...app.matchAll(/import\s+\{([^}]+)\}\s+from\s+"\.\/components\/[^"]+"/g)]
    .flatMap((m) => m[1].split(",").map((x) => x.trim()).filter((x) => /^[A-Z][A-Za-z]*[a-z][A-Za-z]*$/.test(x))); // PascalCase components only (skip ALL_CAPS constants)

  it("finds the component imports", () => expect(imported.length).toBeGreaterThan(8));

  it.each(imported)("component %s that is imported is actually rendered", (name) => {
    expect(app, `<${name} is imported but never rendered`).toMatch(new RegExp(`<${name}[\\s/>]`));
  });

  it("every open-state flag that a button can set is wired to a rendered modal", () => {
    const flags = [...app.matchAll(/const \[(is\w+Open), set\w+\] = useState/g)].map((m) => m[1]);
    expect(flags.length).toBeGreaterThan(3);
    for (const f of flags) expect(app, `${f} is never passed to a component`).toMatch(new RegExp(`isOpen=\\{${f}\\}`));
  });

  it("every sidebar tab has a render branch", () => {
    const nav = read("src/components/NavigationTabBar.tsx");
    const block = nav.slice(nav.indexOf("APP_NAVIGATION_TABS"), nav.indexOf("interface NavigationTabBarProps"));
    const ids = [...block.matchAll(/\{ id: "(\w+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(expect.arrayContaining(["analytics", "memory", "reports", "settings"]));
    for (const id of ids) expect(app, `no render branch for tab ${id}`).toMatch(new RegExp(`activeTab === "${id}"`));
  });

  it("every tab id has an Arabic and an English label", () => {
    const tr = read("src/utils/translations.ts");
    for (const id of ["analytics", "memory", "reports"]) expect([...tr.matchAll(new RegExp(`\\b${id}: "`, "g"))].length).toBeGreaterThanOrEqual(2);
  });

  it("no unused component imports remain", () => expect(app).not.toMatch(/NewTabPlaceholder/));
});

describe("prompt template", () => {
  it("never contains example values the model could copy into real results", () => {
    expect(server).not.toMatch(/"isBenchmark":\s*true/);
    expect(server).not.toContain("ملاحظات المعايرة القياسية للمكالمة المرجعية");
  });
});

describe("pipeline trace honesty", () => {
  it("server derives the trace from facts instead of literals", () => {
    expect(server).toContain("buildPipelineStages(");
    expect(server).not.toMatch(/status:\s*"completed"/);
  });
  it("UI no longer asserts that all stages passed", () => {
    const modal = read("src/components/PipelineTraceModal.tsx");
    expect(modal).not.toContain("جميع المراحل استوفت");
    expect(modal).not.toContain("DEFAULT_STAGES");
  });
});

describe("claims in the UI match what runs", () => {
  it("no Whisper/Qwen/Silero promises in metadata or loading text", () => {
    expect(read("index.html")).not.toMatch(/Qwen|Whisper|Silero/);
    expect(app).not.toMatch(/initializing high-sensitivity QwenCleo/);
    expect(read("src/utils/exportToExcel.ts")).not.toContain('"QwenCleo-ASR + Whisper"');
  });
  it("Excel sheet count in the texts equals the number of sheets exported", () => {
    const sheets = (read("src/utils/exportToExcel.ts").match(/book_append_sheet\(/g) || []).length;
    const ar = { 5: "5 أوراق", 6: "6 أوراق", 7: "7 أوراق" } as Record<number, string>;
    const texts = [app, read("src/components/ExcelExportModal.tsx"), read("src/utils/translations.ts")].join("\n");
    expect(texts).toContain(ar[sheets]);
    for (const n of [5, 6, 7].filter((n) => n !== sheets)) expect(texts).not.toContain(ar[n]);
  });
  it("the invoice tab does not advertise unsupported PDF input", () => {
    expect(read("src/components/InvoiceAuditTabView.tsx")).not.toMatch(/WEBP\s*•\s*PDF/);
  });
  it("the benchmark view never fabricates a score", () => expect(read("src/components/BenchmarkTabView.tsx")).not.toMatch(/\|\|\s*86/));
});

describe("security wiring", () => {
  it("destructive and admin endpoints require the admin role", () => {
    for (const route of [
      'app.delete("/api/analyzed-calls/:id"', 'app.delete("/api/analyzed-calls"', 'app.post("/api/hindsight/reset"',
      'app.delete("/api/hindsight/memories/:id"', 'app.post("/api/hindsight/retain"', 'app.get("/api/download-backup"',
    ]) expect(server, route).toMatch(new RegExp(route.replace(/[()/.]/g, "\\$&") + ",\\s*requireAdmin"));
  });
  it("the auth middleware is installed before the routes", () => {
    expect(server.indexOf("app.use(authMiddleware)")).toBeGreaterThan(0);
    expect(server.indexOf("app.use(authMiddleware)")).toBeLessThan(server.indexOf('app.post("/api/transcribe"'));
  });
  it("no hard-coded backup file name remains", () => expect(server).not.toMatch(/Backup_\d{4}-\d{2}-\d{2}\.zip/));
});

describe("cache versioning", () => {
  it("cached analyses with another version are re-analysed", () => {
    expect(server).toContain("isStaleAnalysisVersion");
    expect(server).toContain("analysisVersion = ANALYSIS_VERSION");
  });
});

describe("music/hold detection uses the shared classifier", () => {
  it("no hand-written 'duration >= 12 && confidence' music rules remain in the server", () => {
    expect(server).not.toMatch(/>=\s*12\s*&&\s*(?:Number\(\w+\.confidence|vConf)/);
    expect((server.match(/isMusicBlock\(/g) || []).length).toBeGreaterThanOrEqual(8);
  });
  it("the Gemini prompt names the engine that actually ran", () => {
    expect(server).not.toContain("(Silero-VAD Acoustic Pre-Scan)");
    expect(server).toContain("${sileroVadResult.engine} Acoustic Pre-Scan");
  });
});

describe("batch upload wiring", () => {
  it("the panel is rendered in App and the App listens for registry-changed events", () => {
    expect(app).toMatch(/<BatchUploadPanel[\s/>]/);
    expect(app).toContain('addEventListener("qa-calls-changed"');
    expect(app).toContain('removeEventListener("qa-calls-changed"');
  });
  it("the panel announces every finished call", () => {
    expect(read("src/components/BatchUploadPanel.tsx")).toContain('new Event("qa-calls-changed")');
  });
});
