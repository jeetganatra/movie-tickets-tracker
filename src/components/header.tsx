"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { Film, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="relative py-12 text-center">
      {/* Spotlight glow behind header */}
      <div
        className="pointer-events-none absolute inset-0 -top-20"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(245, 158, 11, 0.08), transparent)",
        }}
      />

      <div className="relative">
        <div className="mb-8 flex items-center justify-end gap-3 text-left">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-border/60"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card text-xs font-semibold text-foreground">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            {user.name && (
              <p className="truncate text-xs font-medium text-foreground">
                {user.name}
              </p>
            )}
            <p className="max-w-52 truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Sign out"
            className="h-8 w-8 border-border/60"
            onClick={() => signOut({ callbackUrl: "/signin" })}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Icon */}
        <div className="mb-4 inline-flex items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
          <Film className="h-7 w-7 text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="font-display text-6xl tracking-wide sm:text-7xl">
          <span className="text-amber-500">MOVIE</span>
          <span className="text-foreground">TRACKER</span>
        </h1>

        {/* Tagline */}
        <p className="mt-3 text-sm tracking-widest text-muted-foreground uppercase">
          Never miss a movie release again
        </p>

        {/* Decorative line */}
        <div className="mx-auto mt-6 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500/40" />
          <div className="h-1.5 w-1.5 rotate-45 bg-amber-500/60" />
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500/40" />
        </div>
      </div>
    </header>
  );
}
