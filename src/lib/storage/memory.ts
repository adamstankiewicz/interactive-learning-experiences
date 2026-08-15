import { randomUUID } from 'node:crypto';

import { EMPTY_PROFILE, type StudentProfile } from '@/lib/student/schema';
import type {
  InteractionEvent,
  MasteryRollupRow,
  PersistedSession,
  RecentInteraction,
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
};

type MemoryStore = {
  students: Set<string>;
  sessions: Map<string, StoredSession>;
  interactions: InteractionEvent[];
  profiles: Map<string, StudentProfile>;
};

const globalStore = globalThis as typeof globalThis & { __pathwayMemoryStore?: MemoryStore };

if (!globalStore.__pathwayMemoryStore) {
  globalStore.__pathwayMemoryStore = {
    students: new Set(),
    sessions: new Map(),
    interactions: [],
    profiles: new Map(),
  };
}

const store: MemoryStore = globalStore.__pathwayMemoryStore;

const { students, sessions, interactions, profiles } = store;

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
    });
    return id;
  },

  async updateSessionPlan(sessionId, plan) {
    const session = sessions.get(sessionId);
    if (session) session.plan = plan;
  },

  async recordSessionOpen(sessionId) {
    const session = sessions.get(sessionId);
    if (session) session.openCount += 1;
  },

  async recordSessionCompletion(sessionId) {
    const session = sessions.get(sessionId);
    if (session) session.completionCount += 1;
  },

  async sessionStats(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    return { openCount: session.openCount, completionCount: session.completionCount };
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
};
