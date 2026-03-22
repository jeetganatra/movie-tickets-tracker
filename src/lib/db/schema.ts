import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const trackers = sqliteTable("trackers", {
  id: text("id").primaryKey(),
  movieName: text("movie_name").notNull(),
  city: text("city").notNull(),
  preferredDate: text("preferred_date").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("active"),
  bmsRegionCode: text("bms_region_code").notNull(),
  bmsSlug: text("bms_slug").notNull(),
  districtCitySlug: text("district_city_slug").notNull(),
  preferredCinemas: text("preferred_cinemas").notNull().default("[]"),
  preferredTimeslots: text("preferred_timeslots").notNull().default("[]"),
  lastCheckedAt: text("last_checked_at"),
  lastError: text("last_error"),
  checkCount: integer("check_count").notNull().default(0),
  notifiedAt: text("notified_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const checkResults = sqliteTable("check_results", {
  id: text("id").primaryKey(),
  trackerId: text("tracker_id")
    .notNull()
    .references(() => trackers.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  found: integer("found").notNull().default(0),
  rawData: text("raw_data"),
  errorMessage: text("error_message"),
  checkedAt: text("checked_at").notNull(),
});
