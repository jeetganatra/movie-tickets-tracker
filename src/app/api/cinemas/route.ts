import { NextRequest, NextResponse } from "next/server";
import { fetchCityCinemas } from "@/lib/cinemas";
import { getCityByName } from "@/lib/cities";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "city is required" },
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

  try {
    const { cinemas, errors } = await fetchCityCinemas(cityInfo);

    return NextResponse.json({
      cinemas,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch cinemas",
      },
      { status: 500 }
    );
  }
}
