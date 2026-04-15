'use client';

import { MatchResultStorage } from '@/lib/services/matchResults.storage';
import type { MatchResult } from '@/lib/types/matchResult';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Fetch result from API route ──────────────────────────────────────────────
async function fetchMatchResult(matchId: number, cricApiMatchId?: string): Promise<MatchResult> {
  const params = new URLSearchParams({ matchId: String(matchId) });
  if (cricApiMatchId) params.set('cricApiMatchId', cricApiMatchId);

  const res = await fetch(`/api/match-result?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch match result');
  const json = await res.json();
  return json.data as MatchResult;
}

// ─── Hook: get a single match result (localStorage first, then API) ───────────
export function useMatchResult(matchId: number, cricApiMatchId?: string) {
  return useQuery({
    queryKey: ['matchResult', matchId],
    queryFn: async () => {
      // Check localStorage first (admin-entered or previously fetched)
      const stored = MatchResultStorage.get(matchId);
      if (stored) return stored;
      // Fall back to API
      const fetched = await fetchMatchResult(matchId, cricApiMatchId);
      MatchResultStorage.save(fetched);
      return fetched;
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
    retry: 1,
  });
}

// ─── Hook: get all saved match results ────────────────────────────────────────
export function useAllMatchResults() {
  return useQuery({
    queryKey: ['allMatchResults'],
    queryFn: () => {
      const all = MatchResultStorage.getAll();
      return Object.values(all).sort((a, b) => b.savedAt - a.savedAt);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

// ─── Mutation: save a manual/admin result ─────────────────────────────────────
export function useSaveMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (result: MatchResult) => {
      MatchResultStorage.save(result);
      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['matchResult', result.matchId] });
      qc.invalidateQueries({ queryKey: ['allMatchResults'] });
    },
  });
}

// ─── Mutation: fetch fresh from CricAPI and save ──────────────────────────────
export function useFetchAndSaveMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, cricApiMatchId }: { matchId: number; cricApiMatchId?: string }) => {
      const result = await fetchMatchResult(matchId, cricApiMatchId);
      MatchResultStorage.save(result);
      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['matchResult', result.matchId] });
      qc.invalidateQueries({ queryKey: ['allMatchResults'] });
    },
  });
}

// ─── Mutation: delete a saved result ─────────────────────────────────────────
export function useDeleteMatchResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: number) => {
      MatchResultStorage.delete(matchId);
      return matchId;
    },
    onSuccess: (matchId) => {
      qc.invalidateQueries({ queryKey: ['matchResult', matchId] });
      qc.invalidateQueries({ queryKey: ['allMatchResults'] });
    },
  });
}
