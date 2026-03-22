"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { TrackerForm } from "@/components/tracker-form";
import { TrackerList } from "@/components/tracker-list";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
        <Header />

        {/* Tracker Form */}
        <section className="animate-fade-in-up">
          <TrackerForm onCreated={() => setRefreshKey((k) => k + 1)} />
        </section>

        {/* Divider */}
        <div className="my-10 flex items-center gap-4">
          <Separator className="flex-1 bg-border/50" />
          <span className="font-display text-lg tracking-widest text-muted-foreground/50">
            YOUR TRACKERS
          </span>
          <Separator className="flex-1 bg-border/50" />
        </div>

        {/* Tracker List */}
        <section>
          <TrackerList refreshKey={refreshKey} />
        </section>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <div className="mx-auto flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-border" />
            <p className="text-xs tracking-wider text-muted-foreground/40">
              Checks BookMyShow & District every 5 minutes
            </p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-border" />
          </div>
        </footer>
      </div>
    </div>
  );
}
