import { createStealthContext, randomDelay } from "../src/lib/scrapers/browser";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const citySlug = process.argv[2] || "hyderabad";
  const movieName = process.argv[3] || "Project Hail Mary";
  const date = process.argv[4] || "2026-03-27";
  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    const listingUrl = `https://in.bookmyshow.com/explore/movies-${citySlug}`;
    const dateFormatted = date.replace(/-/g, "");

    console.log("[LISTING]", listingUrl);
    await page.goto(listingUrl, {
      waitUntil: "load",
      timeout: 30000,
    });
    await randomDelay(2000, 3500);

    const movieMatch = await page.evaluate((search: string) => {
      const searchNorm = search
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const links = Array.from(
        document.querySelectorAll('a[href*="/movies/"]')
      ) as HTMLAnchorElement[];

      for (const link of links) {
        const text = (link.textContent || "").trim();
        const href = link.href;
        const textNorm = text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const eventMatch = href.match(/ET\d{8,}/);
        const slugMatch = href.match(/\/movies\/[^/]+\/([^/]+)\/ET/);

        if (
          eventMatch &&
          (textNorm.includes(searchNorm) || searchNorm.includes(textNorm))
        ) {
          return {
            title: text,
            href,
            eventId: eventMatch[0],
            slug: slugMatch?.[1] || "",
          };
        }
      }

      return null;
    }, movieName);

    console.log("[MOVIE_MATCH]", JSON.stringify(movieMatch, null, 2));

    if (!movieMatch) {
      throw new Error("Movie not found in listing");
    }

    const buyUrl = `https://in.bookmyshow.com/buytickets/${movieMatch.slug}/movie-${citySlug}-${movieMatch.eventId}-MT/${dateFormatted}`;
    console.log("[BUY_URL]", buyUrl);

    await page.goto(buyUrl, {
      waitUntil: "load",
      timeout: 30000,
    });
    await randomDelay(3000, 5000);

    const snapshot = await page.evaluate(() => {
      const allTimes = (document.body.innerText || "").match(
        /\d{1,2}:\d{2}\s*(AM|PM)/gi
      );

      return {
        title: document.title,
        url: window.location.href,
        roleGridCount: document.querySelectorAll('[role="grid"]').length,
        roleRowCount: document.querySelectorAll('[role="row"]').length,
        cinemaLinkCount: document.querySelectorAll('a[href*="cinemas"]').length,
        buyLinkCount: document.querySelectorAll('a[href*="buytickets"]').length,
        buttonCount: document.querySelectorAll("button").length,
        bodySample: (document.body.innerText || "").slice(0, 5000),
        allTimes: [...new Set(allTimes || [])].slice(0, 50),
        cinemaLinks: Array.from(
          document.querySelectorAll('a[href*="cinemas"]')
        )
          .map((anchor) => ({
            text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
            href: (anchor as HTMLAnchorElement).href,
          }))
          .filter((entry) => entry.text)
          .slice(0, 30),
        timeNodes: Array.from(document.querySelectorAll("*"))
          .map((node) => ((node as HTMLElement).innerText || "").trim())
          .filter((text) => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text))
          .slice(0, 50),
      };
    });

    console.log("[SNAPSHOT]");
    console.log(JSON.stringify(snapshot, null, 2));

    const parsedPairs = await page.evaluate(() => {
      const lines = (document.body.innerText || "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const pairs: Array<{ theater: string; next: string }> = [];
      for (let index = 0; index < lines.length - 1; index += 1) {
        const current = lines[index];
        const next = lines[index + 1];
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(next)) {
          pairs.push({ theater: current, next });
        }
      }

      return pairs.slice(0, 40);
    });

    console.log("[THEATER_TIME_PAIRS]");
    console.log(JSON.stringify(parsedPairs, null, 2));

    const extracted = await page.evaluate(() => {
      const isFormat = (value: string) =>
        /^(ATMOS|DOLBY|IMAX|4DX|ICE|MX4D|SCREENX|PCX|2D|3D|4K|LASER)/i.test(
          value
        );

      const structured: Array<{
        theaterName: string;
        showtime: string;
        format: string;
      }> = [];

      const grid = document.querySelector('[role="grid"]');
      if (grid) {
        const rowContainer = grid.querySelector('[role="row"]') || grid;
        const theaterDivs = Array.from(rowContainer.children);

        for (const theaterDiv of theaterDivs) {
          const cinemaLink = theaterDiv.querySelector(
            'a[href*="cinemas"], a[href*="buytickets"]'
          );
          if (!cinemaLink) continue;

          let theaterName = "";
          const spans = theaterDiv.querySelectorAll("span");
          for (const span of spans) {
            const text = span.textContent?.trim() || "";
            if (
              text.length >= 3 &&
              text.length <= 80 &&
              !/^\d{1,2}:\d{2}/.test(text) &&
              !/^(ATMOS|DOLBY|IMAX|4DX|ICE|MX4D)/i.test(text) &&
              !text.includes("₹") &&
              span.children.length === 0
            ) {
              if (text.length > theaterName.length) {
                theaterName = text;
              }
            }
          }

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
            if (isFormat(text) && el.children.length === 0) {
              format = text;
            }
          });

          [...new Set(times)].forEach((time) => {
            structured.push({
              theaterName,
              showtime: time,
              format: format || "2D",
            });
          });
        }
      }

      const textFallback: Array<{
        theaterName: string;
        showtime: string;
        format: string;
      }> = [];
      const lines = (document.body.innerText || "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const stopMarkers = new Set([
        "Unable to find what you are looking for?",
        "HomeMovies in HyderabadHindi MoviesProject Hail Mary",
      ]);
      const isTime = (value: string) =>
        /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(value);
      const isNoise = (value: string) =>
        /^(available|fast filling|non-cancellable|price range|special formats|preferred time|sort by|got it)$/i.test(
          value
        );
      const isTheater = (value: string) =>
        value.length >= 4 &&
        value.length <= 120 &&
        !isTime(value) &&
        !isFormat(value) &&
        !isNoise(value);

      let currentTheater = "";
      for (let index = 0; index < lines.length; index += 1) {
        const current = lines[index];
        const next = lines[index + 1] || "";

        if (stopMarkers.has(current)) {
          break;
        }

        if (isTheater(current) && isTime(next)) {
          currentTheater = current;
          continue;
        }

        if (currentTheater && isTime(current)) {
          const nextLine = lines[index + 1] || "";
          textFallback.push({
            theaterName: currentTheater,
            showtime: current,
            format: isFormat(nextLine) ? nextLine : "2D",
          });
        }
      }

      return {
        structured,
        textFallback,
      };
    });

    console.log("[EXTRACTED_STRUCTURED]");
    console.log(JSON.stringify(extracted.structured, null, 2));
    console.log("[EXTRACTED_TEXT_FALLBACK]");
    console.log(JSON.stringify(extracted.textFallback, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
