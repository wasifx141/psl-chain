/**
 * Reusable match card component
 */

import { TeamBadge } from './TeamBadge';
import type { MatchData } from '@/lib/types';

interface MatchCardProps {
  match: MatchData;
  showResult?: boolean;
  onClick?: () => void;
}

export function MatchCard({ match, showResult = false, onClick }: MatchCardProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.();
        }
      }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <TeamBadge teamCode={match.team1 || 'TBD'} size="sm" />
          <span className="text-sm font-semibold text-muted-foreground">vs</span>
          <TeamBadge teamCode={match.team2 || 'TBD'} size="sm" />
        </div>
        <p className="text-xs text-muted-foreground">
          {match.stage && <span className="font-semibold">{match.stage} • </span>}
          {match.venue}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-foreground">{formatDate(match.timestamp)}</p>
        <p className="text-xs text-muted-foreground">
          {showResult ? <span className="text-lg">✓</span> : formatTime(match.timestamp)}
        </p>
      </div>
    </div>
  );
}
