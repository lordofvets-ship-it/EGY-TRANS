import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { loadGolden } from "./helpers";
import { buildAnalyzedCallRecord } from "../src/utils/callRecordBuilder";
import { migrateCachedResult } from "../src/utils/cacheMigration";
import { buildPipelineStages } from "../src/utils/qaIntegrity";
import { DEFAULT_MEASUREMENT_SETTINGS } from "../src/types";
import { CriteriaVisibilityModal } from "../src/components/CriteriaVisibilityModal";
import { PipelineTraceModal } from "../src/components/PipelineTraceModal";
import { AnalyticsTabView } from "../src/components/AnalyticsTabView";
import { LoginGate } from "../src/components/LoginGate";
import { NavigationTabBar } from "../src/components/NavigationTabBar";

const golden = loadGolden().map((c) => migrateCachedResult(c).result);
const records = golden.map((c) => buildAnalyzedCallRecord(c));

describe("CriteriaVisibilityModal", () => {
  it("renders every criterion and reports toggles", () => {
    const onToggle = vi.fn();
    render(<CriteriaVisibilityModal isOpen onClose={() => {}} settings={DEFAULT_MEASUREMENT_SETTINGS} onToggle={onToggle} onShowAll={() => {}} onHideAll={() => {}} language="ar" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(DEFAULT_MEASUREMENT_SETTINGS.length);
    fireEvent.click(switches[0]);
    expect(onToggle).toHaveBeenCalledWith(DEFAULT_MEASUREMENT_SETTINGS[0].id);
  });
  it("renders nothing when closed", () => {
    render(<CriteriaVisibilityModal isOpen={false} onClose={() => {}} settings={DEFAULT_MEASUREMENT_SETTINGS} onToggle={() => {}} onShowAll={() => {}} onHideAll={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PipelineTraceModal honesty", () => {
  const base: any = { transcript: [], audioHash: "a".repeat(64) };
  const facts: any = { bufferBytes: 1000, mime: "audio/mp3", vad: { engine: "Energy+ZCR VAD", speechRatio: 0.6 }, whisperUsed: false, qwenUsed: false, emotionUsed: true, geminiModel: "2.5-flash", processingMode: "transcription_with_analysis", reviewMeta: { reviewCount: 1, skippedReason: "مدة المكالمة طويلة" }, validationValid: true, audioHash: "a".repeat(64), saved: true };

  it("shows skipped stages as skipped, never as 'completed successfully'", () => {
    render(<PipelineTraceModal isOpen onClose={() => {}} result={{ ...base, pipelineStages: buildPipelineStages(facts) }} />);
    expect(screen.getByTestId("stage-status-12")).toHaveTextContent("تم تخطّيها");
    expect(screen.getByTestId("stage-status-13")).toHaveTextContent("تم تخطّيها");
    expect(screen.getByTestId("stage-status-1")).toHaveTextContent("مكتمل");
    expect(screen.getByTestId("trace-summary")).toHaveTextContent("2 تم تخطّيها");
    expect(screen.queryByText(/جميع المراحل استوفت/)).toBeNull();
    expect(screen.queryByText(/مكتمل بنجاح/)).toBeNull();
  });
  it("shows failures", () => {
    render(<PipelineTraceModal isOpen onClose={() => {}} result={{ ...base, pipelineStages: buildPipelineStages({ ...facts, vad: null }) }} />);
    expect(screen.getByTestId("stage-status-4")).toHaveTextContent("فشلت");
  });
  it("shows a notice (not invented stages) for legacy results without a trace", () => {
    render(<PipelineTraceModal isOpen onClose={() => {}} result={base} />);
    expect(screen.getByTestId("trace-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("stage-status-1")).toBeNull();
  });
});

describe("AnalyticsTabView", () => {
  it("shows an empty state with a call to action", () => {
    const go = vi.fn();
    render(<AnalyticsTabView calls={[]} onBackToHome={() => {}} onGoToTranscription={go} />);
    expect(screen.getByTestId("analytics-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تفريغ مكالمة الآن/ }));
    expect(go).toHaveBeenCalled();
  });
  it("renders KPIs, leaderboard and criteria from the real calls", () => {
    render(<AnalyticsTabView calls={records} onBackToHome={() => {}} onGoToTranscription={() => {}} />);
    expect(screen.getByTestId("analytics-root")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-المكالمات المحللة")).toHaveTextContent("17");
    expect(within(screen.getByTestId("leaderboard")).getAllByRole("button").length).toBeGreaterThan(1);
    expect(within(screen.getByTestId("criteria-list")).getAllByRole("listitem").length).toBeGreaterThan(3);
  });
  it("switches the coaching plan when another agent is picked", () => {
    render(<AnalyticsTabView calls={records} onBackToHome={() => {}} onGoToTranscription={() => {}} />);
    const buttons = within(screen.getByTestId("leaderboard")).getAllByRole("button");
    const last = buttons[buttons.length - 1];
    fireEvent.click(last);
    expect(screen.getByTestId("coaching")).toHaveTextContent(last.textContent!.split(".")[1].trim().split(/\s{2,}|\d+ مكالمة/)[0].trim().slice(0, 3));
  });
  it("recomputes the ROI when inputs change", () => {
    render(<AnalyticsTabView calls={records} onBackToHome={() => {}} onGoToTranscription={() => {}} />);
    expect(screen.getByTestId("roi-savings")).toHaveTextContent("51,000");
    const input = within(screen.getByTestId("roi")).getAllByRole("spinbutton")[0];
    fireEvent.change(input, { target: { value: "6000" } });
    expect(screen.getByTestId("roi-savings")).toHaveTextContent("102,000");
  });
  it("supports English", () => {
    render(<AnalyticsTabView calls={records} language="en" onBackToHome={() => {}} onGoToTranscription={() => {}} />);
    expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
  });
});

describe("LoginGate", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it("renders the app directly when auth is not required", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ authRequired: false, authenticated: true }))));
    render(<LoginGate><div>APP-CONTENT</div></LoginGate>);
    expect(await screen.findByText("APP-CONTENT")).toBeInTheDocument();
  });
  it("blocks the app behind a login form, rejects a wrong password and accepts a correct one", async () => {
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (url.includes("/auth/status")) return new Response(JSON.stringify({ authRequired: true, authenticated: false }));
      const pw = JSON.parse(init.body).password;
      return pw === "good" ? new Response(JSON.stringify({ token: "tok", role: "analyst" })) : new Response(JSON.stringify({ error: "كلمة المرور غير صحيحة." }), { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginGate><div>APP-CONTENT</div></LoginGate>);
    const input = await screen.findByLabelText(/كلمة المرور/);
    expect(screen.queryByText("APP-CONTENT")).toBeNull();
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: /دخول/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("غير صحيحة");
    fireEvent.change(input, { target: { value: "good" } });
    fireEvent.click(screen.getByRole("button", { name: /دخول/ }));
    expect(await screen.findByText("APP-CONTENT")).toBeInTheDocument();
    expect(localStorage.getItem("qa_auth_token")).toBe("tok");
    expect(localStorage.getItem("qa_auth_role")).toBe("analyst");
  });
});

describe("NavigationTabBar", () => {
  const props: any = { activeTab: "home", onTabChange: () => {}, onUploadInvoiceClick: () => {}, theme: "light", onThemeChange: () => {}, language: "ar" };
  afterEach(() => localStorage.clear());
  it("lists analytics and memory for admins", () => {
    render(<NavigationTabBar {...props} />);
    expect(document.getElementById("sidebar-tab-analytics")).not.toBeNull();
    expect(document.getElementById("sidebar-tab-memory")).not.toBeNull();
  });
  it("hides the memory tab from analysts", () => {
    localStorage.setItem("qa_auth_role", "analyst");
    render(<NavigationTabBar {...props} />);
    expect(document.getElementById("sidebar-tab-memory")).toBeNull();
    expect(document.getElementById("sidebar-tab-analytics")).not.toBeNull();
  });
  it("falls back to the headphones icon when the logo is missing", () => {
    const { container } = render(<NavigationTabBar {...props} />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.lucide-headphones")).not.toBeNull();
  });
});
