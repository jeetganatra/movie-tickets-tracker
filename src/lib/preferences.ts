import { getCityByName } from "@/lib/cities";
import type {
  CinemaSelection,
  PlatformName,
  PreferredTimeslot,
  ShowInfo,
  ShowtimeResult,
  Tracker,
} from "@/types";

export const TIMESLOT_OPTIONS: {
  value: PreferredTimeslot;
  label: string;
  description: string;
}[] = [
  { value: "morning", label: "Morning", description: "6 AM to 11:59 AM" },
  { value: "afternoon", label: "Afternoon", description: "12 PM to 4:59 PM" },
  { value: "evening", label: "Evening", description: "5 PM to 8:59 PM" },
  { value: "night", label: "Night", description: "9 PM to 5:59 AM" },
];

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCinemaName(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "");
}

export function buildCinemaSelectionId(
  platform: PlatformName,
  name: string
): string {
  return `${platform}:${normalizeCinemaName(name)}`;
}

export function sanitizeCinemaSelections(
  selections: CinemaSelection[]
): CinemaSelection[] {
  const validPlatforms = new Set<PlatformName>(["bookmyshow", "district"]);
  const seen = new Set<string>();

  return selections
    .map((selection) => ({
      id: buildCinemaSelectionId(selection.platform, selection.name),
      platform: selection.platform,
      name: normalizeWhitespace(selection.name),
      sourceUrl: selection.sourceUrl,
    }))
    .filter((selection) => {
      if (!selection.name || !validPlatforms.has(selection.platform)) {
        return false;
      }

      if (seen.has(selection.id)) {
        return false;
      }

      seen.add(selection.id);
      return true;
    });
}

export function sanitizePreferredTimeslots(
  timeslots: PreferredTimeslot[]
): PreferredTimeslot[] {
  const valid = new Set(TIMESLOT_OPTIONS.map((option) => option.value));

  return [...new Set(timeslots)].filter((timeslot) => valid.has(timeslot));
}

export function sanitizePreferredFormats(formats: string[]): string[] {
  const seen = new Set<string>();

  return formats
    .map((format) => normalizeWhitespace(format).toUpperCase())
    .filter((format) => {
      if (!format || format.length > 80 || seen.has(format)) {
        return false;
      }

      seen.add(format);
      return true;
    });
}

function parsePreferredCinemas(value: string | null | undefined): CinemaSelection[] {
  const parsed = safeParseJson<CinemaSelection[]>(value, []);
  return sanitizeCinemaSelections(
    parsed.filter(
      (selection): selection is CinemaSelection =>
        Boolean(selection?.platform && selection?.name)
    )
  );
}

function parsePreferredTimeslots(
  value: string | null | undefined
): PreferredTimeslot[] {
  return sanitizePreferredTimeslots(
    safeParseJson<PreferredTimeslot[]>(value, [])
  );
}

function parsePreferredFormats(value: string | null | undefined): string[] {
  return sanitizePreferredFormats(safeParseJson<string[]>(value, []));
}

type TrackerRowLike = {
  id: string;
  userId?: string | null;
  movieName: string;
  city: string;
  preferredDate: string;
  email: string;
  status: string;
  bmsRegionCode: string;
  bmsSlug?: string | null;
  districtCitySlug: string;
  preferredCinemas?: string | null;
  preferredTimeslots?: string | null;
  preferredFormats?: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  checkCount: number;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function normalizeTracker(row: TrackerRowLike): Tracker {
  const { userId: ownerId, ...publicRow } = row;
  void ownerId;
  const cityInfo = getCityByName(row.city);
  const status = ["active", "found", "expired", "paused", "error"].includes(
    row.status
  )
    ? (row.status as Tracker["status"])
    : "active";

  return {
    ...publicRow,
    status,
    bmsSlug: row.bmsSlug || cityInfo?.bmsSlug || row.bmsRegionCode.toLowerCase(),
    preferredCinemas: parsePreferredCinemas(row.preferredCinemas),
    preferredTimeslots: parsePreferredTimeslots(row.preferredTimeslots),
    preferredFormats: parsePreferredFormats(row.preferredFormats),
  };
}

export function getShowTimeslot(
  showtime: string
): PreferredTimeslot | null {
  const match = showtime.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM") {
    hours += 12;
  }

  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes >= 360 && totalMinutes < 720) {
    return "morning";
  }

  if (totalMinutes >= 720 && totalMinutes < 1020) {
    return "afternoon";
  }

  if (totalMinutes >= 1020 && totalMinutes < 1260) {
    return "evening";
  }

  return "night";
}

function matchesCinemaPreference(
  show: ShowInfo,
  platform: PlatformName,
  selections: CinemaSelection[]
): boolean {
  if (selections.length === 0) {
    return true;
  }

  const showName = normalizeCinemaName(show.theaterName);

  return selections.some(
    (selection) =>
      selection.platform === platform &&
      normalizeCinemaName(selection.name) === showName
  );
}

function matchesTimeslotPreference(
  show: ShowInfo,
  preferredTimeslots: PreferredTimeslot[]
): boolean {
  if (preferredTimeslots.length === 0) {
    return true;
  }

  const timeslot = getShowTimeslot(show.showtime);
  return timeslot ? preferredTimeslots.includes(timeslot) : false;
}

function matchesFormatPreference(
  show: ShowInfo,
  preferredFormats: string[]
): boolean {
  if (preferredFormats.length === 0) {
    return true;
  }

  const haystack = normalizeWhitespace(
    [show.format, show.availabilityStatus].filter(Boolean).join(" ")
  ).toUpperCase();

  return preferredFormats.some((format) => haystack.includes(format));
}

export function filterShowsForPreferences(
  platform: PlatformName,
  shows: ShowInfo[],
  preferredCinemas: CinemaSelection[],
  preferredTimeslots: PreferredTimeslot[],
  preferredFormats: string[] = []
): ShowInfo[] {
  return shows.filter(
    (show) =>
      matchesCinemaPreference(show, platform, preferredCinemas) &&
      matchesTimeslotPreference(show, preferredTimeslots) &&
      matchesFormatPreference(show, preferredFormats)
  );
}

export function applyPreferencesToResult(
  result: ShowtimeResult,
  preferredCinemas: CinemaSelection[],
  preferredTimeslots: PreferredTimeslot[],
  preferredFormats: string[] = []
): ShowtimeResult {
  const filteredShows = filterShowsForPreferences(
    result.platform,
    result.shows,
    preferredCinemas,
    preferredTimeslots,
    preferredFormats
  );

  return {
    ...result,
    found: filteredShows.length > 0,
    shows: filteredShows,
  };
}
