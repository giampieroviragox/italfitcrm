"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Last-resort boundary for pages outside the admin area (student area, auth pages). */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center"
    >
      <h1 className="text-lg font-medium tracking-[-0.02em]">
        Qualcosa non ha funzionato
      </h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        La pagina non si è caricata. Controlla la connessione e riprova: i tuoi
        dati non sono stati toccati.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Riprova</Button>
        <Button asChild variant="outline">
          <Link href="/login">Torna all’inizio</Link>
        </Button>
      </div>
    </main>
  );
}
