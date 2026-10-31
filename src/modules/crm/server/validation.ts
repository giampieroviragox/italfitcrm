import type { CrmState } from "../model.ts";
import { prepareTransition } from "../transition.ts";
import type { Access } from "./auth";
import { HttpError } from "./errors.ts";
export function validateStaffUpdate(
  current: CrmState,
  proposed: CrmState,
  access: Access,
): CrmState {
  for (const key of [
    "students",
    "tiers",
    "properties",
    "admins",
    "plans",
    "assignments",
    "lessons",
    "bookings",
  ] as const) {
    const before = current[key] ?? [],
      after = proposed[key] ?? [];
    if (before.some((x) => !after.some((y) => y.id === x.id)))
      throw new HttpError(
        400,
        "Archivia i record per conservarne i collegamenti.",
      );
  }
  const oldOwner = current.admins.find((a) => a.role === "owner"),
    newOwner = proposed.admins.find((a) => a.role === "owner");
  if (!oldOwner || !newOwner || oldOwner.id !== newOwner.id)
    throw new HttpError(403, "Il proprietario non può essere sostituito.");
  const adminData = (admins: CrmState["admins"]) =>
    JSON.stringify(
      admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        status: a.status,
      })),
    );
  if (
    access.role !== "owner" &&
    adminData(current.admins) !== adminData(proposed.admins)
  )
    throw new HttpError(
      403,
      "Solo il proprietario può gestire gli amministratori.",
    );
  for (const a of proposed.admins) {
    const old = current.admins.find((x) => x.id === a.id);
    if (
      (!old && (a.role !== "admin" || a.status !== "draft")) ||
      (old && (a.role !== old.role || a.status !== old.status))
    )
      throw new HttpError(
        403,
        "I ruoli e gli accessi vengono gestiti dal server.",
      );
  }
  for (const key of ["students", "admins"] as const)
    for (const item of proposed[key]) {
      const old = current[key].find((x) => x.id === item.id);
      if (old?.access && old.email !== item.email)
        throw new HttpError(
          400,
          "L’email di un account già collegato non può essere modificata dalla scheda.",
        );
    }
  const actor = {
    id: access.record_id,
    name:
      current.admins.find((a) => a.id === access.record_id)?.name ??
      "Amministratore",
  };
  const cleaned = {
    ...proposed,
    admins: proposed.admins.map((a) => ({
      ...a,
      access: current.admins.find((old) => old.id === a.id)?.access ?? null,
    })),
    students: proposed.students.map((s) => {
      const old = current.students.find((x) => x.id === s.id);
      const notes = s.notes ?? [];
      if (
        (old?.notes ?? []).some(
          (n) =>
            !notes.some(
              (x) => x.id === n.id && JSON.stringify(x) === JSON.stringify(n),
            ),
        )
      )
        throw new HttpError(
          400,
          "Le note esistenti non possono essere sovrascritte.",
        );
      return {
        ...s,
        access: old?.access ?? null,
        notes: notes.map((n) =>
          (old?.notes ?? []).some((x) => x.id === n.id)
            ? n
            : {
                id: crypto.randomUUID(),
                text: n.text,
                actorId: actor.id,
                actorName: actor.name,
                createdAt: new Date().toISOString(),
              },
        ),
        revision: old?.revision ?? 0,
        history: old?.history ?? [],
      };
    }),
  };
  try {
    return prepareTransition(current, cleaned, actor);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
}
