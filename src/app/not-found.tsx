import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground tabular-nums">404</p>
      <h1 className="mt-1 text-2xl font-medium tracking-[-0.02em]">
        Pagina non trovata
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        La pagina o la scheda che cerchi non è disponibile.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/admin">Torna alla Home</Link>
      </Button>
    </div>
  );
}
