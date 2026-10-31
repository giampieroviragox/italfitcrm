import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Pagina non trovata
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        La pagina o la scheda che cerchi non è disponibile.
      </p>
      <Button asChild variant="outline" className="mt-7">
        <Link href="/admin">Torna alla Home</Link>
      </Button>
    </div>
  );
}
