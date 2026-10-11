import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { loadGolden } from "./helpers";
import { migrateCachedResult } from "../src/utils/cacheMigration";
import { BatchUploadPanel } from "../src/components/BatchUploadPanel";
import App from "../src/App";

const golden = loadGolden().slice(0, 4).map((c) => migrateCachedResult(c).result);
const audio = (name: string, bytes = 100) => new File([new Uint8Array(bytes)], name, { type: "audio/mpeg", lastModified: 1 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const open = () => fireEvent.click(screen.getByRole("button", { name: /رفع دفعي/ }));
const addFiles = (files: File[]) => fireEvent.change(screen.getByTestId("batch-input"), { target: { files } });

describe("BatchUploadPanel", () => {
  it("is collapsed by default and expands on click", () => {
    render(<BatchUploadPanel processingMode="transcription_with_analysis" />);
    expect(screen.queryByTestId("batch-input")).toBeNull();
    open();
    expect(screen.getByTestId("batch-input")).toBeInTheDocument();
  });

  it("ignores non-audio files and skips duplicates", () => {
    render(<BatchUploadPanel processingMode="x" />);
    open();
    addFiles([audio("a.mp3"), new File(["x"], "notes.txt", { type: "text/plain" }), audio("a.mp3")]);
    expect(within(screen.getByTestId("batch-list")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("batch-skipped")).toHaveTextContent("1");
  });

  it("analyses files sequentially, shows score/agent/cache tag, a progress summary, and refreshes the registry", async () => {
    const calls: string[] = [];
    const transcribe = vi.fn(async (file: File, _opts?: any) => { calls.push(file.name); await sleep(10); return { ...golden[calls.length - 1], cacheHit: file.name === "b.mp3" }; });
    const refresh = vi.fn();
    window.addEventListener("qa-calls-changed", refresh);
    render(<BatchUploadPanel processingMode="transcription_with_analysis" transcribe={transcribe as any} />);
    open();
    addFiles([audio("a.mp3"), audio("b.mp3"), audio("c.mp3")]);
    fireEvent.click(screen.getByRole("button", { name: /بدء التحليل/ }));
    await waitFor(() => expect(screen.getByTestId("batch-summary")).toHaveTextContent("اكتمل 3 من 3"));
    expect(calls).toEqual(["a.mp3", "b.mp3", "c.mp3"]);
    expect(transcribe.mock.calls[0][1]).toMatchObject({ processingMode: "transcription_with_analysis" });
    expect(screen.getByTestId("batch-summary")).toHaveTextContent("⚡ 1");
    expect(screen.getByTestId("batch-summary")).toHaveTextContent("متوسط الجودة");
    expect(screen.getByTestId("batch-status-b.mp3")).toHaveTextContent("تم");
    expect(within(screen.getByTestId("batch-list")).getAllByText(/من الكاش/)).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(refresh).toHaveBeenCalledTimes(3);
    window.removeEventListener("qa-calls-changed", refresh);
  });

  it("shows failures with the server message and retries only the failed ones", async () => {
    let failB = true;
    const transcribe = vi.fn(async (file: File) => { if (file.name === "b.mp3" && failB) throw new Error("حصة Gemini منتهية"); return golden[0]; });
    render(<BatchUploadPanel processingMode="x" transcribe={transcribe as any} />);
    open();
    addFiles([audio("a.mp3"), audio("b.mp3")]);
    fireEvent.click(screen.getByRole("button", { name: /بدء التحليل/ }));
    await waitFor(() => expect(screen.getByTestId("batch-status-b.mp3")).toHaveTextContent("فشل"));
    expect(screen.getByText("حصة Gemini منتهية")).toBeInTheDocument();
    expect(screen.getByTestId("batch-status-a.mp3")).toHaveTextContent("تم");
    failB = false;
    fireEvent.click(screen.getByRole("button", { name: /إعادة محاولة الفاشلة/ }));
    await waitFor(() => expect(screen.getByTestId("batch-status-b.mp3")).toHaveTextContent("تم"));
    expect(transcribe.mock.calls.map((c) => (c[0] as File).name)).toEqual(["a.mp3", "b.mp3", "b.mp3"]); // a.mp3 was NOT re-run
  });

  it("stop prevents new calls from starting", async () => {
    const transcribe = vi.fn(async (file: File) => { await sleep(40); return golden[0]; });
    render(<BatchUploadPanel processingMode="x" transcribe={transcribe as any} />);
    open();
    addFiles([audio("a.mp3"), audio("b.mp3"), audio("c.mp3")]);
    fireEvent.click(screen.getByRole("button", { name: /بدء التحليل/ }));
    await waitFor(() => expect(screen.getByTestId("batch-status-a.mp3")).toHaveTextContent("قيد التحليل"));
    fireEvent.click(screen.getByRole("button", { name: /إيقاف/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /بدء التحليل/ })).toBeDisabled());
    await waitFor(() => expect(screen.getByTestId("batch-status-c.mp3")).toHaveTextContent("أُلغي"));
    expect(transcribe).toHaveBeenCalledTimes(1);
  });

  it("clear removes finished items only", async () => {
    const transcribe = vi.fn(async () => golden[0]);
    render(<BatchUploadPanel processingMode="x" transcribe={transcribe as any} />);
    open();
    addFiles([audio("a.mp3")]);
    fireEvent.click(screen.getByRole("button", { name: /بدء التحليل/ }));
    await waitFor(() => expect(screen.getByTestId("batch-status-a.mp3")).toHaveTextContent("تم"));
    fireEvent.click(screen.getByRole("button", { name: /مسح المنتهي/ }));
    expect(screen.queryByTestId("batch-list")).toBeNull();
  });

  it("supports English", () => {
    render(<BatchUploadPanel processingMode="x" language="en" />);
    expect(screen.getByRole("button", { name: /Batch upload/ })).toBeInTheDocument();
  });
});

describe("batch panel inside the App", () => {
  const json = (o: any) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => vi.unstubAllGlobals());

  it("shows on the transcription tab and a finished batch call triggers a registry refresh", async () => {
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (String(url).includes("/api/transcribe")) return json({ ...golden[0], cacheHit: true });
      if (String(url).includes("/api/analyzed-calls")) return json({ calls: [] });
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(document.getElementById("sidebar-tab-transcription")!);
    const toggle = await screen.findByRole("button", { name: /رفع دفعي/ });
    fireEvent.click(toggle);
    const before = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/analyzed-calls")).length;
    fireEvent.change(screen.getByTestId("batch-input"), { target: { files: [audio("x.mp3")] } });
    fireEvent.click(screen.getByRole("button", { name: /بدء التحليل/ }));
    await waitFor(() => expect(screen.getByTestId("batch-status-x.mp3")).toHaveTextContent("تم"), { timeout: 5000 });
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/analyzed-calls")).length).toBeGreaterThan(before));
    const sent = JSON.parse(fetchMock.mock.calls.find((c) => String(c[0]).includes("/api/transcribe"))![1].body);
    expect(sent).toMatchObject({ fileName: "x.mp3", mimeType: "audio/mpeg" });
  });
});
