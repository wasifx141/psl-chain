import type { MatchResult } from '@/lib/types/matchResult';

const STORAGE_KEY = 'psl_match_results';

// ─── Match Results Storage Service (localStorage) ─────────────────────────────
// Used client-side to persist admin-entered or fetched results across refreshes
export const MatchResultStorage = {
  getAll(): Record<number, MatchResult> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  get(matchId: number): MatchResult | null {
    const all = this.getAll();
    return all[matchId] ?? null;
  },

  save(result: MatchResult): void {
    if (typeof window === 'undefined') return;
    try {
      const all = this.getAll();
      all[result.matchId] = { ...result, savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      console.error('Failed to save match result to localStorage');
    }
  },

  delete(matchId: number): void {
    if (typeof window === 'undefined') return;
    try {
      const all = this.getAll();
      delete all[matchId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};
