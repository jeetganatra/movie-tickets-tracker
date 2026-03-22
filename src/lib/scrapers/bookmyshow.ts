import { createStealthContext, randomDelay } from "./browser";
import type { ShowtimeResult, ShowInfo } from "./types";

const LANGUAGE_FILTER_REGEX =
  /^(English|Hindi|Telugu|Tamil|Malayalam|Kannada|Marathi|Punjabi|Bengali)(\s*-\s*.+)?$/i;
const FORMAT_KEYWORD_REGEX =
  /\b(DOLBY|IMAX|ATMOS|4DX|ICE|MX4D|SCREENX|PCX|3D|2D|LASER)\b/i;

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeShows(shows: ShowInfo[]): ShowInfo[] {
  const seen = new Set<string>();

  return shows.filter((show) => {
    const key = [
      normalizeForMatch(show.theaterName),
      show.showtime.toUpperCase(),
      normalizeForMatch(show.format || ""),
      show.bookingUrl,
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractBookingDateKey(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/\/(20\d{6})(?:[/?#]|$)/);
  return match ? match[1] : null;
}

function filterShowsForRequestedDate(
  shows: ShowInfo[],
  requestedDateKey: string
): ShowInfo[] {
  return shows.filter((show) => {
    const bookingDateKey = extractBookingDateKey(show.bookingUrl);

    if (!bookingDateKey) {
      return true;
    }

    return bookingDateKey === requestedDateKey;
  });
}

function containsPreferredCinema(
  shows: ShowInfo[],
  preferredCinemaNames: string[]
): boolean {
  if (preferredCinemaNames.length === 0) {
    return shows.length > 0;
  }

  const normalizedHints = preferredCinemaNames.map(normalizeForMatch);
  return shows.some((show) =>
    normalizedHints.includes(normalizeForMatch(show.theaterName))
  );
}

function extractShowtimesFromBodyText(
  bodyText: string,
  bookingUrl: string
): ShowInfo[] {
  const lines = bodyText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const stopMarkers = [
    "Unable to find what you are looking for?",
    "HomeMovies in ",
    "List your Show",
  ];

  const isTime = (value: string) => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(value);
  const isFormat = (value: string) =>
    /^(ATMOS|DOLBY|IMAX|4DX|ICE|MX4D|SCREENX|PCX|2D|3D|4K|LASER)/i.test(
      value
    );
  const isNoise = (value: string) =>
    /^(available|fast filling|filling fast|sold out|non-cancellable|price range|special formats|preferred time|sort by|got it|director choice|platinum|gold|silver|recliner|prime)$/i.test(
      value
    ) || /₹\s*\d/.test(value);
  const isTheater = (value: string) =>
    value.length >= 4 &&
    value.length <= 120 &&
    !isTime(value) &&
    !isFormat(value) &&
    !isNoise(value) &&
    /(:|cinema|cinemas|theatre|theater|multiplex)/i.test(value);

  const shows: ShowInfo[] = [];
  let currentTheater = "";

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    if (stopMarkers.some((marker) => current.startsWith(marker))) {
      break;
    }

    if (isTheater(current)) {
      currentTheater = current;
      continue;
    }

    if (currentTheater && isTime(current)) {
      const nextLine = lines[index + 1] || "";
      shows.push({
        theaterName: currentTheater,
        showtime: current,
        format: isFormat(nextLine) ? nextLine : "2D",
        language: "",
        availabilityStatus: "Available",
        bookingUrl,
      });
    }
  }

  return shows;
}

/**
 * Strategy (stealth browser using system Chrome):
 * 1. Navigate to BMS movies listing page for the city
 * 2. Find the movie link (contains ET{eventCode} in href)
 * 3. Navigate to the buytickets page with the date
 * 4. Extract theaters and showtimes from the virtualized grid
 *
 * Uses system Chrome (channel: "chrome") which bypasses Cloudflare
 * bot detection that blocks Playwright's bundled Chromium.
 */
export async function checkBookMyShow(
  movieName: string,
  citySlug: string,
  date: string,
  preferredCinemaNames: string[] = []
): Promise<ShowtimeResult> {
  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    const dateFormatted = date.replace(/-/g, "");
    const normalizedCitySlug = citySlug.toLowerCase();

    console.log(
      `[BMS] Checking for "${movieName}" in ${normalizedCitySlug}, date ${date}`
    );

    // Step 1: Navigate to the movies listing page
    const listingUrl = `https://in.bookmyshow.com/explore/movies-${normalizedCitySlug}`;
    console.log(`[BMS] Loading listing: ${listingUrl}`);

    await page.goto(listingUrl, {
      waitUntil: "load",
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    // Check if blocked by Cloudflare
    const listingTitle = await page.title();
    if (
      listingTitle.includes("Cloudflare") ||
      listingTitle.includes("Attention")
    ) {
      console.log("[BMS] Blocked by Cloudflare on listing page");
      return {
        platform: "bookmyshow",
        found: false,
        shows: [],
        error:
          "Blocked by Cloudflare - system Chrome may not be available",
      };
    }

    // Step 2: Find the movie in the listing
    const movieMatch = await page.evaluate((search: string) => {
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const searchNorm = normalize(search);

      const links = document.querySelectorAll('a[href*="ET00"]');
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || "";
        const textNorm = normalize(text);

        if (
          textNorm.includes(searchNorm) ||
          searchNorm.includes(textNorm)
        ) {
          const eventMatch = href.match(/ET\d{8,}/);
          const slugMatch = href.match(
            /\/movies\/[^/]+\/([^/]+)\/ET/
          );
          if (eventMatch) {
            return {
              eventId: eventMatch[0],
              slug: slugMatch ? slugMatch[1] : "",
              title: text,
            };
          }
        }
      }

      // Broader search: check all movie links by text
      const allMovieLinks = document.querySelectorAll(
        'a[href*="/movies/"]'
      );
      for (const link of allMovieLinks) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || "";
        const textNorm = normalize(text);

        if (
          text.length > 1 &&
          text.length < 100 &&
          (textNorm.includes(searchNorm) ||
            searchNorm.includes(textNorm))
        ) {
          const eventMatch = href.match(/ET\d{8,}/);
          if (eventMatch) {
            const slugMatch = href.match(
              /\/movies\/[^/]+\/([^/]+)\/ET/
            );
            return {
              eventId: eventMatch[0],
              slug: slugMatch ? slugMatch[1] : "",
              title: text,
            };
          }
        }
      }

      return null;
    }, movieName);

    if (!movieMatch) {
      // Try search as fallback
      console.log(
        "[BMS] Movie not found in listing, trying search..."
      );
      const searchResult = await trySearch(page, movieName);
      if (!searchResult) {
        console.log("[BMS] Movie not found");
        return { platform: "bookmyshow", found: false, shows: [] };
      }

      const buySlug =
        searchResult.slug ||
        movieName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const buyUrl = `https://in.bookmyshow.com/buytickets/${buySlug}/movie-${normalizedCitySlug}-${searchResult.eventId}-MT/${dateFormatted}`;
      console.log(`[BMS] Showtimes URL: ${buyUrl}`);

      await page.goto(buyUrl, {
        waitUntil: "load",
        timeout: 30000,
      });
      await randomDelay(3000, 5000);

      return await extractShowtimes(
        page,
        preferredCinemaNames,
        dateFormatted
      );
    }

    console.log(
      `[BMS] Found: "${movieMatch.title}" (${movieMatch.eventId})`
    );

    // Step 3: Navigate to the buytickets page
    const movieSlug =
      movieMatch.slug ||
      movieName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const buyTicketsUrl = `https://in.bookmyshow.com/buytickets/${movieSlug}/movie-${normalizedCitySlug}-${movieMatch.eventId}-MT/${dateFormatted}`;
    console.log(`[BMS] Showtimes URL: ${buyTicketsUrl}`);

    await page.goto(buyTicketsUrl, {
      waitUntil: "load",
      timeout: 30000,
    });
    await randomDelay(3000, 5000);

    // Check if blocked
    const showTitle = await page.title();
    if (
      showTitle.includes("Cloudflare") ||
      showTitle.includes("Attention")
    ) {
      console.log("[BMS] Blocked by Cloudflare on showtimes page");
      return {
        platform: "bookmyshow",
        found: false,
        shows: [],
        error: "Blocked by Cloudflare on showtimes page",
      };
    }

    // Step 4: Extract showtimes
    return await extractShowtimes(
      page,
      preferredCinemaNames,
      dateFormatted
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[BMS] Scraping error: ${errMsg}`);
    return {
      platform: "bookmyshow",
      found: false,
      shows: [],
      error: errMsg,
    };
  } finally {
    await context.close();
  }
}

async function trySearch(
  page: import("playwright").Page,
  movieName: string
): Promise<{ eventId: string; slug: string } | null> {
  try {
    // Click search trigger
    const searchTrigger = await page.$(
      'input[placeholder*="Search"], [class*="search"] input'
    );
    if (searchTrigger) {
      await searchTrigger.click();
      await randomDelay(500, 1000);
    } else {
      const searchIcon = await page.$(
        'a[href*="search"], [class*="search-icon"]'
      );
      if (searchIcon) {
        await searchIcon.click();
        await randomDelay(500, 1000);
      }
    }

    const searchInput = await page.waitForSelector(
      'input[placeholder*="Search"], input[type="search"], input[type="text"][autocomplete]',
      { timeout: 5000 }
    );

    if (!searchInput) return null;

    await searchInput.fill("");
    await searchInput.type(movieName, {
      delay: 50 + Math.random() * 80,
    });
    await randomDelay(2000, 3500);

    const result = await page.evaluate((search: string) => {
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const searchNorm = normalize(search);

      const links = document.querySelectorAll('a[href*="/movies/"]');
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || "";
        const textNorm = normalize(text);

        if (
          textNorm.includes(searchNorm) ||
          searchNorm.includes(textNorm)
        ) {
          const eventMatch = href.match(/ET\d{8,}/);
          if (eventMatch) {
            const slugMatch = href.match(
              /\/movies\/[^/]+\/([^/]+)\/ET/
            );
            return {
              eventId: eventMatch[0],
              slug: slugMatch
                ? slugMatch[1]
                : search
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-"),
            };
          }
        }
      }
      return null;
    }, movieName);

    if (result) {
      console.log(`[BMS] Found via search: ${result.eventId}`);
    }
    return result;
  } catch (e) {
    console.log(
      `[BMS] Search failed: ${e instanceof Error ? e.message : e}`
    );
    return null;
  }
}

/**
 * Extract showtimes from the BMS buytickets page.
 *
 * BMS uses a ReactVirtualized grid where:
 * - The grid has role="grid" with a single role="row" container
 * - Each theater is an absolutely-positioned div child of the container
 * - Theater names are in <span> elements near cinema <a> links
 * - Showtimes are in leaf <div> elements matching time patterns
 */
async function extractShowtimes(
  page: import("playwright").Page,
  preferredCinemaNames: string[],
  requestedDateKey: string
): Promise<ShowtimeResult> {
  // Wait for the showtime grid to appear
  try {
    await page.waitForSelector(
      '[role="grid"], [class*="showtime"], [class*="venue"]',
      { timeout: 10000 }
    );
  } catch {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const noShows =
      bodyText.toLowerCase().includes("no shows") ||
      bodyText.toLowerCase().includes("no cinemas") ||
      bodyText.toLowerCase().includes("coming soon");
    if (noShows) {
      console.log("[BMS] No shows available for this date");
      return { platform: "bookmyshow", found: false, shows: [] };
    }
  }

  const shows = await page.evaluate(() => {
    const showList: {
      theaterName: string;
      showtime: string;
      format: string;
      bookingUrl: string;
    }[] = [];

    const grid = document.querySelector('[role="grid"]');
    if (!grid) return showList;

    // BMS uses ReactVirtualized: single [role="row"] container
    // with absolutely-positioned theater divs as children.
    const rowContainer =
      grid.querySelector('[role="row"]') || grid;
    const theaterDivs = Array.from(rowContainer.children);

    for (const theaterDiv of theaterDivs) {
      // Find cinema link to identify this as a theater section
      const cinemaLink = theaterDiv.querySelector(
        'a[href*="cinemas"], a[href*="buytickets"]'
      );
      if (!cinemaLink) continue;

      const bookingUrl =
        (cinemaLink as HTMLAnchorElement).href || "";

      // Theater name: find span with text near the cinema link
      // BMS puts the theater name in a <span> sibling or descendant
      let theaterName = "";
      const spans = theaterDiv.querySelectorAll("span");
      for (const span of spans) {
        const text = span.textContent?.trim() || "";
        // Theater names are typically 5-80 chars and don't look like times
        if (
          text.length >= 3 &&
          text.length <= 80 &&
          !/^\d{1,2}:\d{2}/.test(text) &&
          !/^(ATMOS|DOLBY|IMAX|4DX|ICE|MX4D)/i.test(text) &&
          !text.includes("₹") &&
          span.children.length === 0
        ) {
          // Prefer longer text (the actual name vs abbreviations)
          if (text.length > theaterName.length) {
            theaterName = text;
          }
        }
      }

      if (!theaterName) {
        // Fallback: use the cinema link's alt or text
        theaterName =
          cinemaLink.getAttribute("alt") ||
          cinemaLink.textContent?.trim() ||
          "";
      }

      if (!theaterName) continue;

      // Find showtimes: leaf divs/spans matching time pattern
      const times: string[] = [];
      let format = "";
      theaterDiv.querySelectorAll("*").forEach((el) => {
        const text = el.textContent?.trim() || "";
        if (
          /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text) &&
          el.children.length === 0
        ) {
          times.push(text);
        }
        if (
          /^(ATMOS|DOLBY|IMAX|4DX|ICE|MX4D|SCREENX)/i.test(
            text
          ) &&
          el.children.length === 0
        ) {
          format = text;
        }
      });

      if (times.length > 0) {
        const uniqueTimes = [...new Set(times)];
        uniqueTimes.forEach((time) => {
          showList.push({
            theaterName,
            showtime: time,
            format: format || "2D",
            bookingUrl,
          });
        });
      }
    }

    return showList;
  });

  const baseShows = await extractVisibleShows(
    page,
    shows,
    requestedDateKey
  );
  let finalShows = baseShows;

  if (
    preferredCinemaNames.length > 0 &&
    !containsPreferredCinema(baseShows, preferredCinemaNames)
  ) {
    const filteredShows = await retryAcrossLanguageFilters(
      page,
      preferredCinemaNames,
      requestedDateKey
    );

    if (filteredShows.length > 0) {
      finalShows = dedupeShows([...baseShows, ...filteredShows]);
    }
  }

  if (finalShows.length > 0) {
    console.log(`[BMS] Found ${finalShows.length} showtimes`);

    return {
      platform: "bookmyshow",
      found: true,
      shows: finalShows,
    };
  }

  console.log("[BMS] No showtimes found on page");
  return { platform: "bookmyshow", found: false, shows: [] };
}

async function extractVisibleShows(
  page: import("playwright").Page,
  structuredShows: Array<{
    theaterName: string;
    showtime: string;
    format: string;
    bookingUrl: string;
  }>,
  requestedDateKey: string
): Promise<ShowInfo[]> {
  const bodyText = await page.evaluate(() => document.body.innerText || "");
  const textFallbackShows = extractShowtimesFromBodyText(
    bodyText,
    page.url()
  );

  if (textFallbackShows.length > 0) {
    return dedupeShows(
      filterShowsForRequestedDate(textFallbackShows, requestedDateKey)
    );
  }

  return dedupeShows(
    filterShowsForRequestedDate(
      structuredShows.map((show) => ({
      theaterName: show.theaterName,
      showtime: show.showtime,
      format: show.format,
      language: "",
      availabilityStatus: "Available" as const,
      bookingUrl: show.bookingUrl,
      })),
      requestedDateKey
    )
  );
}

async function retryAcrossLanguageFilters(
  page: import("playwright").Page,
  preferredCinemaNames: string[],
  requestedDateKey: string
): Promise<ShowInfo[]> {
  const optionTexts = await collectLanguageFilterOptions(page, false);

  if (optionTexts.length === 0) {
    console.log("[BMS] No language/format filter options discovered");
    return [];
  }

  console.log(
    `[BMS] Retrying via ${optionTexts.length} language/format filter options`
  );

  let aggregatedShows: ShowInfo[] = [];
  let dropdownOpen = true;

  for (const optionText of optionTexts) {
    const selected = await selectLanguageFilterOption(
      page,
      optionText,
      dropdownOpen
    );
    dropdownOpen = false;
    if (!selected) {
      continue;
    }

    await page
      .waitForFunction(
        (targetText) =>
          (document.body.innerText || "").includes(targetText),
        optionText,
        { timeout: 5000 }
      )
      .catch(() => {});
    await waitForShowtimeRefresh(page);
    const visibleShows = await extractVisibleShows(
      page,
      [],
      requestedDateKey
    );

    if (visibleShows.length === 0) {
      continue;
    }

    aggregatedShows = dedupeShows([...aggregatedShows, ...visibleShows]);

    if (containsPreferredCinema(visibleShows, preferredCinemaNames)) {
      console.log(`[BMS] Preferred cinema found after selecting "${optionText}"`);
      return aggregatedShows;
    }
  }

  return aggregatedShows;
}

async function collectLanguageFilterOptions(
  page: import("playwright").Page,
  closeAfterCollect: boolean = true
): Promise<string[]> {
  const trigger = await getLanguageFilterTrigger(page);
  if (!trigger) {
    return [];
  }
  const triggerText = ((await trigger.innerText()).replace(/\s+/g, " ").trim());

  const opened = await openLanguageFilter(page, trigger);
  if (!opened) {
    return [];
  }

  await randomDelay(500, 900);
  const texts = await page
    .locator("label")
    .evaluateAll((elements, languageRegexSource) => {
      const languageRegex = new RegExp(languageRegexSource, "i");

      return elements
        .map((element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          const text = (htmlElement.innerText || htmlElement.textContent || "")
            .replace(/\s+/g, " ")
            .trim();

          return {
            text,
            visible:
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              htmlElement.getClientRects().length > 0,
          };
        })
        .filter(
          (entry) =>
            entry.visible &&
            entry.text &&
            entry.text.length <= 80 &&
            languageRegex.test(entry.text)
        )
        .map((entry) => entry.text);
    }, LANGUAGE_FILTER_REGEX.source);
  if (closeAfterCollect) {
    await closeOpenOverlay(page);
  }

  const options = texts.filter(
    (text, index, values) =>
      text !== triggerText &&
      LANGUAGE_FILTER_REGEX.test(text) &&
      !text.includes("Search for Movies") &&
      values.indexOf(text) === index
  );

  return options.sort((left, right) => {
    return scoreLanguageOption(right) - scoreLanguageOption(left);
  });
}

function scoreLanguageOption(value: string): number {
  const normalized = value.toUpperCase();
  let score = 0;

  if (FORMAT_KEYWORD_REGEX.test(normalized)) {
    score += 10;
  }

  if (!/\b2D\b/i.test(normalized)) {
    score += 3;
  }

  if (/\bDOLBY\b/i.test(normalized)) {
    score += 5;
  }

  return score;
}

async function selectLanguageFilterOption(
  page: import("playwright").Page,
  optionText: string,
  dropdownAlreadyOpen: boolean = false
): Promise<boolean> {
  if (!dropdownAlreadyOpen) {
    const trigger = await getLanguageFilterTrigger(page);
    if (!trigger) {
      return false;
    }

    const opened = await openLanguageFilter(page, trigger);
    if (!opened) {
      return false;
    }
  }

  await page
    .waitForFunction(
      (targetText) => {
        return Array.from(
          document.querySelectorAll("label, button, [role='button'], div, span")
        ).some((element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          const text = (htmlElement.innerText || htmlElement.textContent || "")
            .replace(/\s+/g, " ")
            .trim();

          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            htmlElement.getClientRects().length > 0 &&
            text === targetText
          );
        });
      },
      optionText,
      { timeout: 1500 }
    )
    .catch(() => {});

  const domSelected = await page.evaluate((targetText) => {
    const elements = Array.from(
      document.querySelectorAll("label, button, [role='button'], div, span")
    ) as HTMLElement[];

    const candidates = elements.filter((element) => {
      const style = window.getComputedStyle(element);
      const text = (element.innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        element.getClientRects().length > 0 &&
        text === targetText
      );
    });

    const candidate = candidates.at(-1);
    if (!candidate) {
      return false;
    }

    candidate.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    candidate.click();
    return true;
  }, optionText);

  if (domSelected) {
    return true;
  }

  const exactOption = page.getByText(optionText, { exact: true }).last();
  if ((await exactOption.count()) > 0) {
    try {
      await exactOption.click({ timeout: 5000 });
      return true;
    } catch {
      try {
        await exactOption.click({ timeout: 5000, force: true });
        return true;
      } catch {
        // Fall through to the label and regex-based locators below.
      }
    }
  }

  const labelOption = page
    .locator("label")
    .filter({ hasText: new RegExp(`^${escapeRegExp(optionText)}$`) })
    .last();

  if ((await labelOption.count()) > 0) {
    try {
      await labelOption.click({ timeout: 5000, force: true });
      return true;
    } catch {
      // Fall through to the broader locator below.
    }
  }

  const partialOption = page
    .locator("label, button, [role='button'], [role='option'], li, div, span")
    .filter({ hasText: new RegExp(escapeRegExp(optionText), "i") })
    .last();

  if ((await partialOption.count()) > 0) {
    try {
      await partialOption.click({ timeout: 5000 });
      return true;
    } catch {
      try {
        await partialOption.click({ timeout: 5000, force: true });
        return true;
      } catch {
        // Swallow and report below.
      }
    }
  }

  console.log(`[BMS] Failed to select filter option "${optionText}"`);
  await closeOpenOverlay(page);
  return false;
}

async function openLanguageFilter(
  page: import("playwright").Page,
  trigger: import("playwright").Locator
): Promise<boolean> {
  if ((await trigger.count()) > 0) {
    try {
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

async function getLanguageFilterTrigger(
  page: import("playwright").Page
): Promise<import("playwright").Locator | null> {
  const trigger = page
    .locator("div")
    .filter({
      has: page.locator("img[alt='icon']"),
      hasText: LANGUAGE_FILTER_REGEX,
    })
    .last();

  if ((await trigger.count()) > 0) {
    return trigger;
  }

  const fallbackTexts = await getVisibleClickableTexts(page);
  const fallbackText = fallbackTexts
    .filter(
      (text) =>
        LANGUAGE_FILTER_REGEX.test(text) &&
        !text.includes("Search for Movies") &&
        !text.includes("Project Hail Mary")
    )
    .sort((left, right) => scoreLanguageTrigger(left) - scoreLanguageTrigger(right))[0];

  if (!fallbackText) {
    return null;
  }

  const fallbackTrigger = page
    .locator("button, [role='button'], div, span")
    .filter({ hasText: new RegExp(escapeRegExp(fallbackText), "i") })
    .first();

  return (await fallbackTrigger.count()) > 0 ? fallbackTrigger : null;
}

function scoreLanguageTrigger(value: string): number {
  const normalized = value.toUpperCase();
  let score = value.length;

  if (FORMAT_KEYWORD_REGEX.test(normalized)) {
    score -= 8;
  }

  if (/\b2D\b/i.test(normalized)) {
    score -= 6;
  }

  return score;
}

async function getVisibleClickableTexts(
  page: import("playwright").Page
): Promise<string[]> {
  return page.evaluate(({ languageRegexSource, formatRegexSource }) => {
    const languageRegex = new RegExp(languageRegexSource, "i");
    const formatRegex = new RegExp(formatRegexSource, "i");
    const selectors = [
      "button",
      "[role='button']",
      "[role='option']",
      "li",
      "div",
      "span",
      "a",
    ].join(",");

    const texts = Array.from(document.querySelectorAll(selectors))
      .map((element) => {
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        const text = (htmlElement.innerText || htmlElement.textContent || "")
          .replace(/\s+/g, " ")
          .trim();

        return {
          text,
          visible:
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            htmlElement.getClientRects().length > 0,
        };
      })
      .filter(
        (entry) =>
          entry.visible &&
          entry.text &&
          entry.text.length <= 80 &&
          (languageRegex.test(entry.text) || formatRegex.test(entry.text))
      )
      .map((entry) => entry.text);

    return [...new Set(texts)];
  }, {
    languageRegexSource: LANGUAGE_FILTER_REGEX.source,
    formatRegexSource: FORMAT_KEYWORD_REGEX.source,
  });
}

async function waitForShowtimeRefresh(
  page: import("playwright").Page
): Promise<void> {
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {}),
    randomDelay(2500, 3500),
  ]);
}

async function closeOpenOverlay(
  page: import("playwright").Page
): Promise<void> {
  await page.keyboard.press("Escape").catch(() => {});
  await randomDelay(150, 300);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
