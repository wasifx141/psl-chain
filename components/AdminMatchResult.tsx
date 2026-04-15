'use client';

import { MATCHES } from '@/config/matches';
import { PLAYERS } from '@/config/players';
import {
  buildPlayerPerformances,
  calculateFantasyPoints,
} from '@/lib/services/fantasyPoints.service';
import type {
  ManualPlayerStat,
  MatchResult,
} from '@/lib/types/matchResult';
import {
  useAllMatchResults,
  useDeleteMatchResult,
  useFetchAndSaveMatchResult,
  useSaveMatchResult,
} from '@/hooks/useMatchResult';
import { useState } from 'react';
import { toast } from 'sonner';

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase() ?? '';

interface Props {
  connectedWallet?: string;
}

function blankStat(playerId: string): ManualPlayerStat {
  const player = PLAYERS.find((candidate) => candidate.id === playerId);
  return {
    playerId,
    playerName: player?.name ?? '',
    teamCode: player?.team ?? '',
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    overs: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };
}

export default function AdminMatchResult({ connectedWallet }: Props) {
  const isAdmin =
    !ADMIN_WALLET || connectedWallet?.toLowerCase() === ADMIN_WALLET;

  const { data: savedResults = [] } = useAllMatchResults();
  const { mutateAsync: saveResult, isPending: isSaving } = useSaveMatchResult();
  const { mutateAsync: fetchAndSave, isPending: isFetching } =
    useFetchAndSaveMatchResult();
  const { mutateAsync: deleteResult } = useDeleteMatchResult();

  const [selectedMatchId, setSelectedMatchId] = useState<number>(1);
  const [winner, setWinner] = useState('');
  const [t1Score, setT1Score] = useState('');
  const [t2Score, setT2Score] = useState('');
  const [cricApiMatchId, setCricApiMatchId] = useState('');
  const [stats, setStats] = useState<ManualPlayerStat[]>([]);
  const [addPlayerId, setAddPlayerId] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  const selectedMatch = MATCHES.find((match) => match.id === selectedMatchId);
  const matchPlayers = PLAYERS.filter(
    (player) =>
      selectedMatch &&
      (player.team === selectedMatch.team1 || player.team === selectedMatch.team2),
  );

  const filteredMatchPlayers = matchPlayers.filter(
    (player) =>
      player.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      player.team.toLowerCase().includes(playerSearch.toLowerCase()),
  );

  function addPlayer() {
    const playerId = addPlayerId || matchPlayers[0]?.id;
    if (!playerId || stats.find((stat) => stat.playerId === playerId)) return;
    setStats((previous) => [...previous, blankStat(playerId)]);
    setAddPlayerId('');
  }

  function updateStat(
    index: number,
    field: keyof ManualPlayerStat,
    value: string | number,
  ) {
    setStats((previous) =>
      previous.map((stat, statIndex) =>
        statIndex === index
          ? {
              ...stat,
              [field]: typeof value === 'string' ? Number(value) : value,
            }
          : stat,
      ),
    );
  }

  function removeStat(index: number) {
    setStats((previous) => previous.filter((_, statIndex) => statIndex !== index));
  }

  function addAllMatchPlayers() {
    const existingPlayers = new Set(stats.map((stat) => stat.playerId));
    const playersToAdd = matchPlayers.filter(
      (player) => !existingPlayers.has(player.id),
    );
    setStats((previous) => [
      ...previous,
      ...playersToAdd.map((player) => blankStat(player.id)),
    ]);
  }

  function resetForm() {
    setStats([]);
    setWinner('');
    setT1Score('');
    setT2Score('');
    setCricApiMatchId('');
  }

  function parseScore(scoreStr: string, teamCode: string, teamName: string) {
    const match = scoreStr.match(/(\d+)\s*\/\s*(\d+)\s*\(?(\d+(?:\.\d+)?)?/);
    return {
      teamCode,
      teamName,
      score: match ? Number(match[1]) : 0,
      wickets: match ? Number(match[2]) : 0,
      overs: match && match[3] ? Number(match[3]) : 20,
    };
  }

  async function handleManualSave() {
    if (!winner) {
      toast.error('Select a winner');
      return;
    }

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
    toast.success(`Match ${selectedMatchId} result saved.`);
    resetForm();
  }

  async function handleFetchFromApi() {
    if (!cricApiMatchId) {
      toast.error('Enter a CricAPI match ID');
      return;
    }

    try {
      const result = await fetchAndSave({
        matchId: selectedMatchId,
        cricApiMatchId,
      });
      toast.success(`Fetched from CricAPI. Source: ${result.source}`);
    } catch {
      toast.error('Failed to fetch from CricAPI. Used mock fallback.');
    }
  }

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      if (lines.length < 2) {
        toast.error('CSV is empty or missing headers');
        return;
      }

      const newStats: ManualPlayerStat[] = [];
      let skipped = 0;

      for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index].trim();
        if (!line) continue;

        const values = line.split(',');
        const rowId = values[0]?.trim();
        const knownPlayer = PLAYERS.find((player) => player.id === rowId);

        if (!knownPlayer) {
          skipped += 1;
          continue;
        }

        newStats.push({
          playerId: knownPlayer.id,
          playerName: knownPlayer.name,
          teamCode: knownPlayer.team,
          runs: Number(values[3] || 0),
          balls: Number(values[4] || 0),
          fours: Number(values[5] || 0),
          sixes: Number(values[6] || 0),
          wickets: Number(values[7] || 0),
          overs: Number(values[8] || 0),
          maidens: Number(values[9] || 0),
          catches: Number(values[10] || 0),
          stumpings: Number(values[11] || 0),
          runOuts: Number(values[12] || 0),
        });
      }

      setStats(newStats);
      toast.success(
        `Loaded ${newStats.length} players from CSV. Skipped ${skipped} unknown players.`,
      );
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="card-surface overflow-hidden rounded-xl border border-amber-500/30">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 bg-amber-500/10 px-4 py-4 text-left transition-colors hover:bg-amber-500/15 sm:px-5"
      >
        <div>
          <p className="text-sm font-semibold text-amber-400">Admin Panel</p>
          <p className="text-xs text-muted-foreground">
            Save match results and distribute rewards
          </p>
        </div>
        <span className="text-lg text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="space-y-6 p-4 sm:p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Select Match
            </label>
            <select
              value={selectedMatchId}
              onChange={(event) => {
                setSelectedMatchId(Number(event.target.value));
                resetForm();
              }}
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
            >
              {MATCHES.filter((match) => match.team1 && match.team2).map((match) => (
                <option key={match.id} value={match.id}>
                  #{match.id} {match.team1} vs {match.team2} - {match.dateStr}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-400">
              Fetch from CricAPI
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={cricApiMatchId}
                onChange={(event) => setCricApiMatchId(event.target.value)}
                placeholder="CricAPI Match ID"
                className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleFetchFromApi}
                disabled={isFetching}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
              >
                {isFetching ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Uses mock data if the key is not configured or match data is unavailable.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Upload CSV Form
              </p>
              <a
                href="/sample-match-result.csv"
                download
                className="text-xs text-blue-400 underline"
              >
                Download Sample CSV
              </a>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="block w-full cursor-pointer text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
            />
            <p className="text-xs text-muted-foreground">
              Upload a CSV matching players.json format. Unregistered players are skipped.
            </p>
          </div>

          <div className="space-y-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Manual Entry
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Winner (team code)
                </label>
                <select
                  value={winner}
                  onChange={(event) => setWinner(event.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
                >
                  <option value="">-- Select --</option>
                  {selectedMatch?.team1 ? (
                    <option value={selectedMatch.team1}>{selectedMatch.team1}</option>
                  ) : null}
                  {selectedMatch?.team2 ? (
                    <option value={selectedMatch.team2}>{selectedMatch.team2}</option>
                  ) : null}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {selectedMatch?.team1 ?? 'Team 1'} Score
                </label>
                <input
                  value={t1Score}
                  onChange={(event) => setT1Score(event.target.value)}
                  placeholder="187/4 (20)"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {selectedMatch?.team2 ?? 'Team 2'} Score
                </label>
                <input
                  value={t2Score}
                  onChange={(event) => setT2Score(event.target.value)}
                  placeholder="155/8 (20)"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-muted-foreground">
                  Player Stats
                </p>
                <button
                  onClick={addAllMatchPlayers}
                  className="text-left text-xs text-primary underline underline-offset-2 hover:text-primary/80 sm:text-right"
                >
                  Add All Match Players
                </button>
              </div>

              <div className="mb-3 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Search match players..."
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={addPlayerId}
                    onChange={(event) => setAddPlayerId(event.target.value)}
                    className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Pick a player...</option>
                    {filteredMatchPlayers.map((player) => (
                      <option
                        key={player.id}
                        value={player.id}
                        disabled={!!stats.find((stat) => stat.playerId === player.id)}
                      >
                        {player.name} ({player.team})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addPlayer}
                    className="shrink-0 rounded-lg border border-primary/30 bg-primary/20 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/30"
                  >
                    Add Player
                  </button>
                </div>
              </div>

              {stats.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {stats.map((stat, index) => {
                    const points = calculateFantasyPoints(stat);
                    return (
                      <div
                        key={stat.playerId}
                        className="rounded-lg border border-border/50 bg-muted/30 p-3"
                      >
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {stat.playerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {stat.teamCode}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                              {points} pts
                            </span>
                            <button
                              onClick={() => removeStat(index)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-5">
                          {(
                            [
                              'runs',
                              'balls',
                              'fours',
                              'sixes',
                              'wickets',
                              'overs',
                              'maidens',
                              'catches',
                              'stumpings',
                              'runOuts',
                            ] as const
                          ).map((field) => (
                            <div key={field}>
                              <label className="mb-0.5 block capitalize text-muted-foreground">
                                {field}
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={stat[field] ?? 0}
                                onChange={(event) =>
                                  updateStat(index, field, event.target.value)
                                }
                                className="w-full rounded border border-border bg-muted/50 px-2 py-1 text-xs text-foreground"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="w-full rounded-lg bg-amber-500 py-2.5 font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Match Result'}
            </button>
          </div>

          {savedResults.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saved Results ({savedResults.length})
              </p>
              <div className="space-y-2">
                {savedResults.map((result) => {
                  const match = MATCHES.find((candidate) => candidate.id === result.matchId);
                  return (
                    <div
                      key={result.matchId}
                      className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Match #{result.matchId}{' '}
                          {match ? `- ${match.team1} vs ${match.team2}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {result.source} · {result.playerPerformances.length}{' '}
                          players · Winner: {result.winner || 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteResult(result.matchId)}
                        className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-400 transition-colors hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
