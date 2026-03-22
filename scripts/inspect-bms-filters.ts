import { createStealthContext, randomDelay } from "../src/lib/scrapers/browser";

async function dumpOptions(page: import("playwright").Page, label: string) {
  const texts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("*"))
      .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((text) => text.length > 0 && text.length < 120)
      .slice(0, 400);
  });
  console.log(`[${label}]`);
  console.log(JSON.stringify(texts, null, 2));
}

async function main() {
  const url =
    process.argv[2] ||
    "https://in.bookmyshow.com/buytickets/project-hail-mary/movie-hyderabad-ET00451760-MT/20260326";

  const context = await createStealthContext();
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await randomDelay(2500, 4000);

    console.log("[URL]", page.url());
    console.log("[TITLE]", await page.title());

    const triggers = await page.locator("button, div, span").evaluateAll((els) =>
      els
        .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
        .filter((text) =>
          /English|Hindi|Telugu|Tamil|Malayalam|Special Formats|Preferred Time|Sort By|Price Range/i.test(
            text
          )
        )
        .slice(0, 30)
    );
    console.log("[TRIGGERS]");
    console.log(JSON.stringify(triggers, null, 2));

    const filterTrigger = page
      .locator("div, span, button")
      .filter({ hasText: /English|Hindi|Telugu|Tamil|Malayalam/i })
      .first();

    await filterTrigger.click({ timeout: 10000 });
    await randomDelay(1000, 1500);
    await dumpOptions(page, "AFTER_LANGUAGE_CLICK");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
