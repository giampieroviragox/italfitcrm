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
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Settimana precedente"
        onClick={() => onChange(addDays(week, -7))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Settimana successiva"
        onClick={() => onChange(addDays(week, 7))}
      >
        <ChevronRight className="size-4" />
      </Button>
      <span className="mx-2 text-sm font-medium">
        {new Intl.DateTimeFormat("it-IT", {
          day: "numeric",
          month: "short",
        }).format(new Date(week + "T12:00Z"))}{" "}
        –{" "}
        {new Intl.DateTimeFormat("it-IT", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(addDays(week, 6) + "T12:00Z"))}
      </span>
      <Button variant="ghost" onClick={() => onChange(weekStart(todayRome()))}>
        Oggi
      </Button>
    </div>
  );
}
