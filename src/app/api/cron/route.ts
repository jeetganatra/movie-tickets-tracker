import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackers, checkResults } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/email/sender";
import { buildTicketFoundEmail } from "@/lib/email/templates";
import { delay } from "@/lib/scrapers/browser";
import { runTrackerCheck } from "@/lib/tracker-check";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active trackers
    const activeTrackers = await db
      .select()
      .from(trackers)
      .where(eq(trackers.status, "active"))
      .orderBy(asc(trackers.lastCheckedAt), asc(trackers.createdAt))
      .limit(20);

    if (activeTrackers.length === 0) {
      return NextResponse.json({ message: "No active trackers", checked: 0 });
    }

    const results: {
      trackerId: string;
      movieName: string;
      found: boolean;
      error?: string;
    }[] = [];

    // Process the stalest trackers first (max 20 per cycle)
    for (const t of activeTrackers) {
      // Check if date has passed
      const preferredDate = new Date(t.preferredDate + "T23:59:59");
      if (preferredDate < new Date()) {
        await db
          .update(trackers)
          .set({ status: "expired", updatedAt: new Date().toISOString() })
          .where(eq(trackers.id, t.id));

        results.push({
          trackerId: t.id,
          movieName: t.movieName,
          found: false,
          error: "Expired",
        });
        continue;
      }

      try {
        // Run both scrapers in parallel
        const { tracker: normalizedTracker, bmsResult, districtResult } =
          await runTrackerCheck(t);

        const now = new Date().toISOString();

        // Store check results
        await db.insert(checkResults).values([
          {
            id: uuidv4(),
            trackerId: t.id,
            platform: "bookmyshow",
            found: bmsResult.found ? 1 : 0,
            rawData: JSON.stringify(bmsResult.shows),
            errorMessage: bmsResult.error || null,
            checkedAt: now,
          },
          {
            id: uuidv4(),
            trackerId: t.id,
            platform: "district",
            found: districtResult.found ? 1 : 0,
            rawData: JSON.stringify(districtResult.shows),
            errorMessage: districtResult.error || null,
            checkedAt: now,
          },
        ]);

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
          const { subject, html } = buildTicketFoundEmail(
            normalizedTracker.movieName,
            normalizedTracker.city,
            normalizedTracker.preferredDate,
            bmsResult.shows,
            districtResult.shows
          );

          const emailSent = await sendEmail(
            normalizedTracker.email,
            subject,
            html
          );

          if (emailSent) {
            updateData.status = "found";
            updateData.notifiedAt = now;
          } else {
            updateData.lastError = (errors ? errors + "; " : "") + "Email send failed";
          }
        }

        const trackerError =
          typeof updateData.lastError === "string" ? updateData.lastError : undefined;

        await db
          .update(trackers)
          .set(updateData)
          .where(eq(trackers.id, t.id));

        results.push({
          trackerId: t.id,
          movieName: t.movieName,
          found: ticketsFound,
          error: trackerError,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Cron] Error checking tracker ${t.id}:`, errMsg);

        await db
          .update(trackers)
          .set({
            lastError: errMsg,
            lastCheckedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(trackers.id, t.id));

        results.push({
          trackerId: t.id,
          movieName: t.movieName,
          found: false,
          error: errMsg,
        });
      }

      // Stagger between trackers
      await delay(3000);
    }

    return NextResponse.json({
      message: `Checked ${results.length} trackers`,
      checked: results.length,
      results,
    });
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
