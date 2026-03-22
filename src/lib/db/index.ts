import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "movietracker.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS trackers (
    id TEXT PRIMARY KEY,
    movie_name TEXT NOT NULL,
    city TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    bms_region_code TEXT NOT NULL,
    bms_slug TEXT NOT NULL,
    district_city_slug TEXT NOT NULL,
    preferred_cinemas TEXT NOT NULL DEFAULT '[]',
    preferred_timeslots TEXT NOT NULL DEFAULT '[]',
    last_checked_at TEXT,
    last_error TEXT,
    check_count INTEGER NOT NULL DEFAULT 0,
    notified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS check_results (
    id TEXT PRIMARY KEY,
    tracker_id TEXT NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    found INTEGER NOT NULL DEFAULT 0,
    raw_data TEXT,
    error_message TEXT,
    checked_at TEXT NOT NULL
  );
`);

type TableColumn = { name: string };

function ensureTrackerColumn(name: string, definition: string) {
  const columns = sqlite
    .prepare("PRAGMA table_info(trackers)")
    .all() as TableColumn[];

  if (!columns.some((column) => column.name === name)) {
    sqlite.exec(`ALTER TABLE trackers ADD COLUMN ${name} ${definition}`);
  }
}

ensureTrackerColumn("bms_slug", "TEXT NOT NULL DEFAULT ''");
ensureTrackerColumn("preferred_cinemas", "TEXT NOT NULL DEFAULT '[]'");
ensureTrackerColumn("preferred_timeslots", "TEXT NOT NULL DEFAULT '[]'");

export const db = drizzle(sqlite, { schema });
