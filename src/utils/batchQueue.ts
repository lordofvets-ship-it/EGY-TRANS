export type BatchStatus = "queued" | "analyzing" | "done" | "failed" | "cancelled";

export interface BatchItem<R = any> {
  id: string;
  file: File;
  name: string;
  size: number;
  status: BatchStatus;
  error?: string;
  result?: R;
  cached?: boolean;
  startedAt?: number;
  finishedAt?: number;
}

export const itemKey = (f: { name: string; size: number; lastModified?: number }) => `${f.name}|${f.size}|${f.lastModified || 0}`;

/** Adds files, skipping ones that are already queued (same name + size + modified time). */
export function addFiles(existing: BatchItem[], files: File[]): { items: BatchItem[]; skipped: number } {
  const seen = new Set(existing.map((i) => itemKey(i.file)));
  const items = [...existing];
  let skipped = 0;
  for (const f of files) {
    const k = itemKey(f);
    if (seen.has(k)) { skipped++; continue; }
    seen.add(k);
    items.push({ id: `${k}#${items.length}`, file: f, name: f.name, size: f.size, status: "queued" });
  }
  return { items, skipped };
}

export interface RunOptions<R> {
  concurrency: number;
  run: (item: BatchItem<R>, signal: AbortSignal) => Promise<{ result: R; cached?: boolean }>;
  onUpdate: (item: BatchItem<R>) => void;
  signal: AbortSignal;
}

/** Processes `queued` items with a bounded number of workers; stops picking new work when aborted. */
export async function runBatch<R>(items: BatchItem<R>[], opt: RunOptions<R>): Promise<void> {
  const pending = items.filter((i) => i.status === "queued");
  let next = 0;
  const worker = async () => {
    while (!opt.signal.aborted) {
      const item = pending[next++];
      if (!item) return;
      item.status = "analyzing"; item.startedAt = Date.now(); item.error = undefined;
      opt.onUpdate({ ...item });
      try {
        const out = await opt.run(item, opt.signal);
        item.status = "done"; item.result = out.result; item.cached = Boolean(out.cached);
      } catch (e: any) {
        if (e?.name === "AbortError" || opt.signal.aborted) { item.status = "cancelled"; }
        else { item.status = "failed"; item.error = String(e?.message || e); }
      }
      item.finishedAt = Date.now();
      opt.onUpdate({ ...item });
    }
  };
  const n = Math.max(1, Math.min(opt.concurrency, 4, pending.length || 1));
  await Promise.all(Array.from({ length: n }, worker));
  for (const item of pending) {
    if (item.status === "queued") { item.status = "cancelled"; opt.onUpdate({ ...item }); }
  }
}

export function summarize(items: BatchItem[], scoreOf: (r: any) => number | undefined) {
  const count = (s: BatchStatus) => items.filter((i) => i.status === s).length;
  const scores = items.filter((i) => i.status === "done").map((i) => scoreOf(i.result)).filter((x): x is number => Number.isFinite(x as number));
  return {
    total: items.length,
    queued: count("queued"), analyzing: count("analyzing"), done: count("done"), failed: count("failed"), cancelled: count("cancelled"),
    cached: items.filter((i) => i.status === "done" && i.cached).length,
    avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : undefined,
    finished: count("done") + count("failed") + count("cancelled"),
  };
}
