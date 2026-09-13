import { spawn } from "node:child_process";
import path from "node:path";
import type { scrapeTracker } from "./tracker-scrape";

type TrackerRow = Parameters<typeof scrapeTracker>[0];
type CheckResult = Awaited<ReturnType<typeof scrapeTracker>>;

export function runTrackerCheck(row: TrackerRow, signal?: AbortSignal): Promise<CheckResult> {
  return runScraperWorker(row, signal);
}

export function runScraperWorker(
  row: TrackerRow,
  signal?: AbortSignal,
  options: { workerPath?: string; timeoutMs?: number } = {},
): Promise<CheckResult> {
  if (signal?.aborted) return Promise.reject(new Error("Check cancelled"));

  return new Promise((resolve, reject) => {
    // Spawn Node explicitly so the bundler does not bundle the worker into Next.
    const worker = spawn(process.execPath, [
      "--max-old-space-size=512",
      options.workerPath ?? path.join(process.cwd(), ".worker/check-worker.cjs"),
    ], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    let result: CheckResult | undefined;
    let failure: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = (message: string) => {
      if (killTimer) return;
      failure = new Error(message);
      worker.kill("SIGTERM");
      killTimer = setTimeout(() => worker.kill("SIGKILL"), 5000);
    };
    const abort = () => stop("Check cancelled");
    const timeoutMs = options.timeoutMs ?? 180_000;
    const deadline = setTimeout(() => stop(`Scraper exceeded ${timeoutMs}ms deadline`), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();

    worker.on("message", (message: { result?: CheckResult; error?: string }) => {
      if (message.error) failure = new Error(message.error);
      else result = message.result;
    });
    worker.on("error", (error) => { failure = error; });
    worker.on("close", (code) => {
      clearTimeout(deadline);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0 || !result) reject(new Error(`Scraper worker exited with code ${code}`));
      else resolve(result);
    });
    worker.send(row, (error) => { if (error) stop(error.message); });
  });
}
