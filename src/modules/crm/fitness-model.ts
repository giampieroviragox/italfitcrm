export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
  videoUrl?: string;
}
export interface WorkoutSession {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
}
export interface WorkoutPlan {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  sessions: WorkoutSession[];
}
export interface PlanAssignment {
  id: string;
  studentId: string;
  planId: string;
  month: string;
  createdAt: string;
  snapshot: { title: string; description: string; sessions: WorkoutSession[] };
}
export interface Lesson {
  availability?: { adminId: string };
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  coach: string;
  location: string;
  cancelled: boolean;
}
export interface LessonBooking {
  id: string;
  studentId: string;
  lessonId: string;
  createdAt: string;
  cancelled: boolean;
}
