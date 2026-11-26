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
  /** Day the session was actually done (Europe/Rome). */
  performedOn?: string;
  /** Perceived effort, 1–10. */
  rpe?: number;
  /** Sets actually done, per prescribed exercise. */
  exercises?: import("./workout-log.ts").ExerciseLog[];
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
  /** Client a personalized plan belongs to. */
  studentId?: string;
  /** Guided program this plan is a version of. */
  guidedCategory?: import("./plan-cycles.ts").GuidedCategory;
  /** When the plan was last published: the newest guided version is the current one. */
  publishedAt?: string;
}
export interface PlanAssignment {
  id: string;
  studentId: string;
  planId: string;
  /** Month of the cycle start (accounting month). */
  month: string;
  /** Four-week cycle: start day and start + 27 days. Older records have only `month`. */
  startsOn?: string;
  endsOn?: string;
  /** Set when the plan is a guided program version. */
  guidedCategory?: import("./plan-cycles.ts").GuidedCategory;
  createdAt: string;
  /** Coach who follows this plan; defaults to the subscription coach. */
  coachId?: string;
  snapshot: {
    title: string;
    description: string;
    sessions: WorkoutSession[];
    program?: WorkoutProgram;
  };
}
export interface Lesson {
  settlement?: import("./lesson-wallet.ts").LessonSettlement;
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
