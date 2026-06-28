import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";
import { getAuthenticatedUser } from "@/lib/auth-user";

export async function GET() {
  if (!(await getAuthenticatedUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ cities: CITIES });
}
