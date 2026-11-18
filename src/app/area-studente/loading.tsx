export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Caricamento dell’area studente"
      className="mx-auto w-full max-w-[1040px] space-y-5 px-5 pt-20"
    >
      <div className="h-4 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((n) => (
          <div key={n} className="h-40 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <span className="sr-only">Caricamento in corso…</span>
    </main>
  );
}
