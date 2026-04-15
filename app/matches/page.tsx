'use client';

import FlipCountdown from "@/components/FlipCountdown";
import { MATCHES, getNextMatch, getTodayMatches } from "@/config/matches";
import { PLAYERS, TEAM_COLORS } from "@/config/players";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import AdminMatchResult from "@/components/AdminMatchResult";
import MatchResultCard from "@/components/MatchResultCard";
import { useAllMatchResults } from "@/hooks/useMatchResult";
import { calculateRewardShares } from "@/lib/services/fantasyPoints.service";
import { SEASON } from "@/lib/constants";

export default function MatchCenter() {
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [nextMatch, setNextMatch] = useState<ReturnType<typeof getNextMatch> | null>(null);
  const [todayMatches, setTodayMatches] = useState<ReturnType<typeof getTodayMatches>>([]);
  const { holdings } = useStore();
  const { address } = useAccount();
  const { data: savedResults = [] } = useAllMatchResults();

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Initialize current time on client side and update every second
  useEffect(() => {
    // Set initial time on client
    setCurrentTime(Date.now());
    
    // Get matches on client side only
    setNextMatch(getNextMatch());
    setTodayMatches(getTodayMatches());
    
    // Update current time every second for real-time countdown
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  
  // Get all upcoming matches from April 15 onwards (only after currentTime is set)
  const upcomingMatches = currentTime > 0 ? MATCHES.filter(m => {
    const matchDate = new Date(m.timestamp);
    const april15 = new Date('April 15, 2026');
    return matchDate >= april15 && m.timestamp > currentTime;
  }).sort((a, b) => a.timestamp - b.timestamp) : [];

  // Get past matches (before current time, only after currentTime is set)
  const pastMatches = currentTime > 0 ? MATCHES.filter(m => m.timestamp < currentTime)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5) : [];

  // Get player tokens for a specific match
  const getPlayerTokensForMatch = (match: typeof nextMatch) => {
    if (!match || !match.team1 || !match.team2) return [];
    
    const matchPlayers = PLAYERS.filter(p => 
      p.team === match.team1 || p.team === match.team2
    );
    
    return matchPlayers
      .map(player => {
        const holding = holdings.find(h => h.playerId === player.id);
        return holding ? { player, tokens: holding.tokens } : null;
      })
      .filter(Boolean);
  };

  // Get all player tokens for today's matches
  const getPlayerTokensForTodayMatches = () => {
    if (todayMatches.length === 0) return [];
    
    const todayTeams = new Set<string>();
    todayMatches.forEach(match => {
      if (match.team1) todayTeams.add(match.team1);
      if (match.team2) todayTeams.add(match.team2);
    });
    
    const todayPlayers = PLAYERS.filter(p => todayTeams.has(p.team));
    
    return todayPlayers
      .map(player => {
        const holding = holdings.find(h => h.playerId === player.id);
        return holding ? { player, tokens: holding.tokens } : null;
      })
      .filter(Boolean);
  };

  const myTokensForNextMatch = nextMatch ? getPlayerTokensForMatch(nextMatch) : [];
  const myTokensPlayingToday = getPlayerTokensForTodayMatches();

  // Create a stable fallback date for SSR
  const fallbackDate = new Date('2026-04-16T00:00:00Z');

  const upcomingMatch = nextMatch ? {
    teamA: nextMatch.team1 || "TBD",
    teamB: nextMatch.team2 || "TBD",
    date: new Date(nextMatch.timestamp),
    venue: nextMatch.venue,
    stage: nextMatch.stage,
  } : {
    teamA: "TBD",
    teamB: "TBD",
    date: fallbackDate,
    venue: "TBD",
  };

  const getTeamColors = (teamCode: string) => {
    return TEAM_COLORS[teamCode as keyof typeof TEAM_COLORS] || { from: "hsl(0 0% 50%)", to: "hsl(0 0% 30%)" };
  };

  const handleViewMatch = () => {
    toast.info("Match details coming soon!");
  };

  const formatMatchDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatMatchTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

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
          {/* Today's Matches - Your Players in Action */}
          {todayMatches.length > 0 && myTokensPlayingToday.length > 0 && (
            <div className="card-surface rounded-xl p-6 border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⚡</span>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Your Players Performing Today!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {myTokensPlayingToday.length} of your players are in action today
                  </p>
                </div>
              </div>

              {/* Today's Matches */}
              <div className="space-y-4 mb-6">
                {todayMatches.map((match) => (
                  <div key={match.id} className="bg-background/50 rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                          style={{
                            background: `linear-gradient(135deg, ${getTeamColors(match.team1 || "").from}, ${getTeamColors(match.team1 || "").to})`,
                            color: "white",
                          }}
                        >
                          {match.team1}
                        </div>
                        <span className="text-xl font-bold text-primary font-display">VS</span>
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                          style={{
                            background: `linear-gradient(135deg, ${getTeamColors(match.team2 || "").from}, ${getTeamColors(match.team2 || "").to})`,
                            color: "white",
                          }}
                        >
                          {match.team2}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{match.venue}</p>
                        <p className="text-xs text-muted-foreground">{formatMatchTime(match.timestamp)}</p>
                      </div>
                    </div>

                    {/* Show user's players for this specific match */}
                    {(() => {
                      const matchPlayerTokens = myTokensPlayingToday.filter((item: any) => 
                        item.player.team === match.team1 || item.player.team === match.team2
                      );
                      
                      if (matchPlayerTokens.length === 0) return null;
                      
                      return (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Your Players:</p>
                          <div className="flex flex-wrap gap-2">
                            {matchPlayerTokens.map((item: any) => {
                              const colors = getTeamColors(item.player.team);
                              return (
                                <div 
                                  key={item.player.id} 
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50"
                                  style={{
                                    background: `linear-gradient(135deg, ${colors.from}15, ${colors.to}15)`,
                                  }}
                                >
                                  <div
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                                    style={{
                                      background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                                      color: "white",
                                    }}
                                  >
                                    {item.player.initials}
                                  </div>
                                  <span className="text-sm font-medium text-foreground">{item.player.name}</span>
                                  <span className="text-xs font-semibold text-primary">×{item.tokens}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => toast.info("Staking feature coming soon!")}
                  className="bg-gold-gradient rounded-lg px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105"
                >
                  Stake Your Players
                </button>
                <button
                  onClick={handleViewMatch}
                  className="bg-muted hover:bg-muted/80 rounded-lg px-6 py-3 font-semibold text-foreground transition-all"
                >
                  View Match Details
                </button>
              </div>
            </div>
          )}

          {/* Next Match */}
          <div className="card-surface rounded-xl p-8 text-center">
            <div className="flex items-center justify-center gap-6 mb-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
                style={{
                  background: `linear-gradient(135deg, ${getTeamColors(upcomingMatch.teamA).from}, ${getTeamColors(upcomingMatch.teamA).to})`,
                  color: "white",
                }}
              >
                {upcomingMatch.teamA}
              </div>
              <span className="text-2xl font-bold text-primary font-display">VS</span>
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
                style={{
                  background: `linear-gradient(135deg, ${getTeamColors(upcomingMatch.teamB).from}, ${getTeamColors(upcomingMatch.teamB).to})`,
                  color: "white",
                }}
              >
                {upcomingMatch.teamB}
              </div>
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {upcomingMatch.stage ? upcomingMatch.stage : "Next Match"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{upcomingMatch.venue}</p>
            <FlipCountdown targetDate={upcomingMatch.date} className="justify-center mb-6" />
            
            {/* My Tokens for Next Match */}
            {myTokensForNextMatch.length > 0 && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">My Tokens in This Match</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {myTokensForNextMatch.map((item: any) => (
                    <div key={item.player.id} className="flex items-center gap-2 px-3 py-2 bg-background/50 rounded-lg border border-border/50">
                      <span className="text-sm font-medium">{item.player.name}</span>
                      <span className="text-xs text-muted-foreground">×{item.tokens}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleViewMatch}
              className="mt-6 bg-gold-gradient rounded-lg px-8 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105"
            >
              View Match Details
            </button>
          </div>

          {/* Upcoming Matches */}
          <div className="card-surface rounded-xl p-6">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">Upcoming Matches</h3>
            <div className="space-y-3">
              {upcomingMatches.slice(0, 10).map((match) => (
                <div key={match.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                        style={{
                          background: match.team1 ? `linear-gradient(135deg, ${getTeamColors(match.team1).from}, ${getTeamColors(match.team1).to})` : "hsl(0 0% 40%)",
                          color: "white",
                        }}
                      >
                        {match.team1 || "TBD"}
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">vs</span>
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                        style={{
                          background: match.team2 ? `linear-gradient(135deg, ${getTeamColors(match.team2).from}, ${getTeamColors(match.team2).to})` : "hsl(0 0% 40%)",
                          color: "white",
                        }}
                      >
                        {match.team2 || "TBD"}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {match.stage && <span className="font-semibold">{match.stage} • </span>}
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
            <h3 className="font-display text-2xl font-bold text-foreground pl-1 border-l-4 border-primary ml-1">Match Results & Rewards</h3>
            
            {savedResults.length > 0 ? (
              <div className="space-y-8">
                {savedResults.map((result) => {
                  // Find the original match details for display
                  const matchInfo = MATCHES.find((m) => m.id === result.matchId);
                  const matchLabel = matchInfo 
                    ? `Match #${result.matchId} — ${matchInfo.dateStr}` 
                    : `Match #${result.matchId} — ${new Date(result.savedAt).toLocaleDateString()}`;
                  
                  // Convert user's DApp holdings to expected type
                  const userStakingPositions = holdings.map((h) => ({
                    walletAddress: address || '0xDemo',
                    playerId: String(h.playerId),
                    tokensStaked: h.tokens
                  }));
                  
                  // Calculate local rewards
                  const shares = calculateRewardShares(result, userStakingPositions, SEASON.DEFAULT_MATCH_POOL);
                  const myShare = shares.find((s) => s.walletAddress === (address || '0xDemo'));
                  const userRewardWFL = myShare?.rewardWFL || 0;
                  
                  // Extract player details for the user UI
                  const userStakedPlayers = myShare?.weightedScore !== undefined && myShare.weightedScore > 0 
                    ? holdings.filter(h => result.playerPerformances.some(p => p.playerId === String(h.playerId) && p.fantasyPoints > 0)).map(h => {
                        const p = PLAYERS.find(pl => pl.id === String(h.playerId));
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
                      onClaim={() => toast.success(`Successfully claimed ${userRewardWFL.toFixed(4)} WFL from Prize Pool for Match #${result.matchId}!`)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="card-surface rounded-xl p-8 text-center border border-border/50 bg-muted/20">
                <p className="text-muted-foreground font-medium">No matches have been completed and processed yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Check back after a match finishes for stats and rewards!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
