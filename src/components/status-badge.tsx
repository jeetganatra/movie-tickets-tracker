"use client";

import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, Clock, Pause, AlertTriangle } from "lucide-react";

type Status = "active" | "found" | "expired" | "paused" | "error";

const statusConfig: Record<
  Status,
  {
    label: string;
    icon: React.ElementType;
    className: string;
    dotClass?: string;
  }
> = {
  active: {
    label: "Searching",
    icon: Search,
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
    dotClass: "bg-amber-500 animate-pulse-dot",
  },
  found: {
    label: "Tickets Found!",
    icon: CheckCircle2,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
  },
  expired: {
    label: "Expired",
    icon: Clock,
    className:
      "border-zinc-500/30 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/15",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15",
  },
  error: {
    label: "Error",
    icon: AlertTriangle,
    className:
      "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status] || statusConfig.active;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      {config.dotClass ? (
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {config.label}
    </Badge>
  );
}
