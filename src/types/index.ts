export type PlatformName = "bookmyshow" | "district";

export type PreferredTimeslot =
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

export interface CinemaSelection {
  id: string;
  platform: PlatformName;
  name: string;
  sourceUrl?: string;
}

export interface Tracker {
  id: string;
  movieName: string;
  city: string;
  preferredDate: string;
  email: string;
  status: "active" | "found" | "expired" | "paused" | "error";
  bmsRegionCode: string;
  bmsSlug: string;
  districtCitySlug: string;
  preferredCinemas: CinemaSelection[];
  preferredTimeslots: PreferredTimeslot[];
  preferredFormats: string[];
  lastCheckedAt: string | null;
  lastError: string | null;
  checkCount: number;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestShows?: ShowInfo[];
}

export interface CheckResult {
  id: string;
  trackerId: string;
  platform: "bookmyshow" | "district";
  found: number;
  rawData: string | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface ShowInfo {
  theaterName: string;
  showtime: string;
  format: string;
  language: string;
  availabilityStatus: string;
  price?: string;
  bookingUrl?: string;
}

export interface ShowtimeResult {
  platform: PlatformName;
  found: boolean;
  shows: ShowInfo[];
  error?: string;
}

export interface CityInfo {
  name: string;
  bmsCode: string;
  bmsSlug: string;
  districtSlug: string;
}

export interface CreateTrackerInput {
  movieName: string;
  city: string;
  preferredDate: string;
  preferredCinemas: CinemaSelection[];
  preferredTimeslots: PreferredTimeslot[];
  preferredFormats?: string[];
}
