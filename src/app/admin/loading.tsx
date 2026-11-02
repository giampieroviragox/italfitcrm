export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Caricamento workspace">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">Caricamento in corso…</span>
    </div>
  );
}
