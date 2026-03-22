"use client";

import { Film } from "lucide-react";

export function Header() {
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
