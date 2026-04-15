import { TeamCode } from "./players";

export interface Match {
  id: number;
  dateStr: string;
  timestamp: number;
  team1?: TeamCode;
  team2?: TeamCode;
  venue: string;
  stage?: string;
  isPlayoff: boolean;
}

const NAME_TO_TEAM_CODE: Record<string, TeamCode> = {
  "Lahore": "LQ",
  "Hyderabad": "HK",
  "Quetta": "QG",
  "Karachi": "KK",
  "Sialkot": "SS",
  "Rawalpindi": "RW",
  "Peshawar": "PZ",
  "Islamabad": "IU",
};

const rawMatchData = [
  {"date":"March 26","team1":"Lahore","team2":"Hyderabad","venue":"Lahore"},
  {"date":"March 27","team1":"Quetta","team2":"Karachi","venue":"Lahore"},
  {"date":"March 28","team1":"Sialkot","team2":"Rawalpindi","venue":"Peshawar"},
  {"date":"March 28","team1":"Peshawar","team2":"Islamabad","venue":"Peshawar"},
  {"date":"March 29","team1":"Hyderabad","team2":"Quetta","venue":"Lahore"},
  {"date":"March 29","team1":"Lahore","team2":"Karachi","venue":"Lahore"},
  {"date":"March 31","team1":"Peshawar","team2":"Rawalpindi","venue":"Rawalpindi"},
  {"date":"April 1","team1":"Sialkot","team2":"Hyderabad","venue":"Multan"},
  {"date":"April 2","team1":"Islamabad","team2":"Quetta","venue":"Rawalpindi"},
  {"date":"April 3","team1":"Sialkot","team2":"Lahore","venue":"Multan"},
  {"date":"April 4","team1":"Peshawar","team2":"Karachi","venue":"Multan"},
  {"date":"April 5","team1":"Rawalpindi","team2":"Islamabad","venue":"Rawalpindi"},
  {"date":"April 6","team1":"Sialkot","team2":"Quetta","venue":"Multan"},
  {"date":"April 8","team1":"Hyderabad","team2":"Peshawar","venue":"Karachi"},
  {"date":"April 9","team1":"Lahore","team2":"Islamabad","venue":"Faisalabad"},
  {"date":"April 10","team1":"Karachi","team2":"Rawalpindi","venue":"Karachi"},
  {"date":"April 11","team1":"Lahore","team2":"Peshawar","venue":"Faisalabad"},
  {"date":"April 11","team1":"Quetta","team2":"Rawalpindi","venue":"Karachi"},
  {"date":"April 12","team1":"Lahore","team2":"Hyderabad","venue":"Karachi"},
  {"date":"April 13","team1":"Sialkot","team2":"Peshawar","venue":"Faisalabad"},
  {"date":"April 14","team1":"Hyderabad","team2":"Islamabad","venue":"Karachi"},
  {"date":"April 15","team1":"Karachi","team2":"Islamabad","venue":"Karachi"},
  {"date":"April 16","team1":"Hyderabad","team2":"Rawalpindi","venue":"Faisalabad"},
  {"date":"April 17","team1":"Lahore","team2":"Rawalpindi","venue":"Faisalabad"},
  {"date":"April 18","team1":"Karachi","team2":"Sialkot","venue":"Lahore"},
  {"date":"April 18","team1":"Lahore","team2":"Quetta","venue":"Faisalabad"},
  {"date":"April 19","team1":"Islamabad","team2":"Sialkot","venue":"Lahore"},
  {"date":"April 20","team1":"Quetta","team2":"Peshawar","venue":"Faisalabad"},
  {"date":"April 22","team1":"Lahore","team2":"Sialkot","venue":"Lahore"},
  {"date":"April 23","team1":"Peshawar","team2":"Islamabad","venue":"Rawalpindi"},
  {"date":"April 23","team1":"Karachi","team2":"Hyderabad","venue":"Lahore"},
  {"date":"April 24","team1":"Rawalpindi","team2":"Quetta","venue":"Rawalpindi"},
  {"date":"April 25","team1":"Karachi","team2":"Lahore","venue":"Lahore"},
  {"date":"April 26","team1":"Rawalpindi","team2":"Islamabad","venue":"Rawalpindi"},
  {"date":"April 27","team1":"Sialkot","team2":"Hyderabad","venue":"Lahore"},
  {"date":"April 28","team1":"Peshawar","team2":"Quetta","venue":"Rawalpindi"},
  {"date":"April 29","team1":"Islamabad","team2":"Quetta","venue":"Rawalpindi"},
  {"date":"April 30","team1":"Rawalpindi","team2":"Peshawar","venue":"Rawalpindi"},
  {"date":"April 30","team1":"Lahore","team2":"Hyderabad","venue":"Lahore"},
  {"date":"May 2","stage":"Qualifier","venue":"Rawalpindi"},
  {"date":"May 3","stage":"Eliminator 1","venue":"Multan"},
  {"date":"May 5","stage":"Eliminator 2","venue":"Multan"},
  {"date":"May 10","stage":"Final","venue":"TBD"}
];

let matchCount = 1;
const countPerDate: Record<string, number> = {};

export const MATCHES: Match[] = rawMatchData.map((m) => {
  const isPlayoff = !!m.stage;
  const matchId = matchCount++;
  
  if (!countPerDate[m.date]) {
    countPerDate[m.date] = 0;
  }
  countPerDate[m.date]++;
  
  // Parse date string like "March 26" natively for 2026.
  // We'll set the time. If it's the 1st match on a day, make it 14:00. Second match 19:00.
  const hour = countPerDate[m.date] === 1 && Object.values(rawMatchData).filter(x => x.date === m.date).length > 1 ? 14 : 19;
  const parsedDate = new Date(`${m.date}, 2026 ${hour}:30:00 PST`);
  
  return {
    id: matchId,
    dateStr: m.date,
    timestamp: parsedDate.getTime(),
    team1: m.team1 ? NAME_TO_TEAM_CODE[m.team1] : undefined,
    team2: m.team2 ? NAME_TO_TEAM_CODE[m.team2] : undefined,
    venue: m.venue,
    stage: m.stage,
    isPlayoff
  };
});

// Helper function to get the current/next match
export function getUpcomingMatches(): Match[] {
  const now = Date.now();
  // Filter matches that are in the future, sort by date
  return MATCHES.filter(m => m.timestamp > now).sort((a, b) => a.timestamp - b.timestamp);
}

export function getNextMatch(): Match | undefined {
  const upcoming = getUpcomingMatches();
  return upcoming.length > 0 ? upcoming[0] : undefined;
}

export function getTodayMatches(): Match[] {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  // Find matches that correspond to the current real date
  return MATCHES.filter(m => m.dateStr === todayStr);
}
