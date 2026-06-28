import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  trackers,
  users,
  verificationTokens,
} from "@/lib/db/schema";

const parseAllowedEmails = (value?: string) =>
  new Set(
    (value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

const ALLOWED_EMAILS = parseAllowedEmails(
  process.env.ALLOWED_GOOGLE_EMAILS || process.env.ALLOWED_GOOGLE_EMAIL
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    signIn({ user, profile }) {
      const email = user.email?.toLowerCase();
      const emailVerified =
        !profile || !("email_verified" in profile) || profile.email_verified;

      return (
        Boolean(email) &&
        emailVerified === true &&
        (ALLOWED_EMAILS.size === 0 || ALLOWED_EMAILS.has(email!))
      );
    },
    session({ session, user }) {
      return {
        expires: session.expires,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      };
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id || !user.email) {
        return;
      }

      await db
        .update(trackers)
        .set({
          userId: user.id,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            isNull(trackers.userId),
            eq(trackers.email, user.email.toLowerCase())
          )
        );
    },
  },
});
