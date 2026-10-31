import "server-only";
import { demoStudents } from "./demo-data";
import type { Student } from "@/types/domain";

/** Read-only demo boundary. Replace with authorized Supabase queries at integration. */
export interface StudentRepository {
  list(): Promise<readonly Student[]>;
  findById(id: string): Promise<Student | null>;
}

export const studentRepository: StudentRepository = {
  async list() {
    return demoStudents;
  },
  async findById(id) {
    return demoStudents.find((student) => student.id === id) ?? null;
  },
};
