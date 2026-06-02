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

export async function runTrackerCheck(row: TrackerRow) {
  const tracker = normalizeTracker(row);
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
    checkBookMyShow(
      tracker.movieName,
      tracker.bmsSlug,
      tracker.preferredDate,
      preferredBmsCinemas
    ),
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
    checkDistrict(tracker.movieName, tracker.districtCitySlug, tracker.preferredDate),
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
    tracker.preferredTimeslots
  );
  const districtResult = applyPreferencesToResult(
    districtRawResult,
    tracker.preferredCinemas,
    tracker.preferredTimeslots
  );

  return {
    tracker,
    bmsResult,
    districtResult,
  };
}
