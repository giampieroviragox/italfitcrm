export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Caricamento workspace">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-52 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <span className="sr-only">Caricamento in corso…</span>
    </div>
  );
}
