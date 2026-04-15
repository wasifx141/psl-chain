'use client';

import { MATCHES } from '@/config/matches';
import { PLAYERS } from '@/config/players';
import {
  buildPlayerPerformances,
  calculateFantasyPoints,
} from '@/lib/services/fantasyPoints.service';
import type {
  ManualMatchResult,
  ManualPlayerStat,
  MatchResult,
} from '@/lib/types/matchResult';
import { useSaveMatchResult, useFetchAndSaveMatchResult, useDeleteMatchResult, useAllMatchResults } from '@/hooks/useMatchResult';
import { useState } from 'react';
import { toast } from 'sonner';

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase() ?? '';

interface Props {
  connectedWallet?: string;
}

// ─── Blank stat row ───────────────────────────────────────────────────────────
function blankStat(playerId: string): ManualPlayerStat {
  const player = PLAYERS.find((p) => p.id === playerId);
  return {
    playerId,
    playerName: player?.name ?? '',
    teamCode: player?.team ?? '',
    runs: 0, balls: 0, fours: 0, sixes: 0,
    wickets: 0, overs: 0, maidens: 0,
    catches: 0, stumpings: 0, runOuts: 0,
  };
}

export default function AdminMatchResult({ connectedWallet }: Props) {
  const isAdmin =
    !ADMIN_WALLET || connectedWallet?.toLowerCase() === ADMIN_WALLET;

  const { data: savedResults = [] } = useAllMatchResults();
  const { mutateAsync: saveResult, isPending: isSaving } = useSaveMatchResult();
  const { mutateAsync: fetchAndSave, isPending: isFetching } = useFetchAndSaveMatchResult();
  const { mutateAsync: deleteResult } = useDeleteMatchResult();

  // Form state
  const [selectedMatchId, setSelectedMatchId] = useState<number>(1);
  const [winner, setWinner] = useState('');
  const [t1Score, setT1Score] = useState('');
  const [t2Score, setT2Score] = useState('');
  const [cricApiMatchId, setCricApiMatchId] = useState('');
  const [stats, setStats] = useState<ManualPlayerStat[]>([]);
  const [addPlayerId, setAddPlayerId] = useState('');
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  const selectedMatch = MATCHES.find((m) => m.id === selectedMatchId);
  const matchPlayers = PLAYERS.filter(
    (p) =>
      selectedMatch &&
      (p.team === selectedMatch.team1 || p.team === selectedMatch.team2),
  );

  function addPlayer() {
    const id = addPlayerId || matchPlayers[0]?.id;
    if (!id || stats.find((s) => s.playerId === id)) return;
    setStats((prev) => [...prev, blankStat(id)]);
    setAddPlayerId('');
  }

  function updateStat(
    idx: number,
    field: keyof ManualPlayerStat,
    value: string | number,
  ) {
    setStats((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, [field]: typeof value === 'string' ? Number(value) : value } : s,
      ),
    );
  }

  function removeStat(idx: number) {
    setStats((prev) => prev.filter((_, i) => i !== idx));
  }

  // Add all match players at once
  function addAllMatchPlayers() {
    const existing = new Set(stats.map((s) => s.playerId));
    const toAdd = matchPlayers.filter((p) => !existing.has(p.id));
    setStats((prev) => [...prev, ...toAdd.map((p) => blankStat(p.id))]);
  }

  // Reset form for a new match
  function resetForm() {
    setStats([]);
    setWinner('');
    setT1Score('');
    setT2Score('');
    setCricApiMatchId('');
  }

  // Parse score string "187/4 (20)" → TeamScore fields
  function parseScore(scoreStr: string, teamCode: string, teamName: string) {
    const m = scoreStr.match(/(\d+)\s*\/\s*(\d+)\s*\(?(\d+(?:\.\d+)?)?/);
    return {
      teamCode,
      teamName,
      score: m ? Number(m[1]) : 0,
      wickets: m ? Number(m[2]) : 0,
      overs: m && m[3] ? Number(m[3]) : 20,
    };
  }

  async function handleManualSave() {
    if (!winner) { toast.error('Select a winner'); return; }
    const performances = buildPlayerPerformances(stats);

    const result: MatchResult = {
      matchId: selectedMatchId,
      source: 'manual',
      status: 'completed',
      winner,
      team1Score: selectedMatch?.team1
        ? parseScore(t1Score, selectedMatch.team1, selectedMatch.team1)
        : undefined,
      team2Score: selectedMatch?.team2
        ? parseScore(t2Score, selectedMatch.team2, selectedMatch.team2)
        : undefined,
      playerPerformances: performances,
      savedAt: Date.now(),
    };

    await saveResult(result);
    toast.success(`✅ Match ${selectedMatchId} result saved!`);
    resetForm();
  }

  async function handleFetchFromApi() {
    if (!cricApiMatchId) { toast.error('Enter a CricAPI match ID'); return; }
    try {
      const result = await fetchAndSave({ matchId: selectedMatchId, cricApiMatchId });
      toast.success(`✅ Fetched from CricAPI! Source: ${result.source}`);
    } catch {
      toast.error('Failed to fetch from CricAPI. Used mock fallback.');
    }
  }

  return (
    <div className="card-surface rounded-xl border border-amber-500/30 overflow-hidden">
      {/* Toggle Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🛠️</span>
          <div className="text-left">
            <p className="font-semibold text-amber-400 text-sm">Admin Panel</p>
            <p className="text-xs text-muted-foreground">
              Save match results & distribute rewards
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-5 space-y-6">
          {/* ── Tabs: Manual | CricAPI ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Match selector */}
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Select Match</label>
              <select
                value={selectedMatchId}
                onChange={(e) => { setSelectedMatchId(Number(e.target.value)); resetForm(); }}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {MATCHES.filter((m) => m.team1 && m.team2).map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} {m.team1} vs {m.team2} — {m.dateStr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Section A: Fetch from CricAPI ── */}
          <div className="rounded-lg border border-green-500/20 p-4 bg-green-500/5 space-y-3">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">
              🌐 Fetch from CricAPI
            </p>
            <div className="flex gap-2">
              <input
                value={cricApiMatchId}
                onChange={(e) => setCricApiMatchId(e.target.value)}
                placeholder="CricAPI Match ID (e.g. abc123-…)"
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleFetchFromApi}
                disabled={isFetching}
                className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isFetching ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses mock data if key not configured or match data unavailable.
            </p>
          </div>

          {/* ── Section B: Manual Entry ── */}
          <div className="rounded-lg border border-amber-500/20 p-4 bg-amber-500/5 space-y-4">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              ✏️ Manual Entry
            </p>

            {/* Winner & Scores */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Winner (team code)</label>
                <select
                  value={winner}
                  onChange={(e) => setWinner(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="">-- Select --</option>
                  {selectedMatch?.team1 && <option value={selectedMatch.team1}>{selectedMatch.team1}</option>}
                  {selectedMatch?.team2 && <option value={selectedMatch.team2}>{selectedMatch.team2}</option>}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {selectedMatch?.team1 ?? 'Team 1'} Score
                </label>
                <input
                  value={t1Score}
                  onChange={(e) => setT1Score(e.target.value)}
                  placeholder="187/4 (20)"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {selectedMatch?.team2 ?? 'Team 2'} Score
                </label>
                <input
                  value={t2Score}
                  onChange={(e) => setT2Score(e.target.value)}
                  placeholder="155/8 (20)"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Player Stats */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Player Stats</p>
                <button
                  onClick={addAllMatchPlayers}
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  + Add All Match Players
                </button>
              </div>

              {/* Add single player */}
              <div className="flex gap-2 mb-3">
                <select
                  value={addPlayerId}
                  onChange={(e) => setAddPlayerId(e.target.value)}
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Pick a player…</option>
                  {PLAYERS.map((p) => (
                    <option key={p.id} value={p.id} disabled={!!stats.find((s) => s.playerId === p.id)}>
                      {p.name} ({p.team})
                    </option>
                  ))}
                </select>
                <button
                  onClick={addPlayer}
                  className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  + Add
                </button>
              </div>

              {/* Stat rows */}
              {stats.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {stats.map((stat, idx) => {
                    const pts = calculateFantasyPoints(stat);
                    return (
                      <div key={stat.playerId} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-foreground">{stat.playerName}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {pts} pts
                            </span>
                            <button onClick={() => removeStat(idx)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 text-xs">
                          {(['runs','balls','fours','sixes','wickets','overs','maidens','catches','stumpings','runOuts'] as const).map((field) => (
                            <div key={field}>
                              <label className="block text-muted-foreground capitalize mb-0.5">{field}</label>
                              <input
                                type="number"
                                min={0}
                                value={stat[field] ?? 0}
                                onChange={(e) => updateStat(idx, field, e.target.value)}
                                className="w-full bg-muted/50 border border-border rounded px-2 py-1 text-foreground text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : '💾 Save Match Result'}
            </button>
          </div>

          {/* ── Saved Results ── */}
          {savedResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Saved Results ({savedResults.length})
              </p>
              <div className="space-y-2">
                {savedResults.map((r) => {
                  const m = MATCHES.find((x) => x.id === r.matchId);
                  return (
                    <div key={r.matchId} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Match #{r.matchId} {m ? `— ${m.team1} vs ${m.team2}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {r.source} • {r.playerPerformances.length} players • Winner: {r.winner || 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteResult(r.matchId)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-1 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
