import type { Anchor } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { StudentProfile } from '@/lib/student/schema';
import type { Assignment, RosterStudent } from '@/lib/roster/types';

/**
 * The third pluggable-provider seam, same shape as `model.ts` (LLM) and
 * `standardsSource()` (standards graph): everything the adaptive layer needs
 * from a persistence backend, so Supabase is one implementation rather than
 * `supabaseAdmin()`/`supabaseConfigured()` calls scattered across five files.
 *
 * The pure computation (Laplace-smoothed mastery scoring, misconception
 * collection) stays in `student/profile.ts`, not here — this interface is
 * I/O only, so a different backend only has to answer "give me the rows,"
 * not reimplement the scoring formula.
 */

export type PersistedSession = {
  id: string;
  studentId: string;
  topic: string;
  anchor: Anchor;
  plan: PathwayPlan;
  stepWidgets: Record<number, unknown>;
};

export type InteractionEvent = {
  sessionId: string;
  studentId: string;
  widgetKind: string;
  eventType: string;
  standardCode: string | null;
  learningComponentId: string | null;
  elapsedMs: number;
  correct: boolean | null;
  payload: Record<string, unknown>;
};

/** One row of the mastery rollup — Supabase computes this via a SQL view; a different backend can compute it however it likes. */
export type MasteryRollupRow = {
  learningComponentId: string;
  standardCode: string | null;
  attempts: number;
  correctCount: number;
  hints: number;
  lastSeenAt: string;
};

export type RecentInteraction = {
  eventType: string;
  correct: boolean | null;
  elapsedMs: number;
  payload: unknown;
};

/** Lightweight row for the pathways list view. */
export type SessionSummary = {
  id: string;
  topic: string;
  standardCode: string | null;
  gradeHint: string | null;
  openCount: number;
  completionCount: number;
  createdAt: string;
};

/** Per-student performance row for the session report view. */
export type SessionStudentRow = {
  studentId: string;
  /** Set when this student is also a roster student (came via an assignment). */
  rosterStudentId: string | null;
  rosterStudentName: string | null;
  attempts: number;
  correctCount: number;
  hintsUsed: number;
  completed: boolean;
  medianElapsedMs: number | null;
  lastSeenAt: string;
};

export interface StorageAdapter {
  id: string;
  /** Whether this adapter has what it needs to actually persist — the app runs stateless either way. */
  configured(): boolean;

  createStudent(): Promise<string | null>;
  /** Reinstate a student row if a cached client-side id has outlived its row — upsert, not an error. */
  ensureStudent(studentId: string): Promise<void>;

  persistSession(input: {
    studentId: string;
    topic: string;
    gradeHint: string | null;
    anchor: Anchor;
    plan: PathwayPlan;
    stepWidgets: Record<number, unknown>;
    rejectedCodes: string[];
  }): Promise<string | null>;
  loadSession(sessionId: string): Promise<PersistedSession | null>;
  /**
   * True when `sessionId` names a real session — the gate on accepting
   * telemetry for it.
   *
   * Deliberately existence, not ownership. A shared pathway is walked by
   * students who do not own it: the session belongs to the teacher who built
   * it, while each student arrives with their own anonymous id. Gating on
   * ownership silently drops every interaction a shared link produces, which
   * is the entire point of sharing one. Interactions stay attributed to the
   * student who made them, so participation never masquerades as ownership.
   */
  sessionExists(sessionId: string): Promise<boolean>;
  /**
   * A teacher hand-edited a prose field after generation — overwrite the
   * persisted plan so a share link reflects the edit.
   *
   * Ownership, not existence — the opposite of `sessionExists` above, and
   * deliberately so. That gate is loose because participation must not
   * require ownership; this one is strict because the session id is
   * published in every share link, so anyone holding a link could otherwise
   * rewrite the teacher's pathway for every student who opens it after them.
   *
   * Returns false when the session is unknown *or* owned by someone else —
   * the caller must not distinguish the two, or the endpoint becomes an
   * oracle for which session ids exist.
   */
  updateSessionPlan(sessionId: string, studentId: string, plan: PathwayPlan): Promise<boolean>;

  /** A share link got opened — upserts (sessionId, studentId) so refreshes don't double-count. */
  recordSessionOpen(sessionId: string, studentId: string): Promise<void>;
  /** A student reached the end of the walkthrough for this session. */
  recordSessionCompletion(sessionId: string): Promise<void>;
  sessionStats(sessionId: string): Promise<{ openCount: number; completionCount: number } | null>;

  recordInteractions(events: InteractionEvent[]): Promise<void>;

  loadProfile(studentId: string): Promise<StudentProfile>;
  saveProfile(studentId: string, profile: StudentProfile): Promise<void>;
  fetchMasteryRollup(studentId: string): Promise<MasteryRollupRow[]>;
  fetchRecentInteractions(studentId: string, limit: number): Promise<RecentInteraction[]>;

  // Roster
  listRosterStudents(): Promise<RosterStudent[]>;
  getRosterStudent(id: string): Promise<RosterStudent | null>;
  createRosterStudent(student: Omit<RosterStudent, 'id'>): Promise<RosterStudent>;
  updateRosterStudent(id: string, student: Omit<RosterStudent, 'id'>): Promise<RosterStudent | null>;

  // Assignments: one personalized session per roster student
  createAssignment(input: { rosterStudentId: string; sessionId: string; parentSessionId: string | null; topic: string }): Promise<Assignment>;
  listAssignmentsForStudent(rosterStudentId: string): Promise<Assignment[]>;
  listAssignmentsForSession(sessionId: string): Promise<Assignment[]>;
  /** All assignments where parentSessionId matches — the personalized child sessions of a parent. */
  listChildAssignments(parentSessionId: string): Promise<Assignment[]>;

  // Pathway dashboard
  listSessions(limit?: number): Promise<SessionSummary[]>;
  sessionReport(sessionId: string): Promise<SessionStudentRow[]>;
}
