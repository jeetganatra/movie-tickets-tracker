import assert from "node:assert/strict";
import test from "node:test";
import { filterShowsForPreferences } from "./preferences";
import { extractShowtimesFromBodyText, requestedDateToDisplayKey } from "./scrapers/bookmyshow";
import type { CinemaSelection, PreferredTimeslot, ShowInfo } from "@/types";

const alluCinema: CinemaSelection = {
  id: "bookmyshow:allu cinemas kokapet",
  platform: "bookmyshow",
  name: "ALLU Cinemas: Kokapet",
};

test("September opening weekend matches BMS date labels", () => {
  assert.equal(requestedDateToDisplayKey("2026-09-25"), "FRI 25 SEP");
  assert.equal(requestedDateToDisplayKey("2026-09-26"), "SAT 26 SEP");
  assert.equal(requestedDateToDisplayKey("2026-09-27"), "SUN 27 SEP");
});

const allTimes: PreferredTimeslot[] = [
  "morning",
  "afternoon",
  "evening",
  "night",
];

const shows: ShowInfo[] = [
  {
    theaterName: "ALLU Cinemas: Kokapet",
    showtime: "01:25 PM",
    format: "BARCO LASER 4K ATMOS",
    language: "English",
    availabilityStatus: "Available",
  },
  {
    theaterName: "ALLU Cinemas: Kokapet",
    showtime: "04:30 PM",
    format: "DOLBY CINEMA",
    language: "English",
    availabilityStatus: "Available",
  },
];

test("format families accept dimensions without accepting unrelated formats", () => {
  const formats = ["DOLBY CINEMA", "Dolby Cinema 2D", "DOLBY CINEMA 3D", "PCX", "PCX 2D", "PCX 3D", "2D", "3D", "DOLBY ATMOS", "BARCO LASER 4K ATMOS", ""];
  const candidates = formats.map(format => ({ ...shows[0], format }));
  const match = (preferences: string[]) => filterShowsForPreferences("bookmyshow", candidates, [alluCinema], allTimes, preferences).map(show => show.format);
  assert.deepEqual(match(["DOLBY CINEMA"]), formats.slice(0, 3));
  assert.deepEqual(match(["PCX"]), formats.slice(3, 6));
  assert.deepEqual(match(["DOLBY CINEMA 2D"]), ["Dolby Cinema 2D"]);
  assert.deepEqual(match([]), formats);
});

test("mixed formats stay attached to their own showtime and unknown stays unknown", () => {
  const parsed = extractShowtimesFromBodyText("ALLU Cinemas: Kokapet\n10:00 AM\n2D\n07:00 PM\nDOLBY CINEMA 3D\nPrasads Multiplex: Hyderabad\n09:00 PM\nPCX 2D\n11:00 PM\nNon-cancellable", "https://in.bookmyshow.com/");
  assert.deepEqual(parsed.map(s => [s.showtime, s.format]), [["10:00 AM", "2D"], ["07:00 PM", "DOLBY CINEMA 3D"], ["09:00 PM", "PCX 2D"], ["11:00 PM", ""]]);
  assert.deepEqual(filterShowsForPreferences("bookmyshow", parsed, [alluCinema], ["evening", "night"], ["DOLBY CINEMA"]).map(s => s.showtime), ["07:00 PM"]);
});

test("Dolby-only preferences reject other Allu auditorium formats", () => {
  const matches = filterShowsForPreferences(
    "bookmyshow",
    shows,
    [alluCinema],
    allTimes,
    ["DOLBY CINEMA"]
  );

  assert.deepEqual(matches.map((show) => show.format), ["DOLBY CINEMA"]);
});

test("an empty format preference preserves any-format behavior", () => {
  const matches = filterShowsForPreferences(
    "bookmyshow",
    shows,
    [alluCinema],
    allTimes,
    []
  );

  assert.equal(matches.length, 2);
});
