import 'server-only';

import { storageAdapter, type RecentInteraction } from '@/lib/storage';
import type { MasteryEntry, StudentProfile } from '@/lib/student/schema';

/**
 * Distilling the interaction stream into a profile.
 *
 * Deliberately deterministic — no model call. Mastery has to be explainable to
 * a teacher ("3 of 4 correct, one hint"), and a rollup that costs a Postgres
 * query can run after every widget instead of on a nightly job.
 *
 * All I/O goes through `storageAdapter()` now — this module owns the scoring
 * formula (Laplace smoothing, misconception collection), not the storage
 * calls, so a different `StorageAdapter` doesn't have to reimplement any of
 * this math, only answer "give me the rollup/interaction rows."
 */

export async function loadProfile(studentId: string): Promise<StudentProfile> {
  return storageAdapter().loadProfile(studentId);
}

export async function recomputeProfile(studentId: string): Promise<StudentProfile> {
  const adapter = storageAdapter();

  const [rollup, recent] = await Promise.all([
    adapter.fetchMasteryRollup(studentId),
    adapter.fetchRecentInteractions(studentId, 500),
  ]);

  const answered = recent.filter((event) => event.correct !== null);
  const hints = recent.filter((event) => event.eventType === 'hint_requested').length;

  const mastery: MasteryEntry[] = rollup
    .map((row) => {
      const hintRate = Math.min(row.hints / Math.max(row.attempts, 1), 1);

      // Laplace smoothing keeps a single lucky answer away from 1.0, and a
      // single miss away from 0.0, until there is enough evidence to earn it.
      const smoothed = (row.correctCount + 1) / (row.attempts + 2);

      return {
        learningComponentId: row.learningComponentId,
        standardCode: row.standardCode,
        score: clamp01(smoothed * (1 - hintRate * 0.4)),
        attempts: row.attempts,
        lastSeenAt: row.lastSeenAt,
      };
    })
    // Weakest first: the generator reads the head of this list.
    .sort((a, b) => a.score - b.score);

  const profile: StudentProfile = {
    mastery,
    pacing: {
      medianResponseMs: median(answered.map((event) => event.elapsedMs)),
      hintRate: answered.length ? hints / answered.length : 0,
      accuracy: answered.length
        ? answered.filter((event) => event.correct).length / answered.length
        : 0,
    },
    confirmedMisconceptions: collectMisconceptions(recent),
    updatedAt: new Date().toISOString(),
  };

  await adapter.saveProfile(studentId, profile);
  return profile;
}

/**
 * A misconception counts as confirmed only when the student got the item wrong
 * while the widget had named that misconception as the thing it was probing.
 */
function collectMisconceptions(events: RecentInteraction[]) {
  const seen = new Set<string>();

  for (const event of events) {
    if (event.correct !== false) continue;
    const payload = event.payload as { misconception?: unknown } | null;
    if (typeof payload?.misconception === 'string' && payload.misconception.trim()) {
      seen.add(payload.misconception.trim().slice(0, 200));
    }
    if (seen.size >= 8) break;
  }

  return [...seen];
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
