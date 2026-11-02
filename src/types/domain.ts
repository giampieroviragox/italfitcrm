/** Domain models, independent of the future database and its generated types. */
export type AppRole = "admin" | "student";
export type StudentStatus = "active" | "invited" | "paused";
export type TierId = "online" | "studio";

export interface Tier {
  id: TierId;
  name: string;
  description: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: StudentStatus;
  tierId: string;
  tierIds?: string[];
  access?: {
    status: "invited" | "active";
    invitedAt: string;
    enabled?: boolean;
  } | null;
  accessDisabled?: boolean;
  archived?: boolean;
  properties?: Record<string, string | number | boolean | string[]>;
  joinedAt: string;
  coach: string;
}
