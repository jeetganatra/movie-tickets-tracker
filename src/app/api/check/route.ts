import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackers, checkResults, users } from "@/lib/db/schema";
import { getAuthenticatedUser } from "@/lib/auth-user";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/email/sender";
import { buildTicketFoundEmail } from "@/lib/email/templates";
import { runTrackerCheck } from "@/lib/tracker-check";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { trackerId } = body;

    if (!trackerId) {
      return NextResponse.json(
        { error: "trackerId is required" },
        { status: 400 }
      );
    }

    const trackerRows = await db
      .select({
        tracker: trackers,
        ownerEmail: users.email,
      })
      .from(trackers)
      .innerJoin(users, eq(trackers.userId, users.id))
      .where(
        and(eq(trackers.id, trackerId), eq(trackers.userId, user.id))
      )
      .limit(1);

    if (trackerRows.length === 0) {
      return NextResponse.json(
        { error: "Tracker not found" },
        { status: 404 }
      );
    }

    const { tracker: t, ownerEmail } = trackerRows[0];

    // Check if date has passed
    const preferredDate = new Date(t.preferredDate + "T23:59:59");
    if (preferredDate < new Date()) {
      await db
        .update(trackers)
        .set({ status: "expired", updatedAt: new Date().toISOString() })
        .where(eq(trackers.id, trackerId));

      return NextResponse.json({
        message: "Tracker expired - date has passed",
        bms: { found: false, shows: [] },
        district: { found: false, shows: [] },
      });
    }

    // Run both scrapers in parallel
    const { tracker: normalizedTracker, bmsResult, districtResult } =
      await runTrackerCheck(t);

    const now = new Date().toISOString();

    // Store check results
    await db.insert(checkResults).values([
      {
        id: uuidv4(),
        trackerId,
        platform: "bookmyshow",
        found: bmsResult.found ? 1 : 0,
        rawData: JSON.stringify(bmsResult.shows),
        errorMessage: bmsResult.error || null,
        checkedAt: now,
      },
      {
        id: uuidv4(),
        trackerId,
        platform: "district",
        found: districtResult.found ? 1 : 0,
        rawData: JSON.stringify(districtResult.shows),
        errorMessage: districtResult.error || null,
        checkedAt: now,
      },
    ]);

    // Update tracker
    const ticketsFound = bmsResult.found || districtResult.found;
    const errors = [bmsResult.error, districtResult.error]
      .filter(Boolean)
      .join("; ");

    const updateData: Record<string, unknown> = {
      lastCheckedAt: now,
      checkCount: t.checkCount + 1,
      lastError: errors || null,
      updatedAt: now,
    };

    if (ticketsFound && !t.notifiedAt) {
      // Send notification email
      const { subject, html } = buildTicketFoundEmail(
        normalizedTracker.movieName,
        normalizedTracker.city,
        normalizedTracker.preferredDate,
        bmsResult.shows,
        districtResult.shows
      );

      const emailSent = await sendEmail(
        ownerEmail || normalizedTracker.email,
        subject,
        html
      );

      if (emailSent) {
        updateData.status = "found";
        updateData.notifiedAt = now;
      } else {
        // Email failed - keep status active to retry next cycle
        updateData.lastError = (errors ? errors + "; " : "") + "Email send failed";
      }
    }

    await db
      .update(trackers)
      .set(updateData)
      .where(eq(trackers.id, trackerId));

    return NextResponse.json({
      message: ticketsFound ? "Tickets found!" : "No tickets yet",
      bms: bmsResult,
      district: districtResult,
    });
  } catch (error) {
    console.error("Check error:", error);
    return NextResponse.json(
      { error: "Check failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
