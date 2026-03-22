import { createContext, randomDelay } from "./browser";
import type { ShowtimeResult, ShowInfo } from "./types";

/**
 * Strategy:
 * 1. Go to District city movie listing page
 * 2. Find the movie link (contains MV{id} in the href)
 * 3. Navigate to the movie page with ?fromdate=YYYY-MM-DD for date selection
 * 4. Extract theaters from <li> elements containing <a href="...CD..."> (cinema links)
 * 5. Extract showtimes from <button> elements with time text pattern
 */
export async function checkDistrict(
  movieName: string,
  citySlug: string,
  date: string
): Promise<ShowtimeResult> {
  const context = await createContext();

  try {
    const page = await context.newPage();

    // Step 1: Navigate to the city movie listing page
    const listingUrl = `https://www.district.in/movies/${citySlug}-movie-tickets`;
    console.log(`[District] Checking ${listingUrl} for "${movieName}"`);

    await page.goto(listingUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(2000, 4000);

    // Step 2: Find the movie link on the listing page
    // District movie links look like: /movies/{slug}-movie-tickets-in-{city}-MV{id}
    const movieLink = await page.evaluate((search: string) => {
      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      const searchNorm = normalize(search);

      // Look for all links that point to individual movie pages
      const allLinks = document.querySelectorAll('a[href*="/movies/"][href*="MV"]');
      for (const link of allLinks) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || "";
        const textNorm = normalize(text);

        if (textNorm.includes(searchNorm) || searchNorm.includes(textNorm)) {
          return { href, title: text };
        }
      }

      // Broader search: any link containing "movie-tickets-in"
      const broaderLinks = document.querySelectorAll('a[href*="movie-tickets-in"]');
      for (const link of broaderLinks) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || "";
        const textNorm = normalize(text);

        if (textNorm.includes(searchNorm) || searchNorm.includes(textNorm)) {
          return { href, title: text };
        }
      }

      // Even broader: search all movie links by text content
      const movieLinks = document.querySelectorAll('a[href*="/movies/"]');
      for (const link of movieLinks) {
        const href = (link as HTMLAnchorElement).href;
        const text = link.textContent?.trim() || "";
        const textNorm = normalize(text);

        // Only match if the text is a reasonable movie name length
        if (text.length > 1 && text.length < 100) {
          if (textNorm.includes(searchNorm) || searchNorm.includes(textNorm)) {
            return { href, title: text };
          }
        }
      }

      return null;
    }, movieName);

    if (!movieLink) {
      console.log("[District] Movie not found in listing page");
      return { platform: "district", found: false, shows: [] };
    }

    // Step 3: Navigate to the movie page with the date parameter
    // Append ?fromdate=YYYY-MM-DD to select the correct date
    let moviePageUrl = movieLink.href;
    const separator = moviePageUrl.includes("?") ? "&" : "?";
    moviePageUrl = `${moviePageUrl}${separator}fromdate=${date}`;

    console.log(`[District] Found movie: "${movieLink.title}"`);
    console.log(`[District] Navigating to: ${moviePageUrl}`);

    await page.goto(moviePageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(3000, 5000);

    // Step 4: Extract theaters and showtimes
    // District renders theaters as <li> (listitem) elements
    // Each theater has an <a href="...CD..."> link with the theater name
    // Showtimes are in <button> elements inside nested <ul>/<li> structures
    const shows = await page.evaluate(() => {
      const showList: {
        theaterName: string;
        showtime: string;
        format: string;
        bookingUrl: string;
      }[] = [];

      // Strategy A: Find list items that contain cinema links (a[href*="CD"])
      const cinemaLinks = document.querySelectorAll('a[href*="/CD"]');

      for (const cinemaLink of cinemaLinks) {
        const theaterName = cinemaLink.textContent?.trim() || "";
        const bookingUrl = (cinemaLink as HTMLAnchorElement).href || "";

        if (!theaterName) continue;

        // Find the parent list item that contains both theater name and showtimes
        const parentLi =
          cinemaLink.closest("li") ||
          cinemaLink.closest('[role="listitem"]') ||
          cinemaLink.parentElement?.closest("li");

        if (!parentLi) continue;

        // Find all buttons within this theater's section that contain time text
        const buttons = parentLi.querySelectorAll("button");
        const times: string[] = [];

        buttons.forEach((btn) => {
          const text = btn.textContent?.trim() || "";
          // Match time pattern like "01:00 PM", "11:15 AM", "9:30 PM"
          if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text)) {
            times.push(text);
          }
        });

        // Also check for time text in any child elements (spans, divs, etc.)
        if (times.length === 0) {
          const allElements = parentLi.querySelectorAll("*");
          allElements.forEach((el) => {
            const text = el.textContent?.trim() || "";
            if (
              /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text) &&
              el.children.length === 0 // leaf node only
            ) {
              times.push(text);
            }
          });
        }

        if (times.length > 0) {
          // Deduplicate times
          const uniqueTimes = [...new Set(times)];
          uniqueTimes.forEach((time) => {
            showList.push({
              theaterName,
              showtime: time,
              format: "2D",
              bookingUrl,
            });
          });
        }
      }

      // Strategy B: If no cinema links found, try broader approach
      if (showList.length === 0) {
        // Look for any list items that contain time-like buttons
        const listItems = document.querySelectorAll('li, [role="listitem"]');

        let currentTheater = "";
        let currentUrl = "";

        listItems.forEach((li) => {
          // Check if this item has a heading/link that looks like a theater name
          const nameEl = li.querySelector("a, h3, h4, [class*='name'], [class*='title']");
          if (nameEl) {
            const name = nameEl.textContent?.trim() || "";
            const href = (nameEl as HTMLAnchorElement).href || "";
            // Theater names are usually short (< 100 chars) and not time patterns
            if (name.length > 2 && name.length < 100 && !/^\d{1,2}:\d{2}/.test(name)) {
              currentTheater = name;
              currentUrl = href;
            }
          }

          // Find time buttons in this list item
          const buttons = li.querySelectorAll("button");
          buttons.forEach((btn) => {
            const text = btn.textContent?.trim() || "";
            if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text) && currentTheater) {
              showList.push({
                theaterName: currentTheater,
                showtime: text,
                format: "2D",
                bookingUrl: currentUrl,
              });
            }
          });
        });
      }

      // Strategy C: Fallback - look for any time patterns on the page
      if (showList.length === 0) {
        const bodyText = document.body.innerText || "";
        const lines = bodyText
          .split("\n")
          .map((line) => line.replace(/\s+/g, " ").trim())
          .filter(Boolean);

        const isTime = (value: string) => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(value);
        const isStatus = (value: string) =>
          /^(available|filling fast|almost full|filters|hindi|english|telugu|tamil|mar|sat|sun|mon|tue|wed|thu|fri|non-cancellable|allows cancellation|wheelchair friendly|premium seats|recliners|after 5 pm|morning)$/i.test(
            value
          );
        const isFormat = (value: string) =>
          /^(atmos|dolby|laser|recliners?|4k|2k|screen \d+|audi \d+|vip|renovated|dolby atmos|dolby 7\.1|laser & 7\.1|insignia)$/i.test(
            value
          );
        const looksLikeTheater = (value: string) =>
          value.length >= 8 &&
          value.length <= 120 &&
          !isTime(value) &&
          !isStatus(value) &&
          !isFormat(value) &&
          !/^\d+(\.\d+)?\s*km away/i.test(value) &&
          /[,:-]/.test(value);

        let currentTheater = "";
        let currentFormat = "";

        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];

          if (looksLikeTheater(line)) {
            currentTheater = line;
            currentFormat = "";
            continue;
          }

          if (!currentTheater) {
            continue;
          }

          if (isFormat(line)) {
            currentFormat = line;
            continue;
          }

          if (isTime(line)) {
            const nextLine = lines[index + 1] || "";
            const format = isFormat(nextLine) ? nextLine : currentFormat || "2D";

            showList.push({
              theaterName: currentTheater,
              showtime: line,
              format,
              bookingUrl: window.location.href,
            });
          }
        }

        if (showList.length === 0) {
          const timeMatches = bodyText.match(/\d{1,2}:\d{2}\s*(AM|PM)/gi);
          if (timeMatches && timeMatches.length > 0) {
            showList.push({
              theaterName: "Multiple theaters",
              showtime: "Check District for times",
              format: "Various",
              bookingUrl: window.location.href,
            });
          }
        }
      }

      return showList;
    });

    if (shows.length > 0) {
      console.log(`[District] Found ${shows.length} showtimes`);
      const showInfos: ShowInfo[] = shows.map((s) => ({
        theaterName: s.theaterName,
        showtime: s.showtime,
        format: s.format,
        language: "",
        availabilityStatus: "Available",
        bookingUrl: s.bookingUrl,
      }));

      return {
        platform: "district",
        found: true,
        shows: showInfos,
      };
    }

    // Final check: maybe the page loaded but no showtimes for this date
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const noShows =
      bodyText.includes("no shows") ||
      bodyText.includes("coming soon") ||
      bodyText.includes("notify me") ||
      bodyText.includes("no cinemas");

    if (noShows) {
      console.log("[District] No shows available for this date");
    } else {
      console.log("[District] No showtimes found on page (may need selector update)");
    }

    return { platform: "district", found: false, shows: [] };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[District] Scraping error: ${errMsg}`);
    return {
      platform: "district",
      found: false,
      shows: [],
      error: errMsg,
    };
  } finally {
    await context.close();
  }
}
