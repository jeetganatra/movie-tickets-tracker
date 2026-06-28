import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackers, checkResults } from "@/lib/db/schema";
import { getAuthenticatedUser } from "@/lib/auth-user";
import { normalizeTracker } from "@/lib/preferences";
import { and, eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracker = await db
    .select()
    .from(trackers)
    .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
    .limit(1);

  if (tracker.length === 0) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 });
  }

  const results = await db
    .select()
    .from(checkResults)
    .where(eq(checkResults.trackerId, id))
    .orderBy(desc(checkResults.checkedAt))
    .limit(20);

  return NextResponse.json({
    tracker: { ...normalizeTracker(tracker[0]), email: user.email },
    checkResults: results,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  const validStatuses = ["active", "paused", "expired"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be one of: " + validStatuses.join(", ") },
      { status: 400 }
    );
  }

  const existing = await db
    .select()
    .from(trackers)
    .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 });
  }

  await db
    .update(trackers)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)));

  const updated = await db
    .select()
    .from(trackers)
    .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
    .limit(1);

  return NextResponse.json({
    tracker: { ...normalizeTracker(updated[0]), email: user.email },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db
    .select()
    .from(trackers)
    .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 });
  }

  // Delete check results first, then tracker
  await db.delete(checkResults).where(eq(checkResults.trackerId, id));
  await db
    .delete(trackers)
    .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)));

  return NextResponse.json({ success: true });
}
