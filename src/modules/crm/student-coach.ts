import { normalize, type CrmState, type CrmStudent } from "./model.ts";
export const defaultCoachName = "Giorgio Galbiati";
/** Used when the default coach has no photo on an admin record. */
export const defaultCoachAvatarUrl = "/coaches/giorgio-galbiati.jpg";

export function coachName(value: string) {
  const name = value.trim();
  return !name || normalize(name) === "giorgio" ? defaultCoachName : name;
}

export interface StudentCoach {
  name: string;
  avatarUrl?: string;
}
export function validCoachImage(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2000) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
export function isStudentCoach(value: unknown): value is StudentCoach {
  return Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string" &&
    (!("avatarUrl" in value) || validCoachImage(value.avatarUrl)),
  );
}
export function assignedStudentCoach(
  state: CrmState,
  student: CrmStudent,
): StudentCoach {
  const name = coachName(student.coach);
  const matches = state.admins.filter(
    (a) => normalize(coachName(a.name)) === normalize(name),
  );
  const saved = matches.length === 1 ? matches[0]?.avatarUrl : undefined;
  const avatarUrl = validCoachImage(saved)
    ? saved
    : normalize(name) === normalize(defaultCoachName)
      ? defaultCoachAvatarUrl
      : undefined;
  return { name, ...(avatarUrl ? { avatarUrl } : {}) };
}
