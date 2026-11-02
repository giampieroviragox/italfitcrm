"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNavigationRequest } from "./use-unsaved-changes";
import { StudentProfile } from "./student-profile";

export function StudentProfileSheet({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const request = useNavigationRequest();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) request(close);
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:md:w-1/2 data-[side=right]:md:min-w-[560px] data-[side=right]:sm:max-w-none"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-5 pr-16">
          <SheetTitle>Scheda studente</SheetTitle>
          <SheetDescription className="sr-only">
            Dati, proprietà, piani, commenti e cronologia dello studente.
          </SheetDescription>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/studenti/${encodeURIComponent(id)}`}>
              Apri pagina completa
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <StudentProfile id={id} embedded />
        </div>
      </SheetContent>
    </Sheet>
  );
}
