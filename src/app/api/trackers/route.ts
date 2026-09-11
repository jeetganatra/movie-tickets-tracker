import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkResults, trackers } from "@/lib/db/schema";
import { getCityByName } from "@/lib/cities";
import {
  filterShowsForPreferences,
  normalizeTracker,
  sanitizeCinemaSelections,
  sanitizePreferredFormats,
  sanitizePreferredTimeslots,
} from "@/lib/preferences";
import { desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  CinemaSelection,
  PlatformName,
  PreferredTimeslot,
  ShowInfo,
} from "@/types";

function parseShows(rawData: string | null): ShowInfo[] {
  if (!rawData) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawData);
    return Array.isArray(parsed) ? (parsed as ShowInfo[]) : [];
  } catch {
    return [];
  }
}

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

export async function GET() {
  const allTrackers = await db
    .select()
    .from(trackers)
    .orderBy(desc(trackers.createdAt));

  const trackersWithShows = await Promise.all(
    allTrackers.map(async (tracker) => {
      const normalizedTracker = normalizeTracker(tracker);
      const latestFoundResults = await db
        .select()
        .from(checkResults)
        .where(eq(checkResults.trackerId, tracker.id))
        .orderBy(desc(checkResults.checkedAt))
        .limit(10);
      const latestShows = dedupeShows(
        latestFoundResults
          .filter((result) => result.found === 1)
          .flatMap((result) =>
            filterShowsForPreferences(
              result.platform as PlatformName,
              parseShows(result.rawData),
              normalizedTracker.preferredCinemas,
              normalizedTracker.preferredTimeslots,
              normalizedTracker.preferredFormats
            )
          )
      );

      return {
        ...normalizedTracker,
        latestShows,
      };
    })
  );

  return NextResponse.json({
    trackers: trackersWithShows,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      movieName,
      city,
      preferredDate,
      email,
      preferredCinemas,
      preferredFormats,
      preferredTimeslots,
    } = body;

    // Validation
    if (!movieName || typeof movieName !== "string" || !movieName.trim()) {
      return NextResponse.json(
        { error: "Movie name is required" },
        { status: 400 }
      );
    }

    if (!city || typeof city !== "string") {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 }
      );
    }

    const cityInfo = getCityByName(city);
    if (!cityInfo) {
      return NextResponse.json(
        { error: "Unsupported city" },
        { status: 400 }
      );
    }

    if (!preferredDate || typeof preferredDate !== "string") {
      return NextResponse.json(
        { error: "Preferred date is required" },
        { status: 400 }
      );
    }

    const dateObj = new Date(preferredDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(dateObj.getTime()) || dateObj < today) {
      return NextResponse.json(
        { error: "Date must be today or in the future" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const normalizedCinemas = sanitizeCinemaSelections(
      Array.isArray(preferredCinemas)
        ? (preferredCinemas as CinemaSelection[])
        : []
    );

    if (normalizedCinemas.length === 0) {
      return NextResponse.json(
        { error: "Select at least one cinema" },
        { status: 400 }
      );
    }

    const normalizedTimeslots = sanitizePreferredTimeslots(
      Array.isArray(preferredTimeslots)
        ? (preferredTimeslots as PreferredTimeslot[])
        : []
    );

    const normalizedFormats = sanitizePreferredFormats(
      Array.isArray(preferredFormats) ? preferredFormats : []
    );

    if (normalizedTimeslots.length === 0) {
      return NextResponse.json(
        { error: "Select at least one timeslot" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newTracker = {
      id: uuidv4(),
      movieName: movieName.trim(),
      city: cityInfo.name,
      preferredDate,
      email: email.trim().toLowerCase(),
      status: "active",
      bmsRegionCode: cityInfo.bmsCode,
      bmsSlug: cityInfo.bmsSlug,
      districtCitySlug: cityInfo.districtSlug,
      preferredCinemas: JSON.stringify(normalizedCinemas),
      preferredFormats: JSON.stringify(normalizedFormats),
      preferredTimeslots: JSON.stringify(normalizedTimeslots),
      lastCheckedAt: null,
      lastError: null,
      checkCount: 0,
      notifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(trackers).values(newTracker);

    return NextResponse.json(
      { tracker: normalizeTracker(newTracker) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tracker:", error);
    return NextResponse.json(
      { error: "Failed to create tracker" },
      { status: 500 }
    );
  }
}
