import type { ShowInfo } from "../scrapers/types";

export function buildTicketFoundEmail(
  movieName: string,
  city: string,
  date: string,
  bmsShows: ShowInfo[],
  districtShows: ShowInfo[]
): { subject: string; html: string } {
  const subject = `Tickets Available: ${movieName} in ${city} on ${formatDate(date)}`;

  const bmsRows = bmsShows
    .map(
      (s) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">BookMyShow</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">${s.theaterName}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">${s.showtime}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">${s.format}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a;">
          <span style="color: #22c55e; font-weight: 600;">${s.availabilityStatus}</span>
        </td>
      </tr>`
    )
    .join("");

  const districtRows = districtShows
    .map(
      (s) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">District</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">${s.theaterName}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">${s.showtime}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a; color: #e0e0e0;">${s.format}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #2a2a2a;">
          <span style="color: #22c55e; font-weight: 600;">${s.availabilityStatus}</span>
        </td>
      </tr>`
    )
    .join("");

  const showTable =
    bmsRows || districtRows
      ? `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #1a1a1a; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #2a2a2a;">
          <th style="padding: 12px 14px; text-align: left; color: #f59e0b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Platform</th>
          <th style="padding: 12px 14px; text-align: left; color: #f59e0b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Theater</th>
          <th style="padding: 12px 14px; text-align: left; color: #f59e0b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time</th>
          <th style="padding: 12px 14px; text-align: left; color: #f59e0b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Format</th>
          <th style="padding: 12px 14px; text-align: left; color: #f59e0b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${bmsRows}${districtRows}
      </tbody>
    </table>`
      : "";

  const bmsLink =
    bmsShows.length > 0
      ? `<a href="https://in.bookmyshow.com" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; margin-right: 12px; margin-bottom: 8px;">Book on BookMyShow</a>`
      : "";

  const districtLink =
    districtShows.length > 0
      ? `<a href="https://www.district.in/movies" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; margin-bottom: 8px;">Book on District</a>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;">

    <!-- Header -->
    <div style="text-align: center; padding: 32px 0 24px;">
      <div style="font-size: 28px; margin-bottom: 4px;">🎬</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
        <span style="color: #f59e0b;">Movie</span><span style="color: #e0e0e0;">Tracker</span>
      </h1>
    </div>

    <!-- Main Card -->
    <div style="background: #141414; border: 1px solid #2a2a2a; border-radius: 16px; padding: 32px; margin-bottom: 24px;">

      <!-- Success Banner -->
      <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.1)); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px;">
        <div style="font-size: 36px; margin-bottom: 8px;">🎉</div>
        <h2 style="margin: 0; color: #f59e0b; font-size: 20px; font-weight: 700;">Tickets Are Available!</h2>
        <p style="margin: 8px 0 0; color: #d4a574; font-size: 14px;">Rush to book before they sell out!</p>
      </div>

      <!-- Movie Details -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px; color: #ffffff; font-size: 22px; font-weight: 700;">${movieName}</h3>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <span style="background: #1f1f1f; color: #a0a0a0; padding: 6px 14px; border-radius: 20px; font-size: 13px;">📍 ${city}</span>
          <span style="background: #1f1f1f; color: #a0a0a0; padding: 6px 14px; border-radius: 20px; font-size: 13px;">📅 ${formatDate(date)}</span>
        </div>
      </div>

      <!-- Shows Table -->
      ${showTable}

      <!-- Action Buttons -->
      <div style="text-align: center; padding: 8px 0 0;">
        ${bmsLink}${districtLink}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px 0;">
      <p style="margin: 0; color: #555; font-size: 12px;">
        You received this because you set up a tracker on MovieTracker.<br>
        Your tracker has been paused automatically.
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
