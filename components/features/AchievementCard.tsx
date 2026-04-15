/**
 * Achievement card component
 */

interface AchievementCardProps {
  icon: string;
  name: string;
  description: string;
  earned: boolean;
}

export function AchievementCard({ icon, name, description, earned }: AchievementCardProps) {
  return (
    <div
      className={`card-surface rounded-xl p-5 transition-all ${
        earned ? 'border-primary glow-gold' : 'opacity-50'
      }`}
      role="article"
      aria-label={`Achievement: ${name}`}
    >
      <div className="text-3xl mb-2" role="img" aria-label={name}>
        {icon}
      </div>
      <h4 className="font-display text-sm font-bold text-foreground">
        {name}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-2 text-xs font-semibold">
        {earned ? (
          <span className="text-green" aria-label="Earned">✓ Earned</span>
        ) : (
          <span className="text-muted-foreground" aria-label="Locked">Locked</span>
        )}
      </p>
    </div>
  );
}
