import { chromium, Browser, BrowserContext } from "playwright";

let browserInstance: Browser | null = null;
let stealthBrowserInstance: Browser | null = null;

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserInstance;
}

/**
 * Get a stealth browser instance using system Chrome.
 * System Chrome bypasses Cloudflare bot detection that blocks
 * Playwright's bundled Chromium. Falls back to bundled Chromium
 * with stealth args if system Chrome is not available.
 */
async function getStealthBrowser(): Promise<Browser> {
  if (!stealthBrowserInstance || !stealthBrowserInstance.isConnected()) {
    try {
      stealthBrowserInstance = await chromium.launch({
        headless: true,
        channel: "chrome",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      console.log("[Browser] Using system Chrome for stealth context");
    } catch {
      // System Chrome not available, fall back to bundled Chromium
      console.log("[Browser] System Chrome not found, using bundled Chromium with stealth args");
      stealthBrowserInstance = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--window-size=1920,1080",
        ],
      });
    }
  }
  return stealthBrowserInstance;
}

export async function createContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
}

/**
 * Creates a browser context using system Chrome with stealth modifications
 * to bypass Cloudflare bot detection used by BookMyShow.
 */
export async function createStealthContext(): Promise<BrowserContext> {
  const browser = await getStealthBrowser();
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    Object.defineProperty(navigator, "languages", {
      get: () => ["en-IN", "en-GB", "en-US", "en"],
    });
  });

  return context;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minMs: number = 2000, maxMs: number = 5000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}
