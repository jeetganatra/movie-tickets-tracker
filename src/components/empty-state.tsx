"use client";

import { Ticket } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Decorative ticket icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl" />
        <div className="relative rounded-2xl border border-dashed border-amber-500/20 bg-card/50 p-6">
          <Ticket className="h-10 w-10 text-amber-500/40" />
        </div>
      </div>

      <h3 className="font-display text-2xl tracking-wide text-muted-foreground/70">
        NO ACTIVE TRACKERS
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground/50">
        Start by adding a movie above. We&apos;ll check BookMyShow and District
        every 5 minutes and email you the moment tickets drop.
      </p>

      {/* Decorative dots */}
      <div className="mt-8 flex items-center gap-1.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-1 w-1 rounded-full bg-amber-500/20"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}
