"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border bg-white px-6 py-16 text-center"
    >
      <h1 className="text-xl font-semibold">Il workspace non si è caricato.</h1>
      <p className="mt-3 text-xs text-muted-foreground">
        Riprova per riprendere da dove eri rimasto.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Riprova</Button>
        <Button asChild variant="outline">
          <Link href="/admin">Panoramica</Link>
        </Button>
      </div>
    </div>
  );
}
