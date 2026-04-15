'use client';

import PlayerCard from '@/components/PlayerCard';
import { type PlayerRole, type TeamCode } from '@/config/players';
import { useGetAllPlayersSupply } from '@/hooks/useContract';
import { useMemo, useState } from 'react';

const TEAMS: { code: TeamCode | 'ALL'; label: string }[] = [
  { code: 'ALL', label: 'All Teams' },
  { code: 'IU', label: 'Islamabad United' },
  { code: 'PZ', label: 'Peshawar Zalmi' },
  { code: 'QG', label: 'Quetta Gladiators' },
  { code: 'LQ', label: 'Lahore Qalandars' },
  { code: 'SS', label: 'Sialkot Stallions' },
  { code: 'KK', label: 'Karachi Kings' },
  { code: 'RW', label: 'Rawalpindi Team' },
  { code: 'HK', label: 'Hyderabad Kingsmen' },
];

const ROLES: (PlayerRole | 'All')[] = [
  'All',
  'Batsman',
  'Bowler',
  'All-rounder',
  'Wicketkeeper',
];

const SORT_OPTIONS = [
  { value: 'price-desc', label: 'Price High→Low' },
  { value: 'price-asc', label: 'Price Low→High' },
  { value: 'supply-asc', label: 'Supply Low' },
  { value: 'tier', label: 'Tier (Legend first)' },
];

export default function Market() {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamCode | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'All'>('All');
  const [sort, setSort] = useState('tier');

  // Fetch real-time supply data from blockchain
  const { players: PLAYERS, isLoading } = useGetAllPlayersSupply();

  const filtered = useMemo(() => {
    let result = [...PLAYERS];
    if (search)
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.symbol.toLowerCase().includes(search.toLowerCase()),
      );
    if (teamFilter !== 'ALL') result = result.filter((p) => p.team === teamFilter);
    if (roleFilter !== 'All') result = result.filter((p) => p.role === roleFilter);

    const tierOrder: Record<string, number> = { Legend: 0, Star: 1, Regular: 2 };
    switch (sort) {
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'supply-asc':
        result.sort((a, b) => a.supply - b.supply);
        break;
      case 'tier':
        result.sort(
          (a, b) => (tierOrder[a.tier] ?? 3) - (tierOrder[b.tier] ?? 3),
        );
        break;
    }
    return result;
  }, [search, teamFilter, roleFilter, sort, PLAYERS]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 animate-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Filters */}
      <div className="sticky top-[57px] z-40 -mx-4 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              id="search-players"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol…"
              className="w-full rounded-lg border border-border bg-muted pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Role filter */}
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === r
                    ? 'bg-secondary/20 text-secondary border border-secondary'
                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Team filter — scrollable row */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {TEAMS.map((t) => (
            <button
              key={t.code}
              onClick={() => setTeamFilter(t.code)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                teamFilter === t.code
                  ? 'bg-primary/20 text-primary border border-primary'
                  : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="mt-4 text-xs text-muted-foreground">
        Showing {filtered.length} of {PLAYERS.length} players
      </p>

      {/* Players Grid */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p, i) => (
          <PlayerCard key={p.id} player={p} index={i} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex min-h-[400px] items-center justify-center text-center">
          <div>
            <p className="text-lg text-muted-foreground">No players found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your filters
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
