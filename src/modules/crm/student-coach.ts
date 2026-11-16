import { normalize, type CrmState, type CrmStudent } from "./model.ts";
export const defaultCoachName = "Giorgio Galbiati";

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
  const avatarUrl = matches.length === 1 ? matches[0]?.avatarUrl : undefined;
  return { name, ...(validCoachImage(avatarUrl) ? { avatarUrl } : {}) };
}
