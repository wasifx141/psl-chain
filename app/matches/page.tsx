'use client';

import AdminMatchResult from "@/components/AdminMatchResult";
import FlipCountdown from "@/components/FlipCountdown";
import MatchResultCard from "@/components/MatchResultCard";
import PlayerCard from "@/components/PlayerCard";
import { MATCHES, getNextMatch, getTodayMatches } from "@/config/matches";
import { PLAYERS, TEAM_COLORS, TEAM_NAMES } from "@/config/players";
import type { TeamCode } from "@/config/players";
import { useGetAllPlayersSupply, useDatabasePortfolio, useGetPortfolio } from "@/hooks/useContract";
import { useAllMatchResults } from "@/hooks/useMatchResult";
import { calculateRewardShares } from "@/lib/services/fantasyPoints.service";
import { SEASON } from "@/lib/constants";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";

export default function MatchCenter() {
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [nextMatch, setNextMatch] = useState<ReturnType<typeof getNextMatch> | null>(null);
  const [todayMatches, setTodayMatches] = useState<ReturnType<typeof getTodayMatches>>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [teamTabFilter, setTeamTabFilter] = useState<string>("ALL");

  const { address } = useAccount();
  const { data: savedResults = [] } = useAllMatchResults();
  const { data: dbPortfolio } = useDatabasePortfolio(address ?? "");
  const { holdings: onChainHoldings } = useGetPortfolio(address ?? "");
  const { players: allPlayersLive } = useGetAllPlayersSupply();

  useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    setCurrentTime(Date.now());
    setNextMatch(getNextMatch());
    setTodayMatches(getTodayMatches());

    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const upcomingMatches =
    currentTime > 0
      ? MATCHES.filter((match) => {
          const matchDate = new Date(match.timestamp);
          const seasonStart = new Date("2026-04-15T00:00:00Z");
          return matchDate >= seasonStart && match.timestamp > currentTime;
        })
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, 10)
      : [];

  const fallbackDate = new Date("2026-04-16T00:00:00Z");

  const upcomingMatch = nextMatch
    ? {
        teamA: nextMatch.team1 || "TBD",
        teamB: nextMatch.team2 || "TBD",
        date: new Date(nextMatch.timestamp),
        venue: nextMatch.venue,
        stage: nextMatch.stage,
      }
    : {
        teamA: "TBD",
        teamB: "TBD",
        date: fallbackDate,
        venue: "TBD",
        stage: "Next Match",
      };

  const getTeamColors = (teamCode: string) =>
    TEAM_COLORS[teamCode as TeamCode] || {
      from: "hsl(0 0% 50%)",
      to: "hsl(0 0% 30%)",
    };

  const formatMatchDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatMatchTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const userHoldings: Record<string, number> = useMemo(() => {
    const holdingsMap: Record<string, number> = {};

    if (dbPortfolio?.holdings && (dbPortfolio.holdings as any[]).length > 0) {
      for (const holding of dbPortfolio.holdings as any[]) {
        const player = PLAYERS.find(
          (candidate) => candidate.numericId === Number(holding.player_id),
        );
        if (player && holding.amount > 0) {
          holdingsMap[player.id] = holding.amount;
        }
      }
      return holdingsMap;
    }

    for (const holding of onChainHoldings) {
      if (holding.amount > 0) {
        holdingsMap[holding.player.id] = holding.amount;
      }
    }

    return holdingsMap;
  }, [dbPortfolio, onChainHoldings]);

  const nextMatchTeams = nextMatch
    ? ([nextMatch.team1, nextMatch.team2].filter(Boolean) as string[])
    : [];

  const nextMatchPlayers = useMemo(() => {
    const teamSet = new Set(nextMatchTeams);
    return allPlayersLive.filter(
      (player) => teamSet.has(player.team) && userHoldings[player.id],
    );
  }, [allPlayersLive, nextMatchTeams, userHoldings]);

  const filteredNextMatchPlayers = useMemo(() => {
    let result = nextMatchPlayers;

    if (teamTabFilter !== "ALL") {
      result = result.filter((player) => player.team === teamTabFilter);
    }

    if (!playerSearch.trim()) return result;

    const query = playerSearch.toLowerCase();
    return result.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        player.symbol.toLowerCase().includes(query) ||
        player.role.toLowerCase().includes(query),
    );
  }, [nextMatchPlayers, playerSearch, teamTabFilter]);

  const myTokensForNextMatch = useMemo(() => {
    const teamSet = new Set(nextMatchTeams);
    return Object.entries(userHoldings)
      .filter(([playerId]) => {
        const player = PLAYERS.find((candidate) => candidate.id === playerId);
        return player && teamSet.has(player.team);
      })
      .map(([playerId, tokens]) => ({
        player: PLAYERS.find((candidate) => candidate.id === playerId)!,
        tokens,
      }))
      .filter((entry) => entry.player);
  }, [userHoldings, nextMatchTeams]);

  const holdings = Object.entries(userHoldings).map(([playerId, tokens]) => ({
    playerId,
    tokens,
  }));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {!loaded ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-48 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-700">
          {todayMatches.length > 0 ? (
            <div className="card-surface rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Today&apos;s Matches
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {todayMatches.length} match
                    {todayMatches.length > 1 ? "es" : ""} scheduled today
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {todayMatches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-lg border border-border/50 bg-background/50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-4">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${getTeamColors(
                              match.team1 || "",
                            ).from}, ${getTeamColors(match.team1 || "").to})`,
                          }}
                        >
                          {match.team1}
                        </div>
                        <span className="font-display text-xl font-bold text-primary">
                          VS
                        </span>
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${getTeamColors(
                              match.team2 || "",
                            ).from}, ${getTeamColors(match.team2 || "").to})`,
                          }}
                        >
                          {match.team2}
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {match.venue}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMatchTime(match.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card-surface rounded-xl p-5 sm:p-8">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {upcomingMatch.stage || "Next Match"}
            </p>

            <div className="mb-4 flex items-center justify-center gap-4 sm:gap-6">
              <div className="text-center">
                <div
                  className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${getTeamColors(
                      upcomingMatch.teamA,
                    ).from}, ${getTeamColors(upcomingMatch.teamA).to})`,
                  }}
                >
                  {upcomingMatch.teamA}
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {TEAM_NAMES[upcomingMatch.teamA as TeamCode] ??
                    upcomingMatch.teamA}
                </p>
              </div>

              <span className="font-display text-3xl font-bold text-primary">
                VS
              </span>

              <div className="text-center">
                <div
                  className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${getTeamColors(
                      upcomingMatch.teamB,
                    ).from}, ${getTeamColors(upcomingMatch.teamB).to})`,
                  }}
                >
                  {upcomingMatch.teamB}
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {TEAM_NAMES[upcomingMatch.teamB as TeamCode] ??
                    upcomingMatch.teamB}
                </p>
              </div>
            </div>

            <p className="mb-4 text-center text-sm text-muted-foreground">
              {upcomingMatch.venue}
            </p>
            <FlipCountdown targetDate={upcomingMatch.date} className="justify-center" />

            {myTokensForNextMatch.length > 0 ? (
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  Your Players in This Match
                </h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {myTokensForNextMatch.map(({ player, tokens }) => {
                    const colors = getTeamColors(player.team);
                    return (
                      <Link
                        key={player.id}
                        href={`/player/${player.id}`}
                        className="flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2 transition-all hover:scale-105 hover:border-primary/50"
                        style={{
                          background: `linear-gradient(135deg, ${colors.from}15, ${colors.to}15)`,
                        }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                          }}
                        >
                          {player.initials}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold leading-none text-foreground">
                            {player.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {player.role}
                          </p>
                        </div>
                        <span className="ml-1 text-xs font-bold text-primary">
                          x{tokens}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {nextMatch && nextMatchTeams.length > 0 ? (
            <div className="card-surface rounded-xl p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Your Players in Next Match
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {TEAM_NAMES[nextMatchTeams[0] as TeamCode] ??
                      nextMatchTeams[0]}{" "}
                    <span className="font-semibold text-primary">vs</span>{" "}
                    {TEAM_NAMES[nextMatchTeams[1] as TeamCode] ??
                      nextMatchTeams[1]}{" "}
                    · {nextMatchPlayers.length} players
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {nextMatchTeams.map((teamCode) => {
                    const colors = getTeamColors(teamCode);
                    return (
                      <span
                        key={teamCode}
                        className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                        }}
                      >
                        {teamCode}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="relative mb-5">
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
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder="Search players by name, symbol, or role..."
                  className="w-full rounded-lg border border-border bg-muted/50 py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {playerSearch ? (
                  <button
                    onClick={() => setPlayerSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setTeamTabFilter("ALL");
                    setPlayerSearch("");
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    teamTabFilter === "ALL"
                      ? "border-primary text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  All Players ({nextMatchPlayers.length})
                </button>

                {nextMatchTeams.map((teamCode) => {
                  const colors = getTeamColors(teamCode);
                  const count = nextMatchPlayers.filter(
                    (player) => player.team === teamCode,
                  ).length;

                  return (
                    <button
                      key={teamCode}
                      onClick={() => {
                        setTeamTabFilter(teamTabFilter === teamCode ? "ALL" : teamCode);
                        setPlayerSearch("");
                      }}
                      className="rounded-full border px-3 py-1.5 text-xs transition-colors"
                      style={{
                        borderColor: teamTabFilter === teamCode ? colors.from : undefined,
                        color: teamTabFilter === teamCode ? colors.from : undefined,
                        opacity:
                          teamTabFilter !== "ALL" && teamTabFilter !== teamCode
                            ? 0.5
                            : 1,
                      }}
                    >
                      {teamCode} ({count})
                    </button>
                  );
                })}
              </div>

              {filteredNextMatchPlayers.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredNextMatchPlayers.map((player, index) => {
                    const holding = userHoldings[player.id];
                    return (
                      <div key={player.id} className="relative">
                        {holding ? (
                          <div className="absolute right-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-md">
                            x{holding} held
                          </div>
                        ) : null}
                        <PlayerCard player={player} index={index} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No players found for &quot;{playerSearch}&quot;</p>
                  <button
                    onClick={() => setPlayerSearch("")}
                    className="mt-2 text-sm text-primary underline"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div className="card-surface rounded-xl p-5 sm:p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              Upcoming Matches
            </h3>
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{
                          background: match.team1
                            ? `linear-gradient(135deg, ${getTeamColors(match.team1).from}, ${getTeamColors(match.team1).to})`
                            : "hsl(0 0% 40%)",
                        }}
                      >
                        {match.team1 || "?"}
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        vs
                      </span>
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{
                          background: match.team2
                            ? `linear-gradient(135deg, ${getTeamColors(match.team2).from}, ${getTeamColors(match.team2).to})`
                            : "hsl(0 0% 40%)",
                        }}
                      >
                        {match.team2 || "?"}
                      </div>
                      {match.team1 && match.team2 ? (
                        <span className="min-w-0 text-xs font-medium text-foreground">
                          {TEAM_NAMES[match.team1 as TeamCode] ?? match.team1} vs{" "}
                          {TEAM_NAMES[match.team2 as TeamCode] ?? match.team2}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {match.stage ? (
                        <span className="font-semibold">{match.stage} · </span>
                      ) : null}
                      {match.venue}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-foreground">
                      {formatMatchDate(match.timestamp)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMatchTime(match.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AdminMatchResult connectedWallet={address} />

          <div className="mt-4 space-y-6">
            <h3 className="ml-1 border-l-4 border-primary pl-1 font-display text-xl font-bold text-foreground sm:text-2xl">
              Match Results &amp; Rewards
            </h3>

            {savedResults.length > 0 ? (
              <div className="space-y-8">
                {savedResults.map((result) => {
                  const matchInfo = MATCHES.find((match) => match.id === result.matchId);
                  const matchLabel = matchInfo
                    ? `Match #${result.matchId} - ${matchInfo.dateStr}`
                    : `Match #${result.matchId} - ${new Date(
                        result.savedAt,
                      ).toLocaleDateString()}`;

                  const userStakingPositions = holdings.map((holding) => ({
                    walletAddress: address || "0xDemo",
                    playerId: String(holding.playerId),
                    tokensStaked: holding.tokens,
                  }));

                  const shares = calculateRewardShares(
                    result,
                    userStakingPositions,
                    SEASON.DEFAULT_MATCH_POOL,
                  );
                  const myShare = shares.find(
                    (share) => share.walletAddress === (address || "0xDemo"),
                  );
                  const userRewardWFL = myShare?.rewardWFL || 0;

                  const userStakedPlayers =
                    myShare?.weightedScore !== undefined && myShare.weightedScore > 0
                      ? holdings
                          .filter((holding) =>
                            result.playerPerformances.some(
                              (performance) =>
                                performance.playerId === String(holding.playerId) &&
                                performance.fantasyPoints > 0,
                            ),
                          )
                          .map((holding) => {
                            const player = PLAYERS.find(
                              (candidate) => candidate.id === String(holding.playerId),
                            );
                            return {
                              playerName: player?.name || "Unknown",
                              tokens: holding.tokens,
                            };
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
                          `Successfully claimed ${userRewardWFL.toFixed(
                            4,
                          )} WFL from Prize Pool for Match #${result.matchId}.`,
                        )
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="card-surface rounded-xl border border-border/50 bg-muted/20 p-8 text-center">
                <p className="font-medium text-muted-foreground">
                  No matches have been completed yet.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Check back after a match finishes for stats and rewards.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
