import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (token) => [
    primaryKey({
      columns: [token.identifier, token.token],
    }),
  ]
);

export const trackers = sqliteTable("trackers", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
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
  preferredFormats: text("preferred_formats").notNull().default("[]"),
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
