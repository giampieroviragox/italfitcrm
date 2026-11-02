import { normalize, type CrmState, type CrmStudent } from "./model.ts";
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
): StudentCoach | undefined {
  const name = student.coach.trim();
  if (!name) return undefined;
  const matches = state.admins.filter(
    (a) => normalize(a.name) === normalize(name),
  );
  const avatarUrl = matches.length === 1 ? matches[0]?.avatarUrl : undefined;
  return { name, ...(validCoachImage(avatarUrl) ? { avatarUrl } : {}) };
}
