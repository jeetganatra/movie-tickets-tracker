"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { TrackerCard } from "./tracker-card";
import { EmptyState } from "./empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tracker } from "@/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.statusText || "Request failed");
  }

  return response.json();
};

interface TrackerListProps {
  refreshKey: number;
}

export function TrackerList({ refreshKey }: TrackerListProps) {
  const { data, error, isLoading, mutate } = useSWR<{ trackers: Tracker[] }>(
    "/api/trackers",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  useEffect(() => {
    if (refreshKey > 0) {
      mutate();
    }
  }, [refreshKey, mutate]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton
            key={i}
            className="h-32 w-full rounded-xl bg-card/50"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">
          Failed to load trackers. Please refresh the page.
        </p>
      </div>
    );
  }

  const trackers = data?.trackers || [];

  if (trackers.length === 0) {
    return <EmptyState />;
  }

  // Sort: active first, then found, then paused, then expired/error
  const statusOrder: Record<string, number> = {
    active: 0,
    found: 1,
    paused: 2,
    error: 3,
    expired: 4,
  };

  const sorted = [...trackers].sort(
    (a, b) =>
      (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
  );

  return (
    <div className="space-y-3">
      {sorted.map((tracker, index) => (
        <TrackerCard
          key={tracker.id}
          tracker={tracker}
          onUpdate={() => mutate()}
          index={index}
        />
      ))}
    </div>
  );
}
