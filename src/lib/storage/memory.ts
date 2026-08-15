import { randomUUID } from 'node:crypto';

import { SEED_STUDENTS } from '@/lib/roster/seed';
import type { Assignment, RosterStudent } from '@/lib/roster/types';
import { EMPTY_PROFILE, type StudentProfile } from '@/lib/student/schema';
import type {
  InteractionEvent,
  MasteryRollupRow,
  PersistedSession,
  RecentInteraction,
  SessionStudentRow,
  SessionSummary,
  StorageAdapter,
} from '@/lib/storage/types';

/**
 * A real second `StorageAdapter` — in-process, no external service, gone on
 * restart — proving the interface is genuinely pluggable rather than
 * Supabase-shaped with extra steps, and letting the whole app run with zero
 * external dependencies (a demo, a test, a self-hoster who doesn't want a
 * database yet). This is the file to copy for a real second backend (a
 * plain Postgres connection, SQLite, another BaaS): same shape, different
 * storage underneath.
 *
 * State lives on `globalThis`, not a plain module-scoped variable — confirmed
 * necessary by testing, not assumed: Next.js's App Router bundles Route
 * Handlers (`/api/pathway`) and Server Components (`/learn/[sessionId]`)
 * into separate chunks, each getting its own instance of a module-scoped
 * `const`, even within one running server process (reproduced in both
 * `next dev` and `next start`). `globalThis` is the one object every chunk
 * genuinely shares — the same reason a Prisma client singleton is usually
 * pinned there in a Next.js app. Still gone on an actual process restart,
 * which is the real, honest limitation of this adapter: fine for a demo or
 * a single-process deployment, not for anything that scales past one.
 */

type StoredSession = PersistedSession & {
  gradeHint: string | null;
  rejectedCodes: string[];
  openCount: number;
  completionCount: number;
  createdAt: string;
};

type MemoryStore = {
  students: Set<string>;
  sessions: Map<string, StoredSession>;
  interactions: InteractionEvent[];
  profiles: Map<string, StudentProfile>;
  rosterStudents: Map<string, RosterStudent>;
  assignments: Assignment[];
  // keyed as "sessionId:studentId" — upsert semantics, no double-counting
  sessionOpens: Set<string>;
};

const globalStore = globalThis as typeof globalThis & { __pathwayMemoryStore?: MemoryStore };

if (!globalStore.__pathwayMemoryStore) {
  // Opt-in, not automatic. This adapter is the fallback whenever Supabase is
  // unconfigured, and `GET /api/roster` is unauthenticated — so seeding by
  // default meant a misconfigured deployment served a roster of learner
  // profiles to anyone who asked.
  const seededRosterStudents = new Map<string, RosterStudent>();
  if (process.env.SEED_DEMO_ROSTER === '1') {
    for (const s of SEED_STUDENTS) {
      const id = randomUUID();
      seededRosterStudents.set(id, { ...s, id });
    }
  }

  globalStore.__pathwayMemoryStore = {
    students: new Set(),
    sessions: new Map(),
    interactions: [],
    profiles: new Map(),
    rosterStudents: seededRosterStudents,
    assignments: [],
    sessionOpens: new Set(),
  };
}

const store: MemoryStore = globalStore.__pathwayMemoryStore;

const { students, sessions, interactions, profiles, rosterStudents, assignments, sessionOpens } = store;

export const memoryStorageAdapter: StorageAdapter = {
  id: 'memory',

  configured() {
    return true;
  },

  async createStudent() {
    const id = randomUUID();
    students.add(id);
    return id;
  },

  async ensureStudent(studentId) {
    students.add(studentId);
  },

  async persistSession(input) {
    const id = randomUUID();
    sessions.set(id, {
      id,
      studentId: input.studentId,
      topic: input.topic,
      gradeHint: input.gradeHint,
      anchor: input.anchor,
      plan: input.plan,
      stepWidgets: input.stepWidgets,
      rejectedCodes: input.rejectedCodes,
      openCount: 0,
      completionCount: 0,
      createdAt: new Date().toISOString(),
    });
    return id;
  },

  async updateSessionPlan(sessionId, studentId, plan) {
    const session = sessions.get(sessionId);
    if (!session || session.studentId !== studentId) return false;
    session.plan = plan;
    return true;
  },

  async recordSessionOpen(sessionId, studentId) {
    sessionOpens.add(`${sessionId}:${studentId}`);
  },

  async recordSessionCompletion(sessionId) {
    const session = sessions.get(sessionId);
    if (session) session.completionCount += 1;
  },

  async sessionStats(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    const openCount = [...sessionOpens].filter((k) => k.startsWith(`${sessionId}:`)).length;
    return { openCount, completionCount: session.completionCount };
  },

  async loadSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    const { id, studentId, topic, anchor, plan, stepWidgets } = session;
    return { id, studentId, topic, anchor, plan, stepWidgets };
  },

  async sessionExists(sessionId) {
    return sessions.has(sessionId);
  },

  async recordInteractions(events) {
    interactions.push(...events);
  },

  async loadProfile(studentId): Promise<StudentProfile> {
    return profiles.get(studentId) ?? EMPTY_PROFILE;
  },

  async saveProfile(studentId, profile) {
    profiles.set(studentId, profile);
  },

  async fetchMasteryRollup(studentId): Promise<MasteryRollupRow[]> {
    const byComponent = new Map<string, MasteryRollupRow>();

    for (const event of interactions) {
      if (event.studentId !== studentId || !event.learningComponentId) continue;

      const key = event.learningComponentId;
      const row = byComponent.get(key) ?? {
        learningComponentId: key,
        standardCode: event.standardCode,
        attempts: 0,
        correctCount: 0,
        hints: 0,
        lastSeenAt: new Date(0).toISOString(),
      };

      if (event.correct !== null) row.attempts += 1;
      if (event.correct) row.correctCount += 1;
      if (event.eventType === 'hint_requested') row.hints += 1;
      row.lastSeenAt = new Date().toISOString();

      byComponent.set(key, row);
    }

    return [...byComponent.values()];
  },

  async fetchRecentInteractions(studentId, limit): Promise<RecentInteraction[]> {
    return interactions
      .filter((event) => event.studentId === studentId)
      .slice(-limit)
      .reverse()
      .map((event) => ({ eventType: event.eventType, correct: event.correct, elapsedMs: event.elapsedMs, payload: event.payload }));
  },

  async listRosterStudents() {
    return [...rosterStudents.values()];
  },

  async getRosterStudent(id) {
    return rosterStudents.get(id) ?? null;
  },

  async createRosterStudent(student) {
    const id = randomUUID();
    const row: RosterStudent = { ...student, id };
    rosterStudents.set(id, row);
    return row;
  },

  async updateRosterStudent(id, student) {
    if (!rosterStudents.has(id)) return null;
    const row: RosterStudent = { ...student, id };
    rosterStudents.set(id, row);
    return row;
  },

  async createAssignment(input) {
    const assignment: Assignment = {
      id: randomUUID(),
      rosterStudentId: input.rosterStudentId,
      sessionId: input.sessionId,
      parentSessionId: input.parentSessionId,
      topic: input.topic,
      createdAt: new Date().toISOString(),
    };
    assignments.push(assignment);
    return assignment;
  },

  async listAssignmentsForStudent(rosterStudentId) {
    // Newest first, matching the Supabase adapter's `order('created_at', desc)`.
    // StudentHomepage renders this list directly, so insertion order here meant
    // the student saw their pathways reversed depending on the backend.
    return assignments
      .filter((a) => a.rosterStudentId === rosterStudentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listAssignmentsForSession(sessionId) {
    return assignments.filter((a) => a.sessionId === sessionId);
  },

  async listChildAssignments(parentSessionId) {
    return assignments.filter((a) => a.parentSessionId === parentSessionId);
  },

  async listSessions(limit = 50): Promise<SessionSummary[]> {
    const childSessionIds = new Set(assignments.map((a) => a.sessionId));
    // Build a map: parentSessionId → child session IDs, for completion rollup
    const childrenByParent = new Map<string, string[]>();
    for (const a of assignments) {
      if (!a.parentSessionId) continue;
      const arr = childrenByParent.get(a.parentSessionId) ?? [];
      arr.push(a.sessionId);
      childrenByParent.set(a.parentSessionId, arr);
    }
    return [...sessions.values()]
      .filter((s) => !childSessionIds.has(s.id))
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, limit)
      .map((s) => {
        const childIds = childrenByParent.get(s.id) ?? [];
        const childCompletions = childIds.reduce((sum, cid) => sum + (sessions.get(cid)?.completionCount ?? 0), 0);
        const childOpens = childIds.reduce((sum, cid) => sum + [...sessionOpens].filter((k) => k.startsWith(`${cid}:`)).length, 0);
        return {
          id: s.id,
          topic: s.topic,
          standardCode: (s.anchor as { standard?: { code?: string } })?.standard?.code ?? null,
          gradeHint: s.gradeHint,
          openCount: [...sessionOpens].filter((k) => k.startsWith(`${s.id}:`)).length + childOpens,
          completionCount: s.completionCount + childCompletions,
          createdAt: s.createdAt ?? new Date().toISOString(),
        };
      });
  },

  async sessionReport(sessionId): Promise<SessionStudentRow[]> {
    const sessionObj = sessions.get(sessionId);

    // Child assignments where this is the parent session.
    const childAssignments = assignments.filter((a) => a.parentSessionId === sessionId);

    // Map: anonymous studentId → { rosterStudentId, name }
    // Built from child assignments: each child assignment has its own session,
    // and that session's studentId is the anon student who did the work.
    const rosterByAnon = new Map<string, { rosterStudentId: string; name: string }>();
    // Also track which session IDs belong to children (to pull their interactions).
    const childSessionIds = new Set<string>();
    for (const a of childAssignments) {
      const student = rosterStudents.get(a.rosterStudentId);
      const childSession = sessions.get(a.sessionId);
      if (childSession && student) {
        rosterByAnon.set(childSession.studentId, {
          rosterStudentId: a.rosterStudentId,
          name: student.name,
        });
        childSessionIds.add(a.sessionId);
      }
    }

    // Aggregate interaction events from the parent session AND all child sessions.
    const relevantSessionIds = new Set([sessionId, ...childSessionIds]);
    const byStudent = new Map<string, {
      attempts: number; correctCount: number; hintsUsed: number;
      elapsedMs: number[]; lastSeenAt: string;
    }>();

    for (const event of interactions) {
      if (!relevantSessionIds.has(event.sessionId)) continue;
      const row = byStudent.get(event.studentId) ?? { attempts: 0, correctCount: 0, hintsUsed: 0, elapsedMs: [], lastSeenAt: new Date(0).toISOString() };
      if (event.correct !== null) row.attempts += 1;
      if (event.correct === true) row.correctCount += 1;
      if (event.eventType === 'hint_requested') row.hintsUsed += 1;
      row.elapsedMs.push(event.elapsedMs);
      row.lastSeenAt = new Date().toISOString();
      byStudent.set(event.studentId, row);
    }

    // Include roster students from child assignments even with no interactions yet.
    for (const a of childAssignments) {
      const childSession = sessions.get(a.sessionId);
      if (childSession && !byStudent.has(childSession.studentId)) {
        byStudent.set(childSession.studentId, { attempts: 0, correctCount: 0, hintsUsed: 0, elapsedMs: [], lastSeenAt: childSession.createdAt ?? new Date().toISOString() });
      }
    }

    // Include the parent session's own anon student (the teacher who built it).
    if (sessionObj && !byStudent.has(sessionObj.studentId)) {
      byStudent.set(sessionObj.studentId, { attempts: 0, correctCount: 0, hintsUsed: 0, elapsedMs: [], lastSeenAt: sessionObj.createdAt ?? new Date().toISOString() });
    }

    return [...byStudent.entries()].map(([studentId, row]) => {
      const sorted = [...row.elapsedMs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length === 0 ? null : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      const roster = rosterByAnon.get(studentId) ?? null;
      return {
        studentId,
        rosterStudentId: roster?.rosterStudentId ?? null,
        rosterStudentName: roster?.name ?? null,
        attempts: row.attempts,
        correctCount: row.correctCount,
        hintsUsed: row.hintsUsed,
        completed: row.attempts >= (sessionObj?.plan?.steps?.length ?? 0) && row.attempts > 0,
        medianElapsedMs: median,
        lastSeenAt: row.lastSeenAt,
      };
    });
  },
};
