'use client';

import FlipCountdown from "@/components/FlipCountdown";
import PlayerCard from "@/components/PlayerCard";
import { MATCHES, getNextMatch, getTodayMatches } from "@/config/matches";
import { PLAYERS, TEAM_COLORS, TEAM_NAMES } from "@/config/players";
import type { TeamCode } from "@/config/players";
import { useGetAllPlayersSupply, useDatabasePortfolio, useGetPortfolio } from "@/hooks/useContract";
import { useAllMatchResults } from "@/hooks/useMatchResult";
import { calculateRewardShares } from "@/lib/services/fantasyPoints.service";
import { SEASON } from "@/lib/constants";
import AdminMatchResult from "@/components/AdminMatchResult";
import MatchResultCard from "@/components/MatchResultCard";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import Link from "next/link";

export default function MatchCenter() {
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [nextMatch, setNextMatch] = useState<ReturnType<typeof getNextMatch> | null>(null);
  const [todayMatches, setTodayMatches] = useState<ReturnType<typeof getTodayMatches>>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [teamTabFilter, setTeamTabFilter] = useState<string>('ALL');

  const { address } = useAccount();
  const { data: savedResults = [] } = useAllMatchResults();
  const { data: dbPortfolio } = useDatabasePortfolio(address ?? '');
  const { holdings: onChainHoldings } = useGetPortfolio(address ?? '');
  const { players: allPlayersLive } = useGetAllPlayersSupply();

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setCurrentTime(Date.now());
    setNextMatch(getNextMatch());
    setTodayMatches(getTodayMatches());
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Upcoming & past matches ──────────────────────────────────────────────────
  const upcomingMatches = currentTime > 0
    ? MATCHES.filter(m => {
        const matchDate = new Date(m.timestamp);
        const april15 = new Date('April 15, 2026');
        return matchDate >= april15 && m.timestamp > currentTime;
      }).sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const pastMatches = currentTime > 0
    ? MATCHES.filter(m => m.timestamp < currentTime)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
    : [];

  const fallbackDate = new Date('2026-04-16T00:00:00Z');

  const upcomingMatch = nextMatch
    ? {
        teamA: nextMatch.team1 || "TBD",
        teamB: nextMatch.team2 || "TBD",
        date: new Date(nextMatch.timestamp),
        venue: nextMatch.venue,
        stage: nextMatch.stage,
      }
    : { teamA: "TBD", teamB: "TBD", date: fallbackDate, venue: "TBD" };

  const getTeamColors = (teamCode: string) =>
    TEAM_COLORS[teamCode as TeamCode] || { from: "hsl(0 0% 50%)", to: "hsl(0 0% 30%)" };

  const formatMatchDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatMatchTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // ── User's portfolio holdings ──────────────────────────────────────────────
  const userHoldings: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};

    // Priority 1: Supabase portfolio_cache (fast, persisted)
    if (dbPortfolio?.holdings && (dbPortfolio.holdings as any[]).length > 0) {
      for (const h of dbPortfolio.holdings as any[]) {
        const player = PLAYERS.find(p => p.numericId === Number(h.player_id));
        if (player && h.amount > 0) map[player.id] = h.amount;
      }
      return map;
    }

    // Priority 2: On-chain data (full source of truth, slightly slower)
    for (const h of onChainHoldings) {
      if (h.amount > 0) map[h.player.id] = h.amount;
    }
    return map;
  }, [dbPortfolio, onChainHoldings]);

  // ── Players for next match (filtered + searched) ─────────────────────────
  const nextMatchTeams = nextMatch
    ? [nextMatch.team1, nextMatch.team2].filter(Boolean) as string[]
    : [];

  const nextMatchPlayers = useMemo(() => {
    const teamSet = new Set(nextMatchTeams);
    return allPlayersLive.filter(p => teamSet.has(p.team) && userHoldings[p.id]);
  }, [allPlayersLive, nextMatchTeams, userHoldings]);

  const filteredNextMatchPlayers = useMemo(() => {
    let result = nextMatchPlayers;
    // Team tab filter (takes priority over search)
    if (teamTabFilter !== 'ALL') {
      result = result.filter(p => p.team === teamTabFilter);
    }
    if (!playerSearch.trim()) return result;
    const q = playerSearch.toLowerCase();
    return result.filter(
      p => p.name.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
    );
  }, [nextMatchPlayers, playerSearch, teamTabFilter]);

  // Players user holds for next match (for banner)
  const myTokensForNextMatch = useMemo(() => {
    const teamSet = new Set(nextMatchTeams);
    return Object.entries(userHoldings)
      .filter(([playerId]) => {
        const player = PLAYERS.find(p => p.id === playerId);
        return player && teamSet.has(player.team);
      })
      .map(([playerId, tokens]) => ({
        player: PLAYERS.find(p => p.id === playerId)!,
        tokens,
      }))
      .filter(x => x.player);
  }, [userHoldings, nextMatchTeams]);

  // ── Match results & rewards ─────────────────────────────────────────────────
  const holdings = Object.entries(userHoldings).map(([playerId, tokens]) => ({
    playerId,
    tokens,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      {!loaded ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="animate-in fade-in duration-700 space-y-8">

          {/* Today's Matches — Your Players in Action */}
          {todayMatches.length > 0 && (
            <div className="card-surface rounded-xl p-6 border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⚡</span>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Today&apos;s Matches!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {todayMatches.length} match{todayMatches.length > 1 ? 'es' : ''} scheduled today
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {todayMatches.map((match) => (
                  <div key={match.id} className="bg-background/50 rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                          style={{ background: `linear-gradient(135deg, ${getTeamColors(match.team1 || "").from}, ${getTeamColors(match.team1 || "").to})`, color: "white" }}
                        >
                          {match.team1}
                        </div>
                        <span className="text-xl font-bold text-primary font-display">VS</span>
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                          style={{ background: `linear-gradient(135deg, ${getTeamColors(match.team2 || "").from}, ${getTeamColors(match.team2 || "").to})`, color: "white" }}
                        >
                          {match.team2}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{match.venue}</p>
                        <p className="text-xs text-muted-foreground">{formatMatchTime(match.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Next Match Card ──────────────────────────────────────────── */}
          <div className="card-surface rounded-xl p-8">
            <p className="text-center text-xs text-muted-foreground uppercase tracking-wider mb-4 font-semibold">
              {upcomingMatch.stage ? upcomingMatch.stage : "Next Match"}
            </p>

            {/* Team vs Team */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <div
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold mb-2"
                  style={{ background: `linear-gradient(135deg, ${getTeamColors(upcomingMatch.teamA).from}, ${getTeamColors(upcomingMatch.teamA).to})`, color: "white" }}
                >
                  {upcomingMatch.teamA}
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {TEAM_NAMES[upcomingMatch.teamA as TeamCode] ?? upcomingMatch.teamA}
                </p>
              </div>
              <span className="text-3xl font-bold text-primary font-display">VS</span>
              <div className="text-center">
                <div
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold mb-2"
                  style={{ background: `linear-gradient(135deg, ${getTeamColors(upcomingMatch.teamB).from}, ${getTeamColors(upcomingMatch.teamB).to})`, color: "white" }}
                >
                  {upcomingMatch.teamB}
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {TEAM_NAMES[upcomingMatch.teamB as TeamCode] ?? upcomingMatch.teamB}
                </p>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground mb-4">{upcomingMatch.venue}</p>
            <FlipCountdown targetDate={upcomingMatch.date} className="justify-center mb-6" />

            {/* User's tokens for this match */}
            {myTokensForNextMatch.length > 0 && (
              <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <span>🎯</span> Your Players in This Match
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {myTokensForNextMatch.map(({ player, tokens }) => {
                    const colors = getTeamColors(player.team);
                    return (
                      <Link
                        key={player.id}
                        href={`/player/${player.id}`}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 hover:border-primary/50 transition-all hover:scale-105"
                        style={{ background: `linear-gradient(135deg, ${colors.from}15, ${colors.to}15)` }}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0"
                          style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`, color: "white" }}
                        >
                          {player.initials}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground leading-none">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.role}</p>
                        </div>
                        <span className="text-xs font-bold text-primary ml-1">×{tokens}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Next Match Players — searchable grid ────────────────────────── */}
          {nextMatch && nextMatchTeams.length > 0 && (
            <div className="card-surface rounded-xl p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Your Players in Next Match
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {TEAM_NAMES[nextMatchTeams[0] as TeamCode] ?? nextMatchTeams[0]}
                    {' '}<span className="text-primary font-semibold">vs</span>{' '}
                    {TEAM_NAMES[nextMatchTeams[1] as TeamCode] ?? nextMatchTeams[1]}
                    {' '}· {nextMatchPlayers.length} players
                  </p>
                </div>

                {/* Team legend */}
                <div className="flex gap-2">
                  {nextMatchTeams.map(t => {
                    const c = getTeamColors(t);
                    return (
                      <span
                        key={t}
                        className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Search bar */}
              <div className="relative mb-5">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  placeholder="Search players by name, symbol, or role…"
                  className="w-full rounded-lg border border-border bg-muted/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {playerSearch && (
                  <button
                    onClick={() => setPlayerSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                  >✕</button>
                )}
              </div>

              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => { setTeamTabFilter('ALL'); setPlayerSearch(''); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    teamTabFilter === 'ALL'
                      ? 'border-primary text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  All Players ({nextMatchPlayers.length})
                </button>
                {nextMatchTeams.map(t => {
                  const c = getTeamColors(t);
                  const count = nextMatchPlayers.filter(p => p.team === t).length;
                  return (
                    <button
                      key={t}
                      onClick={() => { setTeamTabFilter(teamTabFilter === t ? 'ALL' : t); setPlayerSearch(''); }}
                      className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                      style={{
                        borderColor: teamTabFilter === t ? c.from : undefined,
                        color: teamTabFilter === t ? c.from : undefined,
                        opacity: teamTabFilter !== 'ALL' && teamTabFilter !== t ? 0.5 : 1,
                      }}
                    >
                      {t} ({count})
                    </button>
                  );
                })}
              </div>

              {filteredNextMatchPlayers.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredNextMatchPlayers.map((player, i) => {
                    const holding = userHoldings[player.id];
                    return (
                      <div key={player.id} className="relative">
                        {holding && (
                          <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                            ×{holding} held
                          </div>
                        )}
                        <PlayerCard player={player} index={i} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No players found for &quot;{playerSearch}&quot;</p>
                  <button onClick={() => setPlayerSearch('')} className="mt-2 text-primary text-sm underline">Clear search</button>
                </div>
              )}
            </div>
          )}

          {/* ── Upcoming Matches ──────────────────────────────────────────────── */}
          <div className="card-surface rounded-xl p-6">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">Upcoming Matches</h3>
            <div className="space-y-3">
              {upcomingMatches.slice(0, 10).map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                        style={{ background: match.team1 ? `linear-gradient(135deg, ${getTeamColors(match.team1).from}, ${getTeamColors(match.team1).to})` : "hsl(0 0% 40%)", color: "white" }}
                      >
                        {match.team1 || "?"}
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">vs</span>
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                        style={{ background: match.team2 ? `linear-gradient(135deg, ${getTeamColors(match.team2).from}, ${getTeamColors(match.team2).to})` : "hsl(0 0% 40%)", color: "white" }}
                      >
                        {match.team2 || "?"}
                      </div>
                      {match.team1 && match.team2 && (
                        <span className="text-xs text-foreground font-medium">
                          {TEAM_NAMES[match.team1 as TeamCode] ?? match.team1} vs {TEAM_NAMES[match.team2 as TeamCode] ?? match.team2}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {match.stage && <span className="font-semibold">{match.stage} · </span>}
                      {match.venue}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{formatMatchDate(match.timestamp)}</p>
                    <p className="text-xs text-muted-foreground">{formatMatchTime(match.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Panel */}
          <AdminMatchResult connectedWallet={address} />

          {/* Match Results & Rewards */}
          <div className="space-y-6 mt-4">
            <h3 className="font-display text-2xl font-bold text-foreground pl-1 border-l-4 border-primary ml-1">
              Match Results &amp; Rewards
            </h3>

            {savedResults.length > 0 ? (
              <div className="space-y-8">
                {savedResults.map((result) => {
                  const matchInfo = MATCHES.find((m) => m.id === result.matchId);
                  const matchLabel = matchInfo
                    ? `Match #${result.matchId} — ${matchInfo.dateStr}`
                    : `Match #${result.matchId} — ${new Date(result.savedAt).toLocaleDateString()}`;

                  const userStakingPositions = holdings.map((h) => ({
                    walletAddress: address || '0xDemo',
                    playerId: String(h.playerId),
                    tokensStaked: h.tokens,
                  }));

                  const shares = calculateRewardShares(result, userStakingPositions, SEASON.DEFAULT_MATCH_POOL);
                  const myShare = shares.find((s) => s.walletAddress === (address || '0xDemo'));
                  const userRewardWFL = myShare?.rewardWFL || 0;

                  const userStakedPlayers =
                    myShare?.weightedScore !== undefined && myShare.weightedScore > 0
                      ? holdings
                          .filter((h) =>
                            result.playerPerformances.some(
                              (p) => p.playerId === String(h.playerId) && p.fantasyPoints > 0
                            )
                          )
                          .map((h) => {
                            const p = PLAYERS.find((pl) => pl.id === String(h.playerId));
                            return { playerName: p?.name || 'Unknown', tokens: h.tokens };
                          })
                      : [];

                  return (
                    <MatchResultCard
                      key={result.matchId}
                      result={result}
                      matchLabel={matchLabel}
                      userRewardWFL={myShare ? userRewardWFL : undefined}
                      userStakedPlayers={userStakedPlayers}
                      onClaim={() =>
                        toast.success(
                          `Successfully claimed ${userRewardWFL.toFixed(4)} WFL from Prize Pool for Match #${result.matchId}!`
                        )
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="card-surface rounded-xl p-8 text-center border border-border/50 bg-muted/20">
                <p className="text-muted-foreground font-medium">No matches have been completed yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check back after a match finishes for stats and rewards!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
