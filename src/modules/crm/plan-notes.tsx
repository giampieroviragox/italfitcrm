"use client";
import Image from "next/image";
import { useId, useState, useRef, useEffect } from "react";
import { ChevronRight, Flag, Gauge, Wind, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { StudentCoach } from "./student-coach";
import type { WorkoutProgram } from "./fitness-model";

export function CoachNote({
  text,
  coach,
}: {
  text: string;
  coach?: StudentCoach;
}) {
  const [expanded, setExpanded] = useState(false),
    [failedImage, setFailedImage] = useState("");
  const id = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [canExpand, setCanExpand] = useState(text.length > 220);
  useEffect(() => {
    if (expanded || !textRef.current) return;
    const element = textRef.current;
    const measure = () =>
      setCanExpand(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const frame = requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [expanded, text]);
  const initials = coach?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  return (
    <section
      className="rounded-2xl border p-5"
      aria-label="Messaggio del coach"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground text-xs font-medium text-background">
          {coach?.avatarUrl && failedImage !== coach.avatarUrl ? (
            <Image
              src={coach.avatarUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-full object-cover"
              onError={() => setFailedImage(coach.avatarUrl!)}
            />
          ) : (
            initials || (
              <Image
                src="/brand/team-italfit.svg"
                alt=""
                width={22}
                height={22}
              />
            )
          )}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Dal tuo coach</h3>
          <p className="truncate text-xs text-muted-foreground">
            {coach?.name ?? "Team Italfit"}
          </p>
        </div>
      </div>
      <p
        ref={textRef}
        id={id}
        className={`${expanded ? "" : "line-clamp-5"} whitespace-pre-line text-sm leading-6 text-muted-foreground`}
      >
        {text}
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-1 inline-flex min-h-9 items-center gap-1 text-[13px] font-medium"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Leggi di meno" : "Leggi di più"}
          <ChevronRight
            className={`size-4 transition-transform ${expanded ? "-rotate-90" : "rotate-90"}`}
          />
        </button>
      )}
    </section>
  );
}
export function RecoveryNote({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  if (!text) return null;
  const lines = text.split("\n").filter((s) => s.trim());
  return (
    <section className="rounded-xl bg-muted px-4 py-3.5">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Wind className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {title}
      </h4>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-sm leading-6 text-muted-foreground">
            {line.replace(/^[•]\s*/, "")}
          </p>
        ))}
      </div>
    </section>
  );
}
export function ProgramReference({ program }: { program: WorkoutProgram }) {
  const zones = program.paceZones;
  return (
    <section aria-label="Riferimenti del programma" className="space-y-3 pt-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Da tenere a mente
      </h3>
      {zones.length > 0 && (
        <section className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Gauge
              className="size-4 text-muted-foreground"
              strokeWidth={1.75}
            />
            <h4 className="text-sm font-medium">Le tue zone di passo</h4>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
            {zones.map((zone, i) => (
              <div
                key={`${zone.name}-${i}`}
                className="min-w-0 bg-background px-4 py-3"
              >
                <dt className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground"
                    style={{ opacity: Math.min(1, 0.25 + i * 0.15) }}
                  />
                  {zone.name}
                </dt>
                <dd className="text-base font-medium tabular-nums">
                  {zone.pace}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {program.guidance && (
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-foreground/[.02]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[.045]">
                <Flag className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  Indicazioni del percorso
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  Obiettivo, indicazioni e check di fine blocco
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent
            showCloseButton={false}
            className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
          >
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 size-11"
                aria-label="Chiudi indicazioni"
              >
                <X />
              </Button>
            </SheetClose>
            <SheetHeader className="border-b p-5 pr-16 sm:p-6 sm:pr-16">
              <SheetTitle>Indicazioni del percorso</SheetTitle>
              <SheetDescription>{program.goal}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6">
              {program.guidance.split(/\n\s*\n/).map((paragraph, i) => (
                <p
                  key={i}
                  className="whitespace-pre-line text-sm leading-6 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}
