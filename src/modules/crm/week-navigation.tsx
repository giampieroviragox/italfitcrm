"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, todayRome, weekStart } from "./fitness-logic";
export function WeekNavigation({
  week,
  onChange,
}: {
  week: string;
  onChange: (week: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-full text-sm font-semibold tracking-tight tabular-nums min-[380px]:w-auto sm:text-[15px]">
        {new Intl.DateTimeFormat("it-IT", {
          day: "numeric",
          month: "short",
          timeZone: "Europe/Rome",
        }).format(new Date(week + "T12:00Z"))}
        {" – "}
        {new Intl.DateTimeFormat("it-IT", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Europe/Rome",
        }).format(new Date(addDays(week, 6) + "T12:00Z"))}
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-md"
          aria-label="Settimana precedente"
          onClick={() => onChange(addDays(week, -7))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-md"
          aria-label="Settimana successiva"
          onClick={() => onChange(addDays(week, 7))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-2 rounded-md text-xs"
          onClick={() => onChange(weekStart(todayRome()))}
        >
          Oggi
        </Button>
      </div>
    </div>
  );
}
