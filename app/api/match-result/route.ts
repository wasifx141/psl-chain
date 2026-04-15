import { NextRequest, NextResponse } from 'next/server';
import {
  buildPlayerPerformances,
  parseCricApiScorecard,
} from '@/lib/services/fantasyPoints.service';
import type { MatchResult } from '@/lib/types/matchResult';

// ─── Mock Scorecard (fallback when API key missing or match not found) ────────
function getMockResult(matchId: number): MatchResult {
  return {
    matchId,
    source: 'mock',
    status: 'completed',
    winner: 'IU',
    team1Score: { teamCode: 'IU', teamName: 'Islamabad United', score: 187, wickets: 4, overs: 20 },
    team2Score: { teamCode: 'PZ', teamName: 'Peshawar Zalmi', score: 155, wickets: 8, overs: 20 },
    playerPerformances: buildPlayerPerformances([
      { playerId: '0', playerName: 'Shadab Khan',    teamCode: 'IU', runs: 45, balls: 28, fours: 3, sixes: 2, wickets: 2, overs: 4, catches: 1 },
      { playerId: '1', playerName: 'Imad Wasim',     teamCode: 'IU', runs: 62, balls: 40, fours: 5, sixes: 3, wickets: 1, overs: 3 },
      { playerId: '2', playerName: 'Faheem Ashraf',  teamCode: 'IU', runs: 12, balls: 10, wickets: 3, overs: 4, maidens: 1 },
      { playerId: '3', playerName: 'Mark Chapman',   teamCode: 'IU', runs: 38, balls: 30, fours: 4 },
      { playerId: '4', playerName: 'Devon Conway',   teamCode: 'IU', runs: 30, balls: 22, fours: 2, stumpings: 1 },
      { playerId: '5', playerName: 'Babar Azam',     teamCode: 'PZ', runs: 68, balls: 52, fours: 6, sixes: 1 },
      { playerId: '6', playerName: 'Mohammad Haris', teamCode: 'PZ', runs: 25, balls: 18, fours: 2, catches: 2 },
      { playerId: '7', playerName: 'Sufyan Muqeem',  teamCode: 'PZ', wickets: 2, overs: 4, runs: 8, balls: 6 },
      { playerId: '8', playerName: 'Aamer Jamal',    teamCode: 'PZ', wickets: 1, overs: 4, runs: 15, balls: 12 },
      { playerId: '9', playerName: 'Kusal Mendis',   teamCode: 'PZ', runs: 22, balls: 19, fours: 1 },
    ]),
    savedAt: Date.now(),
  };
}

// ─── Fetch from CricAPI ───────────────────────────────────────────────────────
async function fetchFromCricApi(cricApiMatchId: string, matchId: number): Promise<MatchResult | null> {
  const apiKey = process.env.CRICAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.cricapi.com/v1/match_scorecard?apikey=${apiKey}&id=${cricApiMatchId}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'success' || !data.data) return null;

    const match = data.data;
    const stats = parseCricApiScorecard(match);
    const performances = buildPlayerPerformances(stats);

    // Parse team scores from CricAPI format
    const scores = match.score ?? [];
    const team1Score = scores[0]
      ? {
          teamCode: match.teams?.[0] ?? '',
          teamName: match.teams?.[0] ?? '',
          score: scores[0].r ?? 0,
          wickets: scores[0].w ?? 0,
          overs: scores[0].o ?? 0,
        }
      : undefined;
    const team2Score = scores[1]
      ? {
          teamCode: match.teams?.[1] ?? '',
          teamName: match.teams?.[1] ?? '',
          score: scores[1].r ?? 0,
          wickets: scores[1].w ?? 0,
          overs: scores[1].o ?? 0,
        }
      : undefined;

    // Determine winner from CricAPI "matchWinner" field
    const winnerRaw: string = match.matchWinner ?? '';

    return {
      matchId,
      cricApiMatchId,
      source: 'cricapi',
      status: match.matchEnded ? 'completed' : 'live',
      winner: winnerRaw,
      team1Score,
      team2Score,
      playerPerformances: performances,
      savedAt: Date.now(),
    };
  } catch (err) {
    console.error('[CricAPI] fetch error:', err);
    return null;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = Number(searchParams.get('matchId'));
  const cricApiMatchId = searchParams.get('cricApiMatchId') ?? '';
  const useMock = searchParams.get('mock') === 'true';

  if (!matchId) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
  }

  // 1. Try live CricAPI if cricApiMatchId provided and not forcing mock
  if (cricApiMatchId && !useMock) {
    const liveResult = await fetchFromCricApi(cricApiMatchId, matchId);
    if (liveResult) {
      return NextResponse.json({ success: true, data: liveResult });
    }
  }

  // 2. Fallback: return mock data
  return NextResponse.json({ success: true, data: getMockResult(matchId), source: 'mock' });
}
