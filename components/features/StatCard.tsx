/**
 * Reusable stat card component
 */

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  className?: string;
}

export function StatCard({ label, value, icon, className = '' }: StatCardProps) {
  return (
    <div className={`card-surface rounded-xl p-6 text-center ${className}`}>
      {icon && (
        <div className="text-3xl mb-2" role="img" aria-label={label}>
          {icon}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary font-display">
        {value}
      </p>
    </div>
  );
}
