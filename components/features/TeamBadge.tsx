/**
 * Team badge component with consistent styling
 */

import { TeamCode, TEAM_COLORS } from '@/config/players';

interface TeamBadgeProps {
  teamCode: TeamCode | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TeamBadge({ teamCode, size = 'md', className = '' }: TeamBadgeProps) {
  const colors = TEAM_COLORS[teamCode as TeamCode] || TEAM_COLORS.IU;
  
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-xl',
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        color: 'white',
      }}
      aria-label={`Team ${teamCode}`}
    >
      {teamCode}
    </div>
  );
}
