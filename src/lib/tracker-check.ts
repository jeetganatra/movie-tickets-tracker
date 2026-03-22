import { checkBookMyShow } from "@/lib/scrapers/bookmyshow";
import { checkDistrict } from "@/lib/scrapers/district";
import { applyPreferencesToResult, normalizeTracker } from "@/lib/preferences";
import { trackers } from "@/lib/db/schema";

type TrackerRow = typeof trackers.$inferSelect;

export async function runTrackerCheck(row: TrackerRow) {
  const tracker = normalizeTracker(row);
  const preferredBmsCinemas = tracker.preferredCinemas
    .filter((selection) => selection.platform === "bookmyshow")
    .map((selection) => selection.name);

  const [bmsRawResult, districtRawResult] = await Promise.all([
    checkBookMyShow(
      tracker.movieName,
      tracker.bmsSlug,
      tracker.preferredDate,
      preferredBmsCinemas
    ),
    checkDistrict(tracker.movieName, tracker.districtCitySlug, tracker.preferredDate),
  ]);

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
