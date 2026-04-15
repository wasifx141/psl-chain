'use client';

import Link from "next/link";
import { Player, TEAM_COLORS } from "@/config/players";
import { formatNumber, getSupplyColorClass } from "@/utils/format";

function Sparkline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 20" className={className} fill="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(42 92% 56%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(42 92% 56%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 18 Q5 15 10 14 T20 10 T30 12 T40 6 T50 4 T60 2"
        stroke="hsl(42 92% 56%)"
        strokeWidth="1.5"
      />
      <path
        d="M0 18 Q5 15 10 14 T20 10 T30 12 T40 6 T50 4 T60 2 V20 H0Z"
        fill="url(#sparkGrad)"
      />
    </svg>
  );
}

export default function PlayerCard({
  player,
  index = 0,
}: {
  player: Player;
  index?: number;
}) {
  const colors = TEAM_COLORS[player.team];
  const supplyPct = (player.supply / player.maxSupply) * 100;

  return (
    <Link
      href={`/player/${player.id}`}
      className="group block rounded-xl card-surface p-4 transition-all hover:shadow-lg card-3d sm:p-5"
      style={{
        animationDelay: `${index * 0.1}s`,
        borderColor: "hsl(222 30% 18%)",
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-base font-bold ring-2 sm:h-[72px] sm:w-[72px] sm:text-lg"
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            boxShadow: `0 0 0 2px ${colors.border}`,
            color: "white",
          }}
        >
          {player.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-foreground">
            {player.name}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${colors.from}22`, color: colors.from }}
            >
              {player.teamName}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {player.role}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-3 min-h-5">
        {player.tier === "Legend" ? (
          <span className="text-xs font-semibold text-primary">Legend</span>
        ) : null}
        {player.tier === "Star" ? (
          <span className="text-xs font-semibold text-secondary">Star</span>
        ) : null}
        {player.tier === "Regular" ? (
          <span className="text-xs text-muted-foreground">Regular</span>
        ) : null}
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-primary">
          {formatNumber(player.price)} WC
        </span>
        <span
          className={`text-xs font-medium ${
            player.priceChange >= 0 ? "text-green" : "text-red"
          }`}
        >
          {player.priceChange >= 0 ? "+" : ""}
          {formatNumber(player.priceChange, 1)}%
        </span>
      </div>

      <Sparkline className="mb-3 h-5 w-full" />

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span className="pr-2">
            {player.supply} / {player.maxSupply} tokens left
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${getSupplyColorClass(
              player.supply,
              player.maxSupply,
            )}`}
            style={{ width: `${supplyPct}%` }}
          />
        </div>
      </div>

      <button className="w-full rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80">
        View Details
      </button>
    </Link>
  );
}
