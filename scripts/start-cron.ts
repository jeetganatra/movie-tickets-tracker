import { readFileSync } from "fs";
import { resolve } from "path";
import cron from "node-cron";

// Load .env.local since this runs as a standalone process (not through Next.js)
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log("[Cron] Loaded .env.local");
} catch {
  console.log("[Cron] No .env.local found, using environment variables");
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "";
const parsedInterval = Number(process.env.CHECK_INTERVAL_MINUTES || "5");
const parsedRequestTimeoutMs = Number(
  process.env.CRON_REQUEST_TIMEOUT_MS || "240000"
);
const INTERVAL =
  Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 5;
const REQUEST_TIMEOUT_MS =
  Number.isFinite(parsedRequestTimeoutMs) && parsedRequestTimeoutMs > 0
    ? parsedRequestTimeoutMs
    : 240000;
let isRunning = false;

console.log(`[Cron] Starting scheduler - checking every ${INTERVAL} minutes`);
console.log(`[Cron] App URL: ${APP_URL}`);
console.log(`[Cron] Secret configured: ${CRON_SECRET ? "yes" : "no"}`);
console.log(`[Cron] Request timeout: ${REQUEST_TIMEOUT_MS}ms`);

// Run every N minutes
cron.schedule(`*/${INTERVAL} * * * *`, async () => {
  const timestamp = new Date().toISOString();

  if (isRunning) {
    console.warn(`[Cron] ${timestamp} - Previous check still running; skipping this tick`);
    return;
  }

  isRunning = true;
  console.log(`[Cron] ${timestamp} - Running ticket check...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${APP_URL}/api/cron`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[Cron] API returned ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`[Cron] ${timestamp} - ${data.message}`);

    if (data.results) {
      for (const r of data.results) {
        if (r.found) {
          console.log(`[Cron] TICKETS FOUND for "${r.movieName}"!`);
        } else if (r.error) {
          console.log(`[Cron] Error for "${r.movieName}": ${r.error}`);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(
        `[Cron] ${timestamp} - API call timed out after ${REQUEST_TIMEOUT_MS}ms`
      );
    } else {
      console.error(`[Cron] Failed to call API:`, error);
    }
  } finally {
    clearTimeout(timeout);
    isRunning = false;
  }
});

console.log("[Cron] Scheduler started. Waiting for next tick...");
