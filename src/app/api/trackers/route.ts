import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackers } from "@/lib/db/schema";
import { getCityByName } from "@/lib/cities";
import {
  normalizeTracker,
  sanitizeCinemaSelections,
  sanitizePreferredTimeslots,
} from "@/lib/preferences";
import { desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { CinemaSelection, PreferredTimeslot } from "@/types";

export async function GET() {
  const allTrackers = await db
    .select()
    .from(trackers)
    .orderBy(desc(trackers.createdAt));

  return NextResponse.json({
    trackers: allTrackers.map((tracker) => normalizeTracker(tracker)),
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
