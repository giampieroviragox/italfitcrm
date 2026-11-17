"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { permissionCatalog, type Permission } from "./permissions";
import { useCan } from "./store";

/** Shows the page only when the team member has one of the permissions. */
export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission | Permission[];
  children: ReactNode;
}) {
  const can = useCan();
  const needed = Array.isArray(permission) ? permission : [permission];
  if (needed.some(can)) return children;
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border bg-card px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="text-base font-medium">Sezione non disponibile</h1>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Il tuo ruolo non include: {permissionCatalog[needed[0]!].label}. Chiedi
        al super admin se ti serve l’accesso.
      </p>
      <Button asChild className="mt-5" variant="outline">
        <Link href="/admin">Torna alla home</Link>
      </Button>
    </div>
  );
}
