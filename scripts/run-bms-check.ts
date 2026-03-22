import { checkBookMyShow } from "../src/lib/scrapers/bookmyshow";

async function main() {
  const movieName = process.argv[2] || "Project Hail Mary";
  const cityCode = process.argv[3] || "HYD";
  const date = process.argv[4] || "2026-03-27";

  const result = await checkBookMyShow(movieName, cityCode, date);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
