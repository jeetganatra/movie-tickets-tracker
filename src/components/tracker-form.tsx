"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TIMESLOT_OPTIONS } from "@/lib/preferences";
import {
  Clapperboard,
  MapPin,
  CalendarDays,
  Loader2,
  Building2,
  Clock3,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type {
  CityInfo,
  CinemaSelection,
  PreferredTimeslot,
} from "@/types";

const DEFAULT_TIMESLOTS: PreferredTimeslot[] = [];

const PLATFORM_META = {
  bookmyshow: {
    label: "BookMyShow",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.08)]",
    accentClass: "text-amber-300",
  },
  district: {
    label: "District",
    className:
      "border-violet-500/20 bg-violet-500/10 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.08)]",
    accentClass: "text-violet-200",
  },
} as const;

interface TrackerFormProps {
  onCreated: () => void;
}

interface CinemasResponse {
  cinemas: CinemaSelection[];
  errors?: string[];
  error?: string;
}

export function TrackerForm({ onCreated }: TrackerFormProps) {
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [movieName, setMovieName] = useState("");
  const [city, setCity] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [cinemas, setCinemas] = useState<CinemaSelection[]>([]);
  const [selectedCinemaIds, setSelectedCinemaIds] = useState<string[]>([]);
  const [preferredTimeslots, setPreferredTimeslots] =
    useState<PreferredTimeslot[]>(DEFAULT_TIMESLOTS);
  const [cinemaRequestKey, setCinemaRequestKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cinemaLoading, setCinemaLoading] = useState(false);
  const [cinemaErrors, setCinemaErrors] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/cities")
      .then((r) => r.json())
      .then((data) => setCities(data.cities))
      .catch(() => toast.error("Failed to load cities"));
  }, []);

  useEffect(() => {
    if (!city) {
      setCinemas([]);
      setSelectedCinemaIds([]);
      setCinemaErrors([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    async function loadCinemas() {
      setCinemaLoading(true);
      setCinemaErrors([]);
      setSelectedCinemaIds([]);

      try {
        const response = await fetch(
          `/api/cinemas?city=${encodeURIComponent(city)}`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as CinemasResponse;

        if (!response.ok) {
          throw new Error(data.error || "Failed to load cinemas");
        }

        setCinemas(data.cinemas || []);
        setCinemaErrors(data.errors || []);
      } catch (error) {
        if (controller.signal.aborted) {
          setCinemas([]);
          setCinemaErrors([
            "Cinema sync timed out. Retry to keep the BookMyShow bot-safe fetch path, or switch cities and back.",
          ]);
          return;
        }

        setCinemas([]);
        setCinemaErrors([
          error instanceof Error ? error.message : "Failed to load cinemas",
        ]);
      } finally {
        clearTimeout(timeoutId);
        setCinemaLoading(false);
      }
    }

    loadCinemas();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [city, cinemaRequestKey]);

  const today = new Date().toISOString().split("T")[0];

  const selectedCinemas = useMemo(
    () =>
      cinemas.filter((cinema) => selectedCinemaIds.includes(cinema.id)),
    [cinemas, selectedCinemaIds]
  );

  const cinemasByPlatform = useMemo(() => {
    return {
      bookmyshow: cinemas.filter((cinema) => cinema.platform === "bookmyshow"),
      district: cinemas.filter((cinema) => cinema.platform === "district"),
    };
  }, [cinemas]);

  function toggleCinema(cinemaId: string) {
    setSelectedCinemaIds((current) =>
      current.includes(cinemaId)
        ? current.filter((id) => id !== cinemaId)
        : [...current, cinemaId]
    );
  }

  function toggleTimeslot(timeslot: PreferredTimeslot) {
    setPreferredTimeslots((current) =>
      current.includes(timeslot)
        ? current.filter((value) => value !== timeslot)
        : [...current, timeslot]
    );
  }

  function validate() {
    const newErrors: Record<string, string> = {};

    if (!movieName.trim()) newErrors.movieName = "Movie name is required";
    if (!city) newErrors.city = "Select a city";
    if (!preferredDate) newErrors.preferredDate = "Select a date";
    else if (preferredDate < today)
      newErrors.preferredDate = "Date must be today or later";
    if (selectedCinemas.length === 0)
      newErrors.preferredCinemas = "Select at least one exact cinema";
    if (preferredTimeslots.length === 0)
      newErrors.preferredTimeslots = "Pick at least one timeslot";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieName: movieName.trim(),
          city,
          preferredDate,
          preferredCinemas: selectedCinemas,
          preferredTimeslots,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create tracker");
        return;
      }

      toast.success(`Now tracking "${movieName.trim()}"`, {
        description: "We'll alert you only when your venue and timeslot match.",
      });

      setMovieName("");
      setCity("");
      setPreferredDate("");
      setCinemas([]);
      setSelectedCinemaIds([]);
      setPreferredTimeslots(DEFAULT_TIMESLOTS);
      setCinemaErrors([]);
      setErrors({});
      onCreated();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="relative overflow-hidden border-amber-500/10 bg-card/80 backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

      <div className="pointer-events-none absolute -right-20 top-10 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl tracking-wide text-foreground">
              TRACK A MOVIE
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Lock the movie, city, exact platform cinema, and the show window
              you actually want.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-amber-200/80">
            <Sparkles className="h-3.5 w-3.5" />
            Live venue names from BMS + District
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="movieName"
              className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Movie Name
            </Label>
            <Input
              id="movieName"
              placeholder="e.g. Pushpa 2, Captain America"
              value={movieName}
              onChange={(e) => setMovieName(e.target.value)}
              className="border-border/50 bg-background/50 placeholder:text-muted-foreground/40 focus:border-amber-500/40"
            />
            {errors.movieName && (
              <p className="text-xs text-destructive">{errors.movieName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="city"
                className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"
              >
                <MapPin className="h-3.5 w-3.5" />
                City
              </Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="border-border/50 bg-background/50 focus:border-amber-500/40">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent className="border-border/50 bg-popover">
                  {cities.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && (
                <p className="text-xs text-destructive">{errors.city}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="date"
                className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Preferred Date
              </Label>
              <Input
                id="date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={today}
                className="border-border/50 bg-background/50 focus:border-amber-500/40"
              />
              {errors.preferredDate && (
                <p className="text-xs text-destructive">
                  {errors.preferredDate}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/50 bg-black/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  Exact Cinemas
                </Label>
                <p className="mt-1 text-sm text-muted-foreground/80">
                  Choose the exact cinema names as listed on each platform.
                </p>
              </div>

              {city && (
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
                    {cinemaLoading ? "Syncing live venues" : `${cinemas.length} venues loaded`}
                  </div>
                  {!cinemaLoading && (
                    <button
                      type="button"
                      onClick={() => setCinemaRequestKey((value) => value + 1)}
                      className="rounded-full border border-border/50 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70 transition-colors hover:border-amber-500/30 hover:text-amber-200"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {!city && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-5 text-sm text-muted-foreground/70">
                Select a city to load exact cinema names from BookMyShow and District.
              </div>
            )}

            {city && cinemaLoading && (
              <div className="grid gap-3 md:grid-cols-2">
                {[...Array(4)].map((_, index) => (
                  <div
                    key={index}
                    className="h-14 rounded-xl border border-border/50 bg-background/40 animate-pulse"
                  />
                ))}
              </div>
            )}

            {city && !cinemaLoading && (
              <div className="space-y-3">
                {(Object.keys(cinemasByPlatform) as Array<keyof typeof cinemasByPlatform>).map(
                  (platform) => {
                    const entries = cinemasByPlatform[platform];
                    const meta = PLATFORM_META[platform];

                    return (
                      <div
                        key={platform}
                        className={cn(
                          "rounded-2xl border p-4",
                          meta.className
                        )}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className={cn("text-sm font-semibold", meta.accentClass)}>
                              {meta.label}
                            </p>
                            <p className="text-xs text-muted-foreground/80">
                              {entries.length > 0
                                ? "Select the exact venue entries to watch."
                                : "No venues could be loaded for this platform right now."}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground/70">
                            {entries.length}
                          </span>
                        </div>

                        {entries.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {entries.map((cinema) => {
                              const selected = selectedCinemaIds.includes(cinema.id);

                              return (
                                <button
                                  key={cinema.id}
                                  type="button"
                                  onClick={() => toggleCinema(cinema.id)}
                                  className={cn(
                                    "rounded-xl border px-3 py-3 text-left text-sm transition-all",
                                    selected
                                      ? "border-white/30 bg-white/12 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                                      : "border-white/10 bg-black/10 text-muted-foreground hover:border-white/20 hover:bg-white/6"
                                  )}
                                >
                                  <span className="block leading-snug">{cinema.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-muted-foreground/70">
                            Try again later if the platform directory is temporarily blocked.
                          </div>
                        )}
                      </div>
                    );
                  }
                )}

                {cinemaErrors.length > 0 && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200/80">
                    {cinemaErrors.join(" ")}
                  </div>
                )}
              </div>
            )}

            {errors.preferredCinemas && (
              <p className="text-xs text-destructive">{errors.preferredCinemas}</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/50 bg-black/10 p-4">
            <div>
              <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Preferred Timeslots
              </Label>
              <p className="mt-1 text-sm text-muted-foreground/80">
                Pick one or more show windows you want to track.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {TIMESLOT_OPTIONS.map((option) => {
                const selected = preferredTimeslots.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleTimeslot(option.value)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-all",
                      selected
                        ? "border-amber-500/40 bg-amber-500/12 text-amber-50 shadow-[0_8px_24px_rgba(245,158,11,0.12)]"
                        : "border-border/50 bg-background/40 text-muted-foreground hover:border-amber-500/20 hover:bg-amber-500/6"
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground/80">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {errors.preferredTimeslots && (
              <p className="text-xs text-destructive">
                {errors.preferredTimeslots}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || cinemaLoading}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-500 font-display text-lg tracking-wider text-black transition-all hover:from-amber-500 hover:to-amber-400 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                CREATING TRACKER...
              </>
            ) : (
              "START TRACKING"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
