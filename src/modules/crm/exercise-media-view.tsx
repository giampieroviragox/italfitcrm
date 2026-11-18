"use client";

import Image from "next/image";
import { ArrowUpRight, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  googleImagesUrl,
  isStructuralLabel,
  movementAnimation,
  movementImage,
  movementThumb,
  movementLabel,
  movements,
  movementsForName,
  youtubeSearchUrl,
} from "./exercise-media";

const linkClass =
  "inline-flex min-h-9 items-center gap-1 text-sm font-medium underline underline-offset-4 hover:text-foreground text-muted-foreground";

const isHttp = (url?: string) => !!url && /^https?:\/\//.test(url);

/** Start and end positions side by side. */
function Figure({ id, className }: { id: string; className?: string }) {
  return (
    <Image
      src={movementImage(id)}
      alt={`Come si esegue: ${movementLabel(id)}. Posizione di partenza e di arrivo.`}
      width={740}
      height={300}
      unoptimized
      className={className ?? "h-auto w-full rounded-xl"}
    />
  );
}

/** The movement from start to end and back. Stands still with reduced motion. */
function MovingFigure({ id }: { id: string }) {
  return (
    <Image
      src={movementAnimation(id)}
      alt={`Come si esegue: ${movementLabel(id)}.`}
      width={360}
      height={300}
      unoptimized
      className="h-auto w-full rounded-xl"
    />
  );
}

export function ExerciseLinks({
  name,
  videoUrl,
}: {
  name: string;
  videoUrl?: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-4">
      {isHttp(videoUrl) && (
        <a
          className={linkClass}
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Video del coach
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      )}
      <a
        className={linkClass}
        href={googleImagesUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Immagini su Google
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
      <a
        className={linkClass}
        href={youtubeSearchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Video su YouTube
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}

/** Large figure(s) with the search links, shown inside a card. */
export function ExerciseHero({
  name,
  videoUrl,
}: {
  name: string;
  videoUrl?: string;
}) {
  const ids = movementsForName(name);
  if (!name.trim() || (ids.length === 0 && isStructuralLabel(name)))
    return null;
  return (
    <div className="mt-4 flex flex-col gap-1">
      {ids.length > 0 && (
        <div className="flex max-w-sm flex-col gap-3">
          {ids.map((id) => (
            <figure key={id} className="m-0">
              <MovingFigure id={id} />
              {ids.length > 1 && (
                <figcaption className="mt-1 text-xs text-muted-foreground">
                  {movementLabel(id)}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      <ExerciseLinks name={name} videoUrl={videoUrl} />
    </div>
  );
}

/**
 * Small preview for lists. With a figure it opens a panel with the large
 * picture and the links; without one it links straight to Google Images.
 */
export function ExerciseThumb({
  name,
  videoUrl,
}: {
  name: string;
  videoUrl?: string;
}) {
  const ids = movementsForName(name);
  if (!name.trim() || (ids.length === 0 && isStructuralLabel(name)))
    return null;
  if (ids.length === 0) {
    return (
      <a
        href={googleImagesUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Cerca immagini di ${name} su Google`}
        className="grid h-[52px] w-[62px] shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground hover:text-foreground"
      >
        <Search className="size-4" aria-hidden />
      </a>
    );
  }
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Mostra come si esegue ${name}`}
          className="h-[52px] w-[62px] shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-white outline-offset-2 hover:border-foreground/40"
        >
          <Image
            src={movementThumb(ids[0]!)}
            alt=""
            width={120}
            height={100}
            unoptimized
            className="size-full object-cover"
          />
        </button>
      </SheetTrigger>
      <SheetContent side="center" className="overflow-y-auto p-0">
        <SheetHeader className="pr-12">
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            Il movimento dalla partenza all’arrivo. I muscoli che lavorano sono
            in rosso.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {ids.map((id) => (
            <figure key={id} className="m-0 flex flex-col gap-2">
              <div className="mx-auto w-full max-w-sm">
                <MovingFigure id={id} />
              </div>
              <Figure id={id} />
              <figcaption className="text-xs text-muted-foreground">
                {movementLabel(id)} · partenza e arrivo
              </figcaption>
            </figure>
          ))}
          <ExerciseLinks name={name} videoUrl={videoUrl} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Under the name field of the plan editor: shows which drawing the name gets. */
export function ExercisePreview({ name }: { name: string }) {
  if (!name.trim()) return null;
  const ids = movementsForName(name);
  if (ids.length === 0 && isStructuralLabel(name)) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
      <ExerciseThumb name={name} />
      <span>
        {ids.length > 0
          ? `Disegno: ${ids.map(movementLabel).join(" + ")}`
          : "Nessun disegno per questo nome: lo studente vedrà il link a Google Immagini."}
      </span>
    </div>
  );
}

/** Suggestions for the exercise name field, one per drawn movement. */
export function ExerciseNameSuggestions({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {movements.map((m) => (
        <option key={m.id} value={m.label} />
      ))}
    </datalist>
  );
}
