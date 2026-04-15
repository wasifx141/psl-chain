/**
 * Reusable empty state component
 */

import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = '📦',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="text-5xl mb-4" role="img" aria-label={title}>
        {icon}
      </div>
      <h3 className="font-display text-xl font-bold text-foreground mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-md">{description}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        <>
          {actionHref ? (
            <Link
              href={actionHref}
              className="bg-gold-gradient rounded-lg px-6 py-2 text-sm font-semibold text-primary-foreground hover:brightness-90"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="bg-gold-gradient rounded-lg px-6 py-2 text-sm font-semibold text-primary-foreground hover:brightness-90"
            >
              {actionLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
