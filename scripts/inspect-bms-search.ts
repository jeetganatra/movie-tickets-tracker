import { createStealthContext, randomDelay } from "../src/lib/scrapers/browser";

async function main() {
  const city = process.argv[2] || "hyderabad";
  const query = process.argv[3] || "pvr";
  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    const seen = new Set<string>();

    page.on("response", async (response) => {
      const url = response.url();
      if (seen.has(url)) {
        return;
      }

      if (!/search|suggest|venue|cinema|api/i.test(url)) {
        return;
      }

      seen.add(url);
      try {
        const contentType = response.headers()["content-type"] || "";
        const body = await response.text();
        console.log("\n[RESP]", response.status(), url);
        if (/json/i.test(contentType)) {
          console.log(body.slice(0, 3000));
        }
      } catch (error) {
        console.log("[ERR]", url, error instanceof Error ? error.message : String(error));
      }
    });

    await page.goto(`https://in.bookmyshow.com/${city}/cinemas`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await randomDelay(1200, 2000);

    const input = page.locator(
      'input[placeholder*="Search"], input[aria-label*="Search"], input[type="text"]'
    ).first();

    console.log("[SEARCH_QUERY]", query);
    await input.click({ timeout: 10000 });
    await input.fill(query);
    await randomDelay(2000, 3500);

    const snapshot = await page.evaluate(() => ({
      title: document.title,
      inputs: Array.from(document.querySelectorAll("input")).map((input) => ({
        placeholder: input.getAttribute("placeholder"),
        ariaLabel: input.getAttribute("aria-label"),
        value: (input as HTMLInputElement).value,
      })),
      links: Array.from(document.querySelectorAll("a"))
        .map((anchor) => ({
          href: (anchor as HTMLAnchorElement).href,
          text: anchor.textContent?.replace(/\s+/g, " ").trim() || "",
        }))
        .filter((item) => item.text)
        .slice(0, 50),
      body: (document.body.innerText || "").slice(0, 4000),
    }));

    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
