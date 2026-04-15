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
  { value: 'price-desc', label: 'Price High to Low' },
  { value: 'price-asc', label: 'Price Low to High' },
  { value: 'supply-asc', label: 'Supply Low' },
  { value: 'tier', label: 'Tier (Legend first)' },
];

export default function Market() {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamCode | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'All'>('All');
  const [sort, setSort] = useState('tier');

  const { players: PLAYERS, isLoading } = useGetAllPlayersSupply();

  const filtered = useMemo(() => {
    let result = [...PLAYERS];

    if (search) {
      result = result.filter(
        (player) =>
          player.name.toLowerCase().includes(search.toLowerCase()) ||
          player.symbol.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (teamFilter !== 'ALL') {
      result = result.filter((player) => player.team === teamFilter);
    }

    if (roleFilter !== 'All') {
      result = result.filter((player) => player.role === roleFilter);
    }

    const tierOrder: Record<string, number> = {
      Legend: 0,
      Star: 1,
      Regular: 2,
    };

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
  }, [PLAYERS, roleFilter, search, sort, teamFilter]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-4 sm:py-6">
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[390px] animate-shimmer rounded-[1.75rem]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-4 sm:py-6">
      <div className="sticky top-[65px] z-40 -mx-4 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-xl md:top-[57px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="relative w-full lg:min-w-[240px] lg:flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
              placeholder="Search by name or symbol..."
              className="w-full rounded-lg border border-border bg-muted py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-[1.2]">
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    roleFilter === role
                      ? 'border-secondary bg-secondary/20 text-secondary'
                      : 'border-transparent bg-muted text-muted-foreground hover:border-border'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground focus:outline-none sm:w-auto"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {TEAMS.map((team) => (
            <button
              key={team.code}
              onClick={() => setTeamFilter(team.code)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                teamFilter === team.code
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-transparent bg-muted text-muted-foreground hover:border-border'
              }`}
            >
              {team.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Showing {filtered.length} of {PLAYERS.length} players
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((player, index) => (
          <PlayerCard key={player.id} player={player} index={index} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex min-h-[320px] items-center justify-center text-center sm:min-h-[400px]">
          <div>
            <p className="text-lg text-muted-foreground">No players found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your filters
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
