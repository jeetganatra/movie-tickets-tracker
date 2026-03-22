import { createStealthContext, randomDelay } from "../src/lib/scrapers/browser";

async function main() {
  const citySlug = process.argv[2] || "hyderabad";
  const movieSlug = process.argv[3] || "project-hail-mary";
  const eventId = process.argv[4] || "ET00451760";
  const date = process.argv[5] || "20260326";
  const context = await createStealthContext();

  try {
    const page = await context.newPage();
    const url = `https://in.bookmyshow.com/buytickets/${movieSlug}/movie-${citySlug}-${eventId}-MT/${date}`;
    console.log("[BUY_URL]", url);

    await page.goto(url, {
      waitUntil: "load",
      timeout: 30000,
    });
    await randomDelay(3000, 5000);

    const body = await page.evaluate(() => document.body.innerText || "");
    console.log(body.slice(0, 5000));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
