export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
  videoUrl?: string;
}
export interface WorkoutProgram {
  goal: string;
  startsOn: string;
  endsOn: string;
  guidance: string;
  paceZones: { name: string; pace: string }[];
}
export interface WorkoutEntry {
  assignmentId: string;
  assignmentCreatedAt: string;
  sessionId: string;
  completed: boolean;
  notes: string;
  updatedAt: string;
}
export interface WorkoutSession {
  week?: number;
  day?: string;
  kind?: "strength" | "run";
  preparation?: string;
  cooldown?: string;
  guidance?: string;
  id: string;
  name: string;
  exercises: WorkoutExercise[];
}
export interface WorkoutPlan {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  program?: WorkoutProgram;
  sessions: WorkoutSession[];
}
export interface PlanAssignment {
  id: string;
  studentId: string;
  planId: string;
  month: string;
  createdAt: string;
  snapshot: {
    title: string;
    description: string;
    sessions: WorkoutSession[];
    program?: WorkoutProgram;
  };
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
