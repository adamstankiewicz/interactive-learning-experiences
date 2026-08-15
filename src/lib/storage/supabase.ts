import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/client';
import { EMPTY_PROFILE, studentProfile, type StudentProfile } from '@/lib/student/schema';
import type {
  InteractionEvent,
  MasteryRollupRow,
  PersistedSession,
  RecentInteraction,
  StorageAdapter,
} from '@/lib/storage/types';

/**
 * Supabase as one `StorageAdapter` implementation — the original, direct
 * `supabaseAdmin()` calls that used to live in five different route
 * handlers/modules, moved here verbatim rather than rewritten, so this is a
 * faithful wrap, not a behavior change.
 */
export const supabaseStorageAdapter: StorageAdapter = {
  id: 'supabase',

  configured: supabaseConfigured,

  async createStudent() {
    if (!supabaseConfigured()) return null;

    const { data, error } = await supabaseAdmin()
      .from('students')
      .insert({ display_name: 'Learner' })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[storage] createStudent failed', error);
      return null;
    }
    return data.id;
  },

  async ensureStudent(studentId) {
    if (!supabaseConfigured()) return;
    // The id comes from the browser's localStorage and can outlive the row it
    // referred to. Reinstate it rather than losing the session to a foreign key.
    await supabaseAdmin()
      .from('students')
      .upsert({ id: studentId }, { onConflict: 'id', ignoreDuplicates: true });
  },

  async persistSession(input) {
    if (!supabaseConfigured()) return null;

    try {
      const db = supabaseAdmin();
      await db.from('students').upsert({ id: input.studentId }, { onConflict: 'id', ignoreDuplicates: true });

      const { data, error } = await db
        .from('pathway_sessions')
        .insert({
          student_id: input.studentId,
          topic: input.topic,
          grade_hint: input.gradeHint,
          anchor: input.anchor,
          rejected_codes: input.rejectedCodes,
          plan: input.plan,
          step_widgets: input.stepWidgets,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('[storage] persistSession failed', error);
      return null;
    }
  },

  async loadSession(sessionId) {
    if (!supabaseConfigured()) return null;

    const { data, error } = await supabaseAdmin()
      .from('pathway_sessions')
      .select('id, student_id, topic, anchor, plan, step_widgets')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      studentId: data.student_id,
      topic: data.topic,
      anchor: data.anchor,
      plan: data.plan,
      stepWidgets: data.step_widgets ?? {},
    } satisfies PersistedSession;
  },

  async sessionBelongsTo(sessionId, studentId) {
    if (!supabaseConfigured()) return false;

    const { data } = await supabaseAdmin()
      .from('pathway_sessions')
      .select('student_id')
      .eq('id', sessionId)
      .maybeSingle();

    return Boolean(data) && data?.student_id === studentId;
  },

  async recordInteractions(events: InteractionEvent[]) {
    if (!supabaseConfigured()) return;

    const rows = events.map((event) => ({
      session_id: event.sessionId,
      student_id: event.studentId,
      widget_kind: event.widgetKind,
      event_type: event.eventType,
      standard_code: event.standardCode,
      learning_component_id: event.learningComponentId,
      elapsed_ms: event.elapsedMs,
      correct: event.correct,
      payload: event.payload,
    }));

    const { error } = await supabaseAdmin().from('interactions').insert(rows);
    if (error) {
      console.error('[storage] recordInteractions failed', error);
      throw error;
    }
  },

  async loadProfile(studentId): Promise<StudentProfile> {
    if (!supabaseConfigured()) return EMPTY_PROFILE;

    const { data } = await supabaseAdmin()
      .from('student_profiles')
      .select('profile')
      .eq('student_id', studentId)
      .maybeSingle();

    const parsed = studentProfile.safeParse(data?.profile);
    return parsed.success ? parsed.data : EMPTY_PROFILE;
  },

  async saveProfile(studentId, profile) {
    if (!supabaseConfigured()) return;
    await supabaseAdmin()
      .from('student_profiles')
      .upsert({ student_id: studentId, profile, updated_at: profile.updatedAt });
  },

  async fetchMasteryRollup(studentId): Promise<MasteryRollupRow[]> {
    if (!supabaseConfigured()) return [];

    const { data } = await supabaseAdmin()
      .from('component_mastery_rollup')
      .select('*')
      .eq('student_id', studentId);

    return (data ?? []).map((row) => ({
      learningComponentId: String(row.learning_component_id),
      standardCode: row.standard_code ? String(row.standard_code) : null,
      attempts: Number(row.attempts ?? 0),
      correctCount: Number(row.correct_count ?? 0),
      hints: Number(row.hints ?? 0),
      lastSeenAt: String(row.last_seen_at ?? new Date().toISOString()),
    }));
  },

  async fetchRecentInteractions(studentId, limit): Promise<RecentInteraction[]> {
    if (!supabaseConfigured()) return [];

    const { data } = await supabaseAdmin()
      .from('interactions')
      .select('event_type, correct, elapsed_ms, payload')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      eventType: row.event_type,
      correct: row.correct,
      elapsedMs: Number(row.elapsed_ms ?? 0),
      payload: row.payload,
    }));
  },
};
