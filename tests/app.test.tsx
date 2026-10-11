import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { loadGolden } from "./helpers";
import { buildAnalyzedCallRecord } from "../src/utils/callRecordBuilder";
import { migrateCachedResult } from "../src/utils/cacheMigration";
import App from "../src/App";

const withAudio = (c: any) => ({ ...c, hasAudioFile: true });
const golden = loadGolden().slice(0, 4).map((c) => withAudio(migrateCachedResult(c).result));
const records = golden.map((c) => buildAnalyzedCallRecord(c));

const json = (o: any) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: any) => {
    if (url.includes("/api/analyzed-calls") && (!init || !init.method || init.method === "GET")) return json({ calls: records });
    if (url.includes("/api/analyzed-calls")) return json({ success: true, calls: records });
    if (url.includes("/api/engine-status")) return json({ qwenCleo: { available: false }, whisper: { available: false }, wav2vec2: { available: false } });
    if (url.includes("/api/hindsight/memories")) return json({ memories: [], stats: { totalMemories: 0, byCategory: {}, byImportance: {} } });
    if (url.includes("/api/hindsight/stats")) return json({ totalMemories: 0, byCategory: {}, byImportance: {} });
    return json({});
  }));
});
afterEach(() => vi.unstubAllGlobals());

const clickTab = (id: string) => fireEvent.click(document.getElementById(`sidebar-tab-${id}`)!);

describe("App end-to-end (jsdom, real analysed calls)", () => {
  it("boots and shows the sidebar with the new tabs", async () => {
    render(<App />);
    await waitFor(() => expect(document.getElementById("sidebar-tab-analytics")).not.toBeNull());
    expect(document.getElementById("sidebar-tab-memory")).not.toBeNull();
  });

  it("analytics tab renders the real data", async () => {
    render(<App />);
    clickTab("analytics");
    expect(await screen.findByTestId("analytics-root")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("kpi-المكالمات المحللة")).toHaveTextContent("4"));
  });

  it("memory tab mounts the Hindsight manager (previously unreachable)", async () => {
    render(<App />);
    clickTab("memory");
    await waitFor(() => expect(screen.queryByTestId("analytics-root")).toBeNull());
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).includes("/api/hindsight"))).toBe(true));
  });

  it("opening a saved call → the 'customize criteria' button now opens the modal (original bug)", async () => {
    render(<App />);
    clickTab("reports");
    const viewButtons = await screen.findAllByRole("button", { name: /عرض التفريغ/ });
    fireEvent.click(viewButtons[0]);
    const openBtn = await screen.findByRole("button", { name: /تخصيص وإخفاء البنود/ }, { timeout: 5000 });
    expect(screen.queryByRole("dialog", { name: /تخصيص وإخفاء بنود التقييم/ })).toBeNull();
    fireEvent.click(openBtn);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("تخصيص وإخفاء بنود التقييم");
    // toggling a criterion hides it for real and persists the setting
    const sw = within(dialog).getAllByRole("switch")[0];
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    await waitFor(() => expect(within(screen.getByRole("dialog")).getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "false"));
    expect(JSON.parse(localStorage.getItem("qa_measurement_settings_v2")!).some((s: any) => s.visible === false)).toBe(true);
  });

  it("a saved call with a stored recording gets a synced player; clicking a timestamp seeks the audio", async () => {
    render(<App />);
    clickTab("reports");
    fireEvent.click((await screen.findAllByRole("button", { name: /عرض التفريغ/ }))[0]);
    const player = await screen.findByTestId("synced-player", undefined, { timeout: 5000 });
    const audio = player.querySelector("audio")!;
    expect(audio.getAttribute("src")).toMatch(/^\/api\/audio\/[a-f0-9]{64}\?token=/);
    const chips = screen.getAllByTitle("تشغيل من هنا");
    expect(chips.length).toBeGreaterThan(5);
    const target = chips[3];
    const start = target.textContent!.split("←")[0].trim();
    fireEvent.click(target);
    const [m, s] = start.split(":").map(Number);
    expect(audio.currentTime).toBe(m * 60 + s);
  });

  it("a call WITHOUT a stored recording has no player and inert timestamps", async () => {
    const noAudio = golden.map((c) => ({ ...c, hasAudioFile: false }));
    const recs = noAudio.map((c) => buildAnalyzedCallRecord(c));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: any) => (String(url).includes("/api/analyzed-calls") ? json({ calls: recs }) : json({}))));
    render(<App />);
    clickTab("reports");
    fireEvent.click((await screen.findAllByRole("button", { name: /عرض التفريغ/ }))[0]);
    await screen.findByRole("button", { name: /تخصيص وإخفاء البنود/ }, { timeout: 5000 });
    expect(screen.queryByTestId("synced-player")).toBeNull();
    expect(screen.queryAllByTitle("تشغيل من هنا")).toHaveLength(0);
  });
});
