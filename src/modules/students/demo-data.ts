import type { Student } from "@/types/domain";

// Entirely fictional fixtures. Never store real personal data in source code.
export const demoStudents: readonly Student[] = [
  {
    id: "demo-001",
    firstName: "Alessandro",
    lastName: "Rossi",
    email: "alessandro.rossi@example.com",
    status: "active",
    tierId: "online",
    joinedAt: "2026-10-26",

    coach: "Giorgio",
  },
  {
    id: "demo-002",
    firstName: "Giulia",
    lastName: "Bianchi",
    email: "giulia.bianchi@example.com",
    status: "active",
    tierId: "studio",
    joinedAt: "2026-10-24",

    coach: "Giorgio",
  },
  {
    id: "demo-003",
    firstName: "Marco",
    lastName: "Ferrari",
    email: "marco.ferrari@example.com",
    status: "invited",
    tierId: "online",
    joinedAt: "2026-10-23",

    coach: "Giorgio",
  },
  {
    id: "demo-004",
    firstName: "Sofia",
    lastName: "Romano",
    email: "sofia.romano@example.com",
    status: "active",
    tierId: "online",
    joinedAt: "2026-10-20",

    coach: "Giorgio",
  },
  {
    id: "demo-005",
    firstName: "Luca",
    lastName: "Conti",
    email: "luca.conti@example.com",
    status: "paused",
    tierId: "studio",
    joinedAt: "2026-10-18",

    coach: "Giorgio",
  },
  {
    id: "demo-006",
    firstName: "Chiara",
    lastName: "Ricci",
    email: "chiara.ricci@example.com",
    status: "active",
    tierId: "studio",
    joinedAt: "2026-10-15",

    coach: "Giorgio",
  },
  {
    id: "demo-007",
    firstName: "Davide",
    lastName: "Moretti",
    email: "davide.moretti@example.com",
    status: "active",
    tierId: "online",
    joinedAt: "2026-10-12",

    coach: "Giorgio",
  },
  {
    id: "demo-008",
    firstName: "Elena",
    lastName: "Marino",
    email: "elena.marino@example.com",
    status: "active",
    tierId: "studio",
    joinedAt: "2026-10-09",

    coach: "Giorgio",
  },
];
