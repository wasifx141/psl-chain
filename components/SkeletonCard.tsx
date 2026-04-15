export default function SkeletonCard() {
  return (
    <div className="card-surface rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-16 w-16 rounded-full animate-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded animate-shimmer" />
          <div className="h-3 w-1/2 rounded animate-shimmer" />
        </div>
      </div>
      <div className="h-6 w-1/3 rounded animate-shimmer mb-3" />
      <div className="h-3 w-full rounded animate-shimmer mb-2" />
      <div className="h-10 w-full rounded-lg animate-shimmer" />
    </div>
  );
}
