import { scrapeTracker } from "../src/lib/tracker-scrape";
import { closeBrowser } from "../src/lib/scrapers/browser";

let stopping = false;
async function shutdown(code: number) {
  if (stopping) return;
  stopping = true;
  // Playwright's exit hook synchronously kills remaining browser process groups.
  // Slow graceful browser shutdown must not discard a completed scan result.
  const deadline = setTimeout(() => process.exit(code), 4000);
  await closeBrowser();
  clearTimeout(deadline);
  process.exit(code);
}

process.on("SIGTERM", () => void shutdown(1));
process.on("SIGINT", () => void shutdown(1));
process.on("disconnect", () => void shutdown(1));
process.once("message", async (row: Parameters<typeof scrapeTracker>[0]) => {
  try {
    const result = await scrapeTracker(row);
    console.log(`[Worker] Completed ${row.id}; heap=${Math.round(process.memoryUsage().heapUsed / 1048576)}MB`);
    process.send?.({ result }, () => void shutdown(0));
  } catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : String(error) }, () => void shutdown(1));
  }
});
