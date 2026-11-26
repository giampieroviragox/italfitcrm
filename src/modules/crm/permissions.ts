import type { AdminMember, CrmState, CrmStudent } from "./model.ts";
import { assignmentCoachId } from "./online-coaching.ts";
import { coachName } from "./student-coach.ts";
import { normalize } from "./model.ts";

/**
 * Team permissions. The owner (super admin) always has every permission and is
 * the only one who manages the team. Other members get a role preset that the
 * owner can customise per person. Everything is enforced on the server.
 */
export const permissionCatalog = {
  "students.all": {
    label: "Tutti gli studenti",
    hint: "Senza questo permesso vede solo gli studenti che segue come coach.",
  },
  "students.edit": {
    label: "Crea e modifica studenti",
    hint: "Anagrafica, tier, accesso alla piattaforma e inviti.",
  },
  plans: {
    label: "Piani di allenamento",
    hint: "Libreria piani e assegnazione dei piani mensili.",
  },
  agenda: {
    label: "Agenda del team",
    hint: "Vede l’agenda condivisa, fissa call e appuntamenti, vede gli orari occupati.",
  },
  lessons: {
    label: "Calendario lezioni",
    hint: "Lezioni, disponibilità, iscrizioni e consuntivi.",
  },
  coaching: {
    label: "Abbonamenti Coaching online",
    hint: "Crea e modifica abbonamenti, periodi e prezzi.",
  },
  payments: {
    label: "Pagamenti lezioni",
    hint: "Wallet, pacchetti, ricevute e saldi delle lezioni in sede.",
  },
  "accounting.online": {
    label: "Contabilità Coaching online",
    hint: "Incassi degli abbonamenti e valore dei piani.",
  },
  "accounting.lessons": {
    label: "Contabilità lezioni",
    hint: "Incassi e importi delle lezioni in sede per sede.",
  },
  "compensation.all": {
    label: "Compensi di tutti i coach",
    hint: "Senza questo permesso ciascuno vede solo il proprio compenso.",
  },
  settings: {
    label: "Impostazioni",
    hint: "Tier e proprietà delle schede.",
  },
} as const;
export type Permission = keyof typeof permissionCatalog;
export const allPermissions = Object.keys(permissionCatalog) as Permission[];
export const isPermission = (v: unknown): v is Permission =>
  typeof v === "string" && Object.hasOwn(permissionCatalog, v);

export const teamRoles = {
  admin: {
    label: "Admin",
    hint: "Gestisce studenti, piani, calendario e coaching online. Non vede pagamenti e contabilità delle lezioni.",
    permissions: [
      "students.all",
      "students.edit",
      "plans",
      "agenda",
      "lessons",
      "coaching",
      "accounting.online",
      "compensation.all",
      "settings",
    ] as Permission[],
  },
  coach: {
    label: "Coach",
    hint: "Vede solo i propri studenti, gestisce i loro piani e consulta il proprio compenso.",
    permissions: ["plans", "agenda"] as Permission[],
  },
} as const;
export type TeamRole = keyof typeof teamRoles;
export const isTeamRole = (v: unknown): v is TeamRole =>
  typeof v === "string" && Object.hasOwn(teamRoles, v);
export const roleLabel = (member: AdminMember) =>
  member.role === "owner"
    ? "Super admin"
    : teamRoles[member.teamRole ?? "admin"].label;

/** Effective permissions; members saved before roles existed keep "admin". */
export function memberPermissions(member: AdminMember | undefined) {
  if (!member) return new Set<Permission>();
  if (member.role === "owner") return new Set(allPermissions);
  return new Set(
    member.permissions ?? teamRoles[member.teamRole ?? "admin"].permissions,
  );
}

export interface StaffScope {
  adminId: string;
  owner: boolean;
  can: (permission: Permission) => boolean;
  /** Students the member may see; undefined means all. */
  students?: Set<string>;
}
export function staffScope(state: CrmState, adminId: string): StaffScope {
  const member = state.admins.find((a) => a.id === adminId);
  const permissions = memberPermissions(member);
  return {
    adminId,
    owner: member?.role === "owner",
    can: (p) => permissions.has(p),
    students: permissions.has("students.all")
      ? undefined
      : coachedStudentIds(state, adminId),
  };
}
/** Local fallback without accounts: a single super admin. */
export const localScope: StaffScope = {
  adminId: "owner-demo",
  owner: true,
  can: () => true,
};

/** Students followed by a coach: reference coach, subscription or plan coach. */
export function coachedStudentIds(state: CrmState, adminId: string) {
  const member = state.admins.find((a) => a.id === adminId);
  const name = member ? normalize(coachName(member.name)) : "";
  const ids = new Set<string>();
  for (const s of state.students) {
    if (
      (name && normalize(coachName(s.coach)) === name) ||
      s.onlineSubscriptions?.some((sub) => sub.coachId === adminId)
    )
      ids.add(s.id);
  }
  for (const a of state.assignments ?? [])
    if (assignmentCoachId(state, a) === adminId) ids.add(a.studentId);
  return ids;
}
export const seesStudent = (scope: StaffScope, id: string) =>
  !scope.students || scope.students.has(id);

/** Removes what the member may not see before the state reaches the browser. */
export function projectState(state: CrmState, scope: StaffScope): CrmState {
  if (scope.owner) return state;
  const visible = (s: CrmStudent) => seesStudent(scope, s.id);
  const students = state.students.filter(visible).map((s) => {
    const next = { ...s };
    if (!scope.can("payments")) delete next.lessonWallet;
    // Plan values stay visible (they are the basis of the coach's
    // compensation); collected payments do not.
    if (!scope.can("coaching") && !scope.can("accounting.online")) {
      next.onlineSubscriptions = s.onlineSubscriptions?.map((sub) => ({
        ...sub,
        payments: [],
      }));
      delete next.onlineReceipts;
    }
    return next;
  });
  const ids = new Set(students.map((s) => s.id));
  const bookings = (state.bookings ?? []).filter((b) => ids.has(b.studentId));
  return {
    ...state,
    students,
    assignments: (state.assignments ?? []).filter((a) => ids.has(a.studentId)),
    bookings: scope.can("lessons") ? (state.bookings ?? []) : bookings,
    lessons: scope.can("lessons")
      ? state.lessons
      : (state.lessons ?? []).filter((l) =>
          bookings.some((b) => b.lessonId === l.id),
        ),
    admins: state.admins.map((a) =>
      scope.can("compensation.all") || a.id === scope.adminId
        ? a
        : { ...a, compensationPercent: undefined },
    ),
  };
}

const json = (v: unknown) => JSON.stringify(v ?? null);
const studentFields = (s: CrmStudent) =>
  json({
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    phone: s.phone,
    coach: s.coach,
    tierId: s.tierId,
    tierIds: s.tierIds,
    status: s.status,
    joinedAt: s.joinedAt,
    archived: s.archived,
    accessDisabled: s.accessDisabled,
    properties: s.properties,
  });

/**
 * Puts back what the member could not see and rejects changes outside their
 * permissions. The result then goes through the usual staff validation.
 */
export function restrictUpdate(
  current: CrmState,
  proposed: CrmState,
  scope: StaffScope,
): CrmState {
  if (scope.owner) return proposed;
  const deny = (what: string) => {
    throw new Error(`Non hai i permessi per modificare ${what}.`);
  };
  const hidden = current.students.filter((s) => !seesStudent(scope, s.id));
  const hiddenIds = new Set(hidden.map((s) => s.id));
  if (proposed.students.some((s) => hiddenIds.has(s.id)))
    deny("studenti che non segui");
  const students = [...proposed.students, ...hidden];
  if (!scope.can("students.edit"))
    for (const s of proposed.students) {
      const old = current.students.find((x) => x.id === s.id);
      if (!old || studentFields(old) !== studentFields(s))
        deny("le schede studente");
    }
  const visibleIds = new Set(proposed.students.map((s) => s.id));
  const assignments = [
    ...(proposed.assignments ?? []),
    ...(current.assignments ?? []).filter((a) => !visibleIds.has(a.studentId)),
  ];
  if (
    (proposed.assignments ?? []).some((a) => !seesStudent(scope, a.studentId))
  )
    deny("i piani di studenti che non segui");
  if (
    !scope.can("plans") &&
    (json(proposed.plans) !== json(current.plans) ||
      json(proposed.assignments) !==
        json(
          (current.assignments ?? []).filter((a) =>
            visibleIds.has(a.studentId),
          ),
        ))
  )
    deny("i piani");
  if (
    !scope.can("plans") &&
    proposed.students.some(
      (s) =>
        json(s.guidedPrograms) !==
        json(current.students.find((x) => x.id === s.id)?.guidedPrograms),
    )
  )
    deny("i programmi guidati");
  let lessons = proposed.lessons,
    bookings = proposed.bookings;
  if (!scope.can("lessons")) {
    const visibleBookings = (current.bookings ?? []).filter((b) =>
      visibleIds.has(b.studentId),
    );
    const visibleLessons = (current.lessons ?? []).filter((l) =>
      visibleBookings.some((b) => b.lessonId === l.id),
    );
    if (
      json(proposed.bookings ?? []) !== json(visibleBookings) ||
      json(proposed.lessons ?? []) !== json(visibleLessons)
    )
      deny("il calendario delle lezioni");
    lessons = current.lessons;
    bookings = current.bookings;
  }
  if (
    !scope.can("settings") &&
    (json(proposed.tiers) !== json(current.tiers) ||
      json(proposed.properties) !== json(current.properties))
  )
    deny("tier e proprietà");
  return {
    ...proposed,
    students,
    assignments,
    lessons,
    bookings,
    // Hidden compensation values come back from the saved state.
    admins: proposed.admins.map((a) => ({
      ...a,
      compensationPercent: current.admins.find((x) => x.id === a.id)
        ?.compensationPercent,
    })),
  };
}

export function requirePermission(scope: StaffScope, permission: Permission) {
  if (!scope.can(permission))
    throw new Error(
      `Il tuo ruolo non include: ${permissionCatalog[permission].label}.`,
    );
}
export function requireStudent(scope: StaffScope, studentId: string) {
  if (!seesStudent(scope, studentId))
    throw new Error("Non segui questo studente.");
}
