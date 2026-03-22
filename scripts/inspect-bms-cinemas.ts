import { createStealthContext, randomDelay } from "../src/lib/scrapers/browser";

async function main() {
  const city = process.argv[2] || "hyderabad";
  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    const seen = new Set<string>();

    page.on("response", async (response) => {
      const url = response.url();
      if (seen.has(url)) {
        return;
      }

      if (!/cinema|venue|explore|list|search|region|widget|api/i.test(url)) {
        return;
      }

      seen.add(url);

      try {
        const contentType = response.headers()["content-type"] || "";
        if (/json/i.test(contentType)) {
          const body = await response.text();
          console.log("\n[JSON]", url);
          console.log(body.slice(0, 1200));
          return;
        }

        console.log("\n[RESP]", response.status(), url);
      } catch (error) {
        console.log("\n[ERR]", url, error instanceof Error ? error.message : String(error));
      }
    });

    const url = `https://in.bookmyshow.com/${city}/cinemas`;
    console.log("[OPEN]", url);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await randomDelay(1500, 2500);

    for (let index = 0; index < 8; index += 1) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await randomDelay(500, 900);
    }

    await randomDelay(3000, 5000);
    console.log("[TITLE]", await page.title());

    const summary = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() || "")
        .filter(Boolean)
        .slice(0, 50);

      const anchors = Array.from(document.querySelectorAll('a[href*="/cinemas/"]'))
        .map((anchor) => ({
          href: (anchor as HTMLAnchorElement).href,
          text: anchor.textContent?.replace(/\s+/g, " ").trim() || "",
        }))
        .filter((item) => item.text);

      const bodyText = document.body.innerText || "";
      return {
        buttons,
        cinemaAnchorCount: anchors.length,
        cinemaAnchors: anchors.slice(0, 40),
        bodySample: bodyText.slice(0, 5000),
      };
    });

    console.log("\n[BUTTONS]");
    console.log(JSON.stringify(summary.buttons, null, 2));
    console.log("\n[CINEMA_ANCHOR_COUNT]", summary.cinemaAnchorCount);
    console.log(JSON.stringify(summary.cinemaAnchors, null, 2));
    console.log("\n[BODY_SAMPLE]");
    console.log(summary.bodySample);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
