"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "./status-badge";
import {
  MapPin,
  CalendarDays,
  Mail,
  Building2,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Loader2,
  ExternalLink,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { Tracker } from "@/types";
import { TIMESLOT_OPTIONS } from "@/lib/preferences";

interface TrackerCardProps {
  tracker: Tracker;
  onUpdate: () => void;
  index: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function TrackerCard({ tracker, onUpdate, index }: TrackerCardProps) {
  const [checkLoading, setCheckLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isFound = tracker.status === "found";
  const isActive = tracker.status === "active";
  const isPaused = tracker.status === "paused";
  const timeslotLabels = tracker.preferredTimeslots.map(
    (timeslot) =>
      TIMESLOT_OPTIONS.find((option) => option.value === timeslot)?.label ||
      timeslot
  );

  async function handleCheckNow() {
    setCheckLoading(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackerId: tracker.id }),
      });
      const data = await res.json();

      if (data.bms?.found || data.district?.found) {
        toast.success("Tickets found!", {
          description: `Tickets for "${tracker.movieName}" are now available!`,
        });
      } else {
        toast.info("No tickets yet", {
          description: "We'll keep checking. Hang tight!",
        });
      }
      onUpdate();
    } catch {
      toast.error("Check failed. Try again.");
    } finally {
      setCheckLoading(false);
    }
  }

  async function handleTogglePause() {
    setActionLoading(true);
    try {
      const newStatus = isPaused ? "active" : "paused";
      await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(
        isPaused ? "Tracker resumed" : "Tracker paused"
      );
      onUpdate();
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      await fetch(`/api/trackers/${tracker.id}`, { method: "DELETE" });
      toast.success("Tracker deleted");
      setDeleteDialogOpen(false);
      onUpdate();
    } catch {
      toast.error("Delete failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <Card
        className={`card-spotlight animate-fade-in-up relative overflow-hidden border-border/50 bg-card/80 opacity-0 backdrop-blur-sm transition-all stagger-${Math.min(index + 1, 5)} ${
          isFound
            ? "animate-glow-pulse border-emerald-500/20"
            : isActive
              ? "animate-shimmer"
              : ""
        }`}
      >
        {/* Left accent stripe */}
        <div
          className={`absolute inset-y-0 left-0 w-1 ${
            isFound
              ? "bg-gradient-to-b from-emerald-500 to-emerald-600"
              : isActive
                ? "bg-gradient-to-b from-amber-500 to-amber-600"
                : isPaused
                  ? "bg-gradient-to-b from-blue-500 to-blue-600"
                  : tracker.status === "error"
                    ? "bg-gradient-to-b from-red-500 to-red-600"
                    : "bg-gradient-to-b from-zinc-600 to-zinc-700"
          }`}
        />

        <CardContent className="p-5 pl-6 sm:p-6 sm:pl-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Movie info */}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h3 className="font-display text-2xl tracking-wide text-foreground truncate">
                  {tracker.movieName.toUpperCase()}
                </h3>
                <StatusBadge
                  status={tracker.status as "active" | "found" | "expired" | "paused" | "error"}
                />
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-500/70" />
                  {tracker.city}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-500/70" />
                  {formatDate(tracker.preferredDate)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-amber-500/70" />
                  <span className="truncate max-w-[180px]">{tracker.email}</span>
                </span>
              </div>

              {/* Status details */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last checked: {timeAgo(tracker.lastCheckedAt)}
                </span>
                <span>Checks: {tracker.checkCount}</span>
                {tracker.notifiedAt && (
                  <span className="text-emerald-400/80">
                    Notified: {timeAgo(tracker.notifiedAt)}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60">
                    <Building2 className="h-3.5 w-3.5" />
                    Exact Cinemas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tracker.preferredCinemas.length > 0 ? (
                      tracker.preferredCinemas.map((cinema) => (
                        <span
                          key={cinema.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                            cinema.platform === "bookmyshow"
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                              : "border-violet-500/20 bg-violet-500/10 text-violet-100"
                          }`}
                        >
                          <span className="font-semibold">
                            {cinema.platform === "bookmyshow" ? "BMS" : "District"}
                          </span>
                          <span>{cinema.name}</span>
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                        Any cinema
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60">
                    Preferred Times
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {timeslotLabels.length > 0 ? (
                      timeslotLabels.map((timeslot) => (
                        <span
                          key={timeslot}
                          className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100"
                        >
                          {timeslot}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                        Any time
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error tooltip */}
              {tracker.lastError && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="mt-2 cursor-help truncate text-xs text-red-400/70">
                      Error: {tracker.lastError}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{tracker.lastError}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Found state: show booking links */}
              {isFound && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`https://in.bookmyshow.com/explore/movies-${tracker.bmsSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 text-xs font-semibold text-black hover:from-amber-500 hover:to-amber-400"
                    >
                      BookMyShow
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                  <a
                    href={`https://www.district.in/movies/${tracker.districtCitySlug}-movie-tickets`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-to-r from-violet-600 to-violet-500 text-xs font-semibold text-white hover:from-violet-500 hover:to-violet-400"
                    >
                      District
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            {!isFound && tracker.status !== "expired" && (
              <div className="flex items-center gap-2 sm:flex-col">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCheckNow}
                      disabled={checkLoading || !isActive}
                      className="gap-1.5 border-border/50 text-xs hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                    >
                      {checkLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Check
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Check for tickets now</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleTogglePause}
                      disabled={actionLoading}
                      className="gap-1.5 border-border/50 text-xs hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400"
                    >
                      {isPaused ? (
                        <Play className="h-3.5 w-3.5" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                      {isPaused ? "Resume" : "Pause"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPaused ? "Resume tracking" : "Pause tracking"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="gap-1.5 border-border/50 text-xs hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete tracker</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Expired/Found: just delete */}
            {(isFound || tracker.status === "expired") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-1.5 border-border/50 text-xs hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete tracker</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-border/50 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">
              DELETE TRACKER
            </DialogTitle>
            <DialogDescription>
              Stop tracking &ldquo;{tracker.movieName}&rdquo; in {tracker.city}?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
