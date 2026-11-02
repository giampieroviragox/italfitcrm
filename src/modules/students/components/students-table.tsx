import { CheckboxControl } from "@/components/ui/checkbox-control";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentIdentity } from "./student-identity";
import { studentAccessLabel } from "@/modules/crm/student-access";
import { StudentTierBadges } from "./tier-badge";
import { tiers } from "../config";
import {
  formatPropertyValue,
  type CrmTier,
  type CrmProperty,
} from "@/modules/crm/model";
import { formatDate } from "@/lib/format";
import type { Student } from "@/types/domain";
export function StudentsTable({
  students,
  compact = false,
  availableTiers = Object.values(tiers),
  propertyColumns = [],
  columnKeys,
  selection,
}: {
  students: readonly Student[];
  compact?: boolean;
  columnKeys?: string[];
  selection?: {
    selectedIds: string[];
    onToggle: (id: string, checked: boolean) => void;
    onTogglePage: (checked: boolean) => void;
  };
  availableTiers?: readonly Pick<CrmTier, "id" | "name">[];
  propertyColumns?: readonly CrmProperty[];
}) {
  const labels: Record<string, string> = {
    tier: "Tier",
    access: "Accesso",
    joinedAt: "Aggiunto il",
    phone: "Telefono",
    coach: "Coach",
  };
  const columns = (
    columnKeys ??
    (compact ? ["tier", "access"] : ["tier", "access", "joinedAt"])
  ).filter(
    (c) => labels[c] || propertyColumns.some((p) => `property:${p.id}` === c),
  );
  const checked =
    students.length > 0 &&
    students.every((s) => selection?.selectedIds.includes(s.id));
  const mixed =
    !checked && students.some((s) => selection?.selectedIds.includes(s.id));
  const cell = (student: Student, key: string): ReactNode => {
    const property = propertyColumns.find((p) => `property:${p.id}` === key);
    if (property) {
      const value = formatPropertyValue(
        property,
        student.properties?.[property.id],
      );
      return (
        <span className="block max-w-64 truncate" title={value}>
          {value}
        </span>
      );
    }
    switch (key) {
      case "tier":
        return <StudentTierBadges student={student} tiers={availableTiers} />;
      case "access":
        return studentAccessLabel(student);
      case "joinedAt":
        return (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(student.joinedAt)}
          </span>
        );
      case "coach":
        return student.coach || "—";
      case "phone":
        return student.phone ? (
          <a
            href={`tel:${student.phone.replace(/[^+\d]/g, "")}`}
            className="whitespace-nowrap hover:underline"
          >
            {student.phone}
          </a>
        ) : (
          "—"
        );
      default:
        return "—";
    }
  };
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
          {selection && (
            <TableHead className="w-10 pl-5">
              <CheckboxControl
                aria-label="Seleziona pagina"
                aria-checked={mixed ? "mixed" : checked}
                checked={checked}
                onChange={(e) => selection.onTogglePage(e.target.checked)}
              />
            </TableHead>
          )}
          <TableHead className="pl-5">Studente</TableHead>
          {columns.map((c) => (
            <TableHead key={c}>
              {labels[c] ??
                propertyColumns.find((p) => `property:${p.id}` === c)?.name}
            </TableHead>
          ))}
          <TableHead className="w-10">
            <span className="sr-only">Scheda</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student, index) => (
          <TableRow key={student.id}>
            {selection && (
              <TableCell className="pl-5">
                <CheckboxControl
                  aria-label={`Seleziona ${student.firstName} ${student.lastName}`}
                  checked={selection.selectedIds.includes(student.id)}
                  onChange={(e) =>
                    selection.onToggle(student.id, e.target.checked)
                  }
                />
              </TableCell>
            )}
            <TableCell className="py-4 pl-5">
              <Link
                href={`/admin/studenti/${encodeURIComponent(student.id)}`}
                className="inline-block rounded-sm hover:opacity-75"
              >
                <StudentIdentity student={student} index={index} />
              </Link>
            </TableCell>
            {columns.map((c) => (
              <TableCell key={c} className="text-xs">
                {cell(student, c)}
              </TableCell>
            ))}
            <TableCell className="pr-5">
              <Link
                href={`/admin/studenti/${encodeURIComponent(student.id)}`}
                aria-label={`Apri scheda di ${student.firstName} ${student.lastName}`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowUpRight className="size-3.5" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
