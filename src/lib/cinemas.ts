import { createContext, createStealthContext, randomDelay } from "@/lib/scrapers/browser";
import type { CityInfo, CinemaSelection } from "@/types";
import { buildCinemaSelectionId, sanitizeCinemaSelections } from "@/lib/preferences";

const CACHE_TTL_MS = 1000 * 60 * 30;
const CINEMA_FETCH_TIMEOUT_MS = 20000;

type CacheEntry = {
  expiresAt: number;
  value: {
    cinemas: CinemaSelection[];
    errors: string[];
  };
};

const cinemaCache = new Map<string, CacheEntry>();

function getCacheKey(city: CityInfo): string {
  return `${city.name}:${city.bmsSlug}:${city.districtSlug}`;
}

function dedupeSelections(selections: CinemaSelection[]): CinemaSelection[] {
  return sanitizeCinemaSelections(selections).sort((a, b) => {
    if (a.platform === b.platform) {
      return a.name.localeCompare(b.name);
    }

    return a.platform.localeCompare(b.platform);
  });
}

async function warmPageForExtraction(
  page: import("playwright").Page
): Promise<void> {
  await page.evaluate(async () => {
    for (let index = 0; index < 4; index += 1) {
      window.scrollBy(0, window.innerHeight);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    window.scrollTo(0, 0);
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchBookMyShowCinemas(city: CityInfo): Promise<CinemaSelection[]> {
  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    const url = `https://in.bookmyshow.com/${city.bmsSlug}/cinemas`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(700, 1200);

    const title = await page.title();
    if (title.includes("Cloudflare") || title.includes("Attention")) {
      throw new Error("BookMyShow blocked the cinema directory page");
    }

    const {
      names,
      searchTerms: discoveredSearchTerms,
    } = await page.evaluate((citySlug: string) => {
      const results: string[] = [];
      const seen = new Set<string>();
      const searchTerms: string[] = [];
      const searchSeen = new Set<string>();
      const chainUrls: string[] = [];
      const chainUrlSeen = new Set<string>();
      const promoPattern =
        /(offers?|discounts?|enjoy|unwind|experience|luxury|favourite|favorite|movies in|cinema halls|top cinemas|top theatres|book tickets|customer care|showtimes?)/i;
      const navPattern =
        /^(movies|stream|events|plays|sports|activities|listyourshow|corporates|gift cards|search for|sign in|hyderabad|cinema in hyderabad)$/i;
      const addressPattern =
        /(road|rd\b|floor|mall|opposite|near|colony|plot|survey|village|telangana|india|hyderabad|nagar|layout|phase|street|no\.|x roads?|junction|main road|cross roads?|station|temple)/i;
      const looksLikeAddress = (value: string) =>
        value.length >= 15 &&
        value.length <= 220 &&
        /,/.test(value) &&
        addressPattern.test(value);
      const looksLikeVenue = (value: string) =>
        value.length >= 4 &&
        value.length <= 120 &&
        !looksLikeAddress(value) &&
        !promoPattern.test(value) &&
        !navPattern.test(value);

      const pushName = (value: string | null | undefined) => {
        const cleaned = value?.replace(/\s+/g, " ").trim() || "";

        if (
          !cleaned ||
          cleaned.length < 4 ||
          cleaned.length > 120 ||
          /^(cinemas?|filters?|location|book tickets)$/i.test(cleaned) ||
          /^.+\bcinemas? in [a-z\s]+$/i.test(cleaned) ||
          promoPattern.test(cleaned) ||
          navPattern.test(cleaned)
        ) {
          return;
        }

        const key = cleaned.toLowerCase();
        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        results.push(cleaned);
      };

      const pushSearchTerm = (value: string | null | undefined) => {
        const cleaned = value?.replace(/\s+/g, " ").trim() || "";
        const normalized = cleaned
          .replace(/cinemas?/gi, "")
          .replace(/pvt\. ltd\.?/gi, "")
          .replace(/limited/gi, "")
          .trim();

        if (
          !normalized ||
          normalized.length < 3 ||
          normalized.length > 40 ||
          /^(justickets|all regions|corporates|offers|gift cards)$/i.test(normalized)
        ) {
          return;
        }

        const key = normalized.toLowerCase();
        if (searchSeen.has(key)) {
          return;
        }

        searchSeen.add(key);
        searchTerms.push(normalized);
      };

      const fullText = document.body.innerText || "";
      const cutoffCandidates = [
        fullText.indexOf("Cinema Halls in"),
        fullText.indexOf("Top Cinemas in"),
        fullText.indexOf("Enjoy Your Favourite Movies"),
      ].filter((value) => value > 0);
      const cutoff =
        cutoffCandidates.length > 0
          ? Math.min(...cutoffCandidates)
          : fullText.length;
      const prelude = fullText.slice(0, cutoff);
      const lines = prelude
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      for (let index = 0; index < lines.length; index += 1) {
        const current = lines[index];
        const next = lines[index + 1] || "";

        if (looksLikeVenue(current) && next && looksLikeAddress(next)) {
          pushName(current);
        }
      }

      document.querySelectorAll('a[href*="/cinemas/"]').forEach((anchor) => {
        const text = anchor.textContent?.split("\n")[0] || "";
        pushName(text);
      });

      document.querySelectorAll('a[href*="/cinemas-list/"]').forEach((anchor) => {
        const href = (anchor as HTMLAnchorElement).href || "";
        if (href.includes(`/${citySlug}/`) && !chainUrlSeen.has(href)) {
          chainUrlSeen.add(href);
          chainUrls.push(href);
          pushSearchTerm(anchor.textContent);
        }
      });

      return { names: results, searchTerms, chainUrls };
    }, city.bmsSlug);

    const collectedNames = [...names];

    if (collectedNames.length < 60) {
      const searchInput = page
        .locator('input[placeholder*="Search"], input[aria-label*="Search"]')
        .first();

      if (await searchInput.count()) {
        const extractSearchNames = async () =>
          page.evaluate(() => {
            const results: string[] = [];
            const seen = new Set<string>();
            const lines = (document.body.innerText || "")
              .split("\n")
              .map((line) => line.replace(/\s+/g, " ").trim())
              .filter(Boolean);
            const homeIndex = lines.findIndex((line) =>
              /^home$/i.test(line)
            );
            const windowedLines =
              homeIndex > 0 ? lines.slice(0, homeIndex) : lines.slice(0, 120);

            const looksLikeAddress = (value: string) =>
              value.length >= 15 &&
              value.length <= 220 &&
              /,/.test(value) &&
              /(hyderabad|telangana|india|road|rd\b|mall|floor|opposite|near|colony|phase|junction|station|layout)/i.test(
                value
              );

            const looksLikeVenue = (value: string) =>
              value.length >= 5 &&
              value.length <= 120 &&
              !looksLikeAddress(value) &&
              !/^(search for|hyderabad|sign in|movies|stream|events|plays|sports|activities|listyourshow|corporates|offers|gift cards|cinema in hyderabad)$/i.test(
                value
              );

            for (let index = 0; index < windowedLines.length; index += 1) {
              const current = windowedLines[index];
              const next = windowedLines[index + 1] || "";

              if (looksLikeVenue(current) && looksLikeAddress(next)) {
                const key = current.toLowerCase();
                if (!seen.has(key)) {
                  seen.add(key);
                  results.push(current);
                }
              }
            }

            return results;
          });

        const refinedTerms = [
          ...new Set(discoveredSearchTerms.map((term) => term.toLowerCase())),
        ];

        if (collectedNames.length < 60) {
          for (const term of refinedTerms) {
            await searchInput.fill(term);
            await page.waitForTimeout(1200);
            const searchNames = await extractSearchNames();
            collectedNames.push(...searchNames);
          }

          for (const term of "abcdefghijklmnopqrstuvwxyz".split("")) {
            await searchInput.fill(term);
            await page.waitForTimeout(150);
            const searchNames = await extractSearchNames();
            collectedNames.push(...searchNames);
          }
        }

        await searchInput.fill("");
      }
    }

    return dedupeSelections(
      collectedNames.map((name) => ({
        id: buildCinemaSelectionId("bookmyshow", name),
        platform: "bookmyshow",
        name,
        sourceUrl: url,
      }))
    );
  } finally {
    await context.close();
  }
}

async function fetchDistrictCinemas(city: CityInfo): Promise<CinemaSelection[]> {
  const context = await createContext();

  try {
    const page = await context.newPage();
    const url = `https://www.district.in/movies/cinemas-in-${city.districtSlug}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(900, 1800);
    await warmPageForExtraction(page);

    const names = await page.evaluate(() => {
      const results: string[] = [];
      const seen = new Set<string>();
      const noisePattern =
        /(cancellation available|instant refund|mobile ticket|food and beverages|m-ticket|parking|subtitles? language|top cinemas|movie theatres)/i;

      const pushName = (value: string | null | undefined) => {
        const cleaned = value?.replace(/\s+/g, " ").trim() || "";
        if (!cleaned) {
          return;
        }

        if (/^\d+(\.\d+)?\s*km away/i.test(cleaned)) {
          return;
        }

        const name = cleaned
          .replace(/\d+(\.\d+)?\s*km away.*$/i, "")
          .replace(/(Cancellation Available|Instant Refund|Mobile Ticket).*/i, "")
          .trim();

        if (
          !name ||
          name.length < 4 ||
          name.length > 120 ||
          noisePattern.test(name)
        ) {
          return;
        }

        const key = name.toLowerCase();
        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        results.push(name);
      };

      const lines = (document.body.innerText || "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      lines.forEach((line) => {
        if (/km away/i.test(line)) {
          pushName(line);
        }
      });

      document.querySelectorAll("a").forEach((anchor) => {
        const text = anchor.textContent?.replace(/\s+/g, " ").trim() || "";
        if (
          /km away/i.test(text) ||
          /Cancellation Available|Instant Refund|Mobile Ticket/i.test(text)
        ) {
          pushName(text);
        }
      });

      return results;
    });

    return dedupeSelections(
      names.map((name) => ({
        id: buildCinemaSelectionId("district", name),
        platform: "district",
        name,
        sourceUrl: url,
      }))
    );
  } finally {
    await context.close();
  }
}

export async function fetchCityCinemas(city: CityInfo): Promise<{
  cinemas: CinemaSelection[];
  errors: string[];
}> {
  const cacheKey = getCacheKey(city);
  const cached = cinemaCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const errors: string[] = [];
  const selections: CinemaSelection[] = [];

  const [bmsResult, districtResult] = await Promise.allSettled([
    withTimeout(
      fetchBookMyShowCinemas(city),
      CINEMA_FETCH_TIMEOUT_MS,
      "BookMyShow cinema fetch"
    ),
    withTimeout(
      fetchDistrictCinemas(city),
      CINEMA_FETCH_TIMEOUT_MS,
      "District cinema fetch"
    ),
  ]);

  if (bmsResult.status === "fulfilled") {
    selections.push(...bmsResult.value);
  } else {
    errors.push(
      bmsResult.reason instanceof Error
        ? bmsResult.reason.message
        : String(bmsResult.reason)
    );
  }

  if (districtResult.status === "fulfilled") {
    selections.push(...districtResult.value);
  } else {
    errors.push(
      districtResult.reason instanceof Error
        ? districtResult.reason.message
        : String(districtResult.reason)
    );
  }

  const value = {
    cinemas: dedupeSelections(selections),
    errors,
  };

  cinemaCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });

  return value;
}
