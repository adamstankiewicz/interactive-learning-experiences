import type { Anchor } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { StudentProfile } from '@/lib/student/schema';

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
  /** True when `studentId` owns `sessionId`. Needed explicitly wherever the backend has no RLS of its own to lean on. */
  sessionBelongsTo(sessionId: string, studentId: string): Promise<boolean>;

  recordInteractions(events: InteractionEvent[]): Promise<void>;

  loadProfile(studentId: string): Promise<StudentProfile>;
  saveProfile(studentId: string, profile: StudentProfile): Promise<void>;
  fetchMasteryRollup(studentId: string): Promise<MasteryRollupRow[]>;
  fetchRecentInteractions(studentId: string, limit: number): Promise<RecentInteraction[]>;
}
