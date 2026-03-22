import { createStealthContext, randomDelay } from "../src/lib/scrapers/browser";

async function main() {
  const url =
    process.argv[2] ||
    "https://in.bookmyshow.com/buytickets/project-hail-mary/movie-hyderabad-ET00451760-MT/20260327";
  const optionText = process.argv[3] || "English - DOLBY CINEMA 2D";

  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await randomDelay(2500, 4000);

    const trigger = page
      .locator("div")
      .filter({
        has: page.locator("img[alt='icon']"),
        hasText: /English|Hindi|Telugu|Tamil|Malayalam|Kannada|Marathi|Punjabi|Bengali/i,
      })
      .last();

    await trigger.click({ timeout: 10000 });
    await page
      .waitForFunction(
        (targetText) =>
          Array.from(document.querySelectorAll("label, div, span")).some((element) => {
            const htmlElement = element as HTMLElement;
            const text = (htmlElement.innerText || htmlElement.textContent || "")
              .replace(/\s+/g, " ")
              .trim();
            const style = window.getComputedStyle(htmlElement);

            return (
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              htmlElement.getClientRects().length > 0 &&
              text === targetText
            );
          }),
        optionText,
        { timeout: 5000 }
      )
      .catch(() => {});

    await page.getByText(optionText, { exact: true }).last().click({ timeout: 10000 });
    await page
      .waitForFunction(
        (targetText) => (document.body.innerText || "").includes(targetText),
        optionText,
        { timeout: 5000 }
      )
      .catch(() => {});
    await randomDelay(2500, 3500);

    const snapshot = await page.evaluate(() => {
      const bodyText = document.body.innerText || "";
      const lines = bodyText
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      return {
        url: window.location.href,
        title: document.title,
        bodySample: bodyText.slice(0, 2000),
        theaters: lines
          .filter((line) => /(:|cinema|cinemas|theatre|theater|multiplex)/i.test(line))
          .slice(0, 20),
        times: lines.filter((line) => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(line)).slice(0, 20),
      };
    });

    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
