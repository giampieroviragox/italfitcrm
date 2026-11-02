"use client";
import Image from "next/image";
import { useId, useState, useRef, useEffect } from "react";
import { ArrowUpRight, ChevronRight, Flag, Gauge, X } from "lucide-react";
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
      className="rounded-2xl border border-black/6 bg-white p-5 sm:p-6"
      aria-label="Messaggio del coach"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9eedf] text-sm font-semibold text-[#46513e] ring-2 ring-white">
          {coach?.avatarUrl && failedImage !== coach.avatarUrl ? (
            <Image
              src={coach.avatarUrl}
              alt=""
              width={44}
              height={44}
              unoptimized
              className="size-full object-cover"
              onError={() => setFailedImage(coach.avatarUrl!)}
            />
          ) : (
            initials || (
              <Image
                src="/brand/team-italfit.svg"
                alt=""
                width={28}
                height={28}
              />
            )
          )}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Due parole dal coach</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {coach?.name ?? "Team Italfit"}
          </p>
        </div>
      </div>
      <p
        ref={textRef}
        id={id}
        className={`${expanded ? "" : "line-clamp-5"} whitespace-pre-line text-sm leading-7 text-[#565b53]`}
      >
        {text}
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[#46513e]"
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
    <section className="rounded-2xl bg-[#eef1e8] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80">
          <Image
            src="/illustrations/recovery.svg"
            width={26}
            height={26}
            alt=""
          />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#65725a]">
            Prenditi il tuo tempo
          </p>
          <h4 className="mt-1 text-base font-semibold tracking-tight">
            {title}
          </h4>
        </div>
      </div>
      <div className="space-y-3">
        {lines.map((line, i) => (
          <p key={i} className="text-sm leading-7 text-[#4b5742]">
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
    <section aria-label="Riferimenti del programma" className="space-y-3 pt-2">
      <h3 className="text-lg font-semibold tracking-tight">
        Da tenere a mente
      </h3>
      {zones.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-black/6 bg-white">
          <div className="flex items-center gap-3 px-5 pt-5">
            <Gauge className="size-4 text-[#65725a]" />
            <div>
              <h4 className="text-sm font-semibold">Le tue zone di passo</h4>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Il ritmo giusto per ogni lavoro.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-px bg-black/6 sm:grid-cols-3">
            {zones.map((zone, i) => (
              <div
                key={`${zone.name}-${i}`}
                className="min-w-0 bg-white p-4 sm:px-5"
              >
                <dt className="mb-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#70885f]"
                    style={{ opacity: Math.min(1, 0.35 + i * 0.13) }}
                  />
                  {zone.name}
                </dt>
                <dd className="text-lg font-semibold tracking-tight tabular-nums">
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
              className="flex min-h-20 w-full items-center gap-4 rounded-2xl border border-black/6 bg-white p-5 text-left transition-colors hover:bg-[#edf1e7]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#edf1e7]">
                <Flag className="size-4 text-[#536348]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  Indicazioni del percorso
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Obiettivo, indicazioni e check di fine blocco
                </span>
              </span>
              <ArrowUpRight className="size-4 shrink-0" />
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
                  className="whitespace-pre-line text-sm leading-7 text-muted-foreground"
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
