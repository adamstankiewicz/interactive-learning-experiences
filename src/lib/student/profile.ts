import 'server-only';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/client';
import {
  EMPTY_PROFILE,
  studentProfile,
  type MasteryEntry,
  type StudentProfile,
} from '@/lib/student/schema';

/**
 * Distilling the interaction stream into a profile.
 *
 * Deliberately deterministic — no model call. Mastery has to be explainable to
 * a teacher ("3 of 4 correct, one hint"), and a rollup that costs a Postgres
 * query can run after every widget instead of on a nightly job.
 */

export async function loadProfile(studentId: string): Promise<StudentProfile> {
  if (!supabaseConfigured()) return EMPTY_PROFILE;

  const { data } = await supabaseAdmin()
    .from('student_profiles')
    .select('profile')
    .eq('student_id', studentId)
    .maybeSingle();

  const parsed = studentProfile.safeParse(data?.profile);
  return parsed.success ? parsed.data : EMPTY_PROFILE;
}

export async function recomputeProfile(studentId: string): Promise<StudentProfile> {
  if (!supabaseConfigured()) return EMPTY_PROFILE;
  const db = supabaseAdmin();

  const [{ data: rollup }, { data: recent }] = await Promise.all([
    db.from('component_mastery_rollup').select('*').eq('student_id', studentId),
    db
      .from('interactions')
      .select('event_type, correct, elapsed_ms, payload')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const events = recent ?? [];
  const answered = events.filter((event) => event.correct !== null);
  const hints = events.filter((event) => event.event_type === 'hint_requested').length;

  const mastery: MasteryEntry[] = (rollup ?? [])
    .map((row) => {
      const attempts = Number(row.attempts ?? 0);
      const correct = Number(row.correct_count ?? 0);
      const hintRate = Math.min(Number(row.hints ?? 0) / Math.max(attempts, 1), 1);

      // Laplace smoothing keeps a single lucky answer away from 1.0, and a
      // single miss away from 0.0, until there is enough evidence to earn it.
      const smoothed = (correct + 1) / (attempts + 2);

      return {
        learningComponentId: String(row.learning_component_id),
        standardCode: row.standard_code ? String(row.standard_code) : null,
        score: clamp01(smoothed * (1 - hintRate * 0.4)),
        attempts,
        lastSeenAt: String(row.last_seen_at ?? new Date().toISOString()),
      };
    })
    // Weakest first: the generator reads the head of this list.
    .sort((a, b) => a.score - b.score);

  const profile: StudentProfile = {
    mastery,
    pacing: {
      medianResponseMs: median(answered.map((event) => Number(event.elapsed_ms ?? 0))),
      hintRate: answered.length ? hints / answered.length : 0,
      accuracy: answered.length
        ? answered.filter((event) => event.correct).length / answered.length
        : 0,
    },
    confirmedMisconceptions: collectMisconceptions(events),
    updatedAt: new Date().toISOString(),
  };

  await db
    .from('student_profiles')
    .upsert({ student_id: studentId, profile, updated_at: profile.updatedAt });

  return profile;
}

/**
 * A misconception counts as confirmed only when the student got the item wrong
 * while the widget had named that misconception as the thing it was probing.
 */
function collectMisconceptions(events: Array<{ correct: boolean | null; payload: unknown }>) {
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
