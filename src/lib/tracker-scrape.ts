import {
  checkBookMyShow,
  checkBookMyShowCinemaPage,
} from "@/lib/scrapers/bookmyshow";
import { checkDistrict } from "@/lib/scrapers/district";
import { applyPreferencesToResult, normalizeTracker } from "@/lib/preferences";
import { trackers } from "@/lib/db/schema";
import type { ShowInfo, ShowtimeResult } from "@/types";

type TrackerRow = typeof trackers.$inferSelect;

function dedupeShows(shows: ShowInfo[]): ShowInfo[] {
  const seen = new Set<string>();

  return shows.filter((show) => {
    const key = [
      show.theaterName.toLowerCase(),
      show.showtime.toUpperCase(),
      show.format.toLowerCase(),
      show.bookingUrl || "",
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function scrapeTracker(row: TrackerRow) {
  const tracker = normalizeTracker(row);
  const shouldCheckPlatform = (platform: string) =>
    tracker.preferredCinemas.length === 0 ||
    tracker.preferredCinemas.some((cinema) => cinema.platform === platform);
  const preferredBmsCinemas = tracker.preferredCinemas
    .filter((selection) => selection.platform === "bookmyshow")
    .map((selection) => selection.name);
  const preferredBmsCinemaPages = tracker.preferredCinemas.filter(
    (selection) =>
      selection.platform === "bookmyshow" &&
      selection.sourceUrl?.includes("bookmyshow.com/cinemas/")
  );

  const [bmsMovieRawResult, bmsCinemaPageResults, districtRawResult] =
    await Promise.all([
    shouldCheckPlatform("bookmyshow") ? checkBookMyShow(
      tracker.movieName,
      tracker.bmsSlug,
      tracker.preferredDate,
      preferredBmsCinemas
    ) : Promise.resolve<ShowtimeResult>({ platform: "bookmyshow", found: false, shows: [] }),
    Promise.all(
      preferredBmsCinemaPages.map((selection) =>
        checkBookMyShowCinemaPage(
          tracker.movieName,
          selection.name,
          selection.sourceUrl || "",
          tracker.preferredDate
        )
      )
    ),
    shouldCheckPlatform("district")
      ? checkDistrict(tracker.movieName, tracker.districtCitySlug, tracker.preferredDate)
      : Promise.resolve<ShowtimeResult>({ platform: "district", found: false, shows: [] }),
  ]);
  const bmsRawResult: ShowtimeResult = {
    platform: "bookmyshow",
    found:
      bmsMovieRawResult.found ||
      bmsCinemaPageResults.some((result) => result.found),
    shows: dedupeShows([
      ...bmsMovieRawResult.shows,
      ...bmsCinemaPageResults.flatMap((result) => result.shows),
    ]),
    error: [
      bmsMovieRawResult.error,
      ...bmsCinemaPageResults.map((result) => result.error),
    ]
      .filter(Boolean)
      .join("; ") || undefined,
  };

  const bmsResult = applyPreferencesToResult(
    bmsRawResult,
    tracker.preferredCinemas,
    tracker.preferredTimeslots,
    tracker.preferredFormats
  );
  const districtResult = applyPreferencesToResult(
    districtRawResult,
    tracker.preferredCinemas,
    tracker.preferredTimeslots,
    tracker.preferredFormats
  );

  return {
    tracker,
    bmsResult,
    districtResult,
  };
}
