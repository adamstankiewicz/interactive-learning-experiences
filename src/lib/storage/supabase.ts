import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/client';
import type { Assignment, RosterStudent } from '@/lib/roster/types';
import { EMPTY_PROFILE, studentProfile, type StudentProfile } from '@/lib/student/schema';
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
    // Genuinely declining to write (no credentials) — distinct from failing to.
    if (!supabaseConfigured()) return null;

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

    // Thrown, not swallowed into a null: this is the one write whose failure
    // costs the teacher their share link, and a schema that has drifted from
    // `supabase/migrations` reports itself here ("Could not find the
    // 'step_widgets' column…") or nowhere at all. The caller logs it and
    // carries the reason to the UI.
    if (error) throw new Error(error.message);
    return data.id;
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

  async sessionExists(sessionId) {
    if (!supabaseConfigured()) return false;

    const { data } = await supabaseAdmin()
      .from('pathway_sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle();

    return Boolean(data);
  },

  async updateSessionPlan(sessionId, studentId, plan) {
    if (!supabaseConfigured()) return false;

    const { data, error } = await supabaseAdmin()
      .from('pathway_sessions')
      .update({ plan })
      .eq('id', sessionId)
      .eq('student_id', studentId)
      .select('id');

    // Thrown rather than logged: swallowing it made the route's 502 branch
    // unreachable, so a failed write reported success to the teacher. A
    // malformed uuid (22P02) is the exception — that is a caller sending a
    // junk id, which matches no row rather than failing the server.
    if (error) {
      if (error.code === '22P02') return false;
      throw new Error(error.message);
    }
    return (data?.length ?? 0) > 0;
  },

  async recordSessionOpen(sessionId, studentId) {
    if (!supabaseConfigured()) return;
    const { error } = await supabaseAdmin()
      .from('session_opens')
      .upsert({ session_id: sessionId, student_id: studentId }, { onConflict: 'session_id,student_id', ignoreDuplicates: true });
    if (error) console.error('[storage] recordSessionOpen failed', error);
  },

  async recordSessionCompletion(sessionId) {
    if (!supabaseConfigured()) return;
    const { error } = await supabaseAdmin().rpc('increment_pathway_session_completion_count', {
      p_session_id: sessionId,
    });
    if (error) console.error('[storage] recordSessionCompletion failed', error);
  },

  async sessionStats(sessionId) {
    if (!supabaseConfigured()) return null;

    const [{ count: openCount }, { data: sessionData }] = await Promise.all([
      supabaseAdmin().from('session_opens').select('*', { count: 'exact', head: true }).eq('session_id', sessionId),
      supabaseAdmin().from('pathway_sessions').select('completion_count').eq('id', sessionId).maybeSingle(),
    ]);

    if (!sessionData) return null;
    return { openCount: openCount ?? 0, completionCount: sessionData.completion_count };
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

  async listRosterStudents(): Promise<RosterStudent[]> {
    if (!supabaseConfigured()) return [];
    const { data } = await supabaseAdmin()
      .from('roster_students')
      .select('*')
      .order('created_at', { ascending: true });
    return (data ?? []).map(rowToRosterStudent);
  },

  async getRosterStudent(id): Promise<RosterStudent | null> {
    if (!supabaseConfigured()) return null;
    const { data } = await supabaseAdmin().from('roster_students').select('*').eq('id', id).maybeSingle();
    return data ? rowToRosterStudent(data) : null;
  },

  async createRosterStudent(student): Promise<RosterStudent> {
    const { data, error } = await supabaseAdmin()
      .from('roster_students')
      .insert(rosterStudentToRow(student))
      .select('*')
      .single();
    if (error || !data) throw new Error(`[storage] createRosterStudent failed: ${error?.message}`);
    return rowToRosterStudent(data);
  },

  async updateRosterStudent(id, student): Promise<RosterStudent | null> {
    if (!supabaseConfigured()) return null;
    const { data, error } = await supabaseAdmin()
      .from('roster_students')
      .update(rosterStudentToRow(student))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) { console.error('[storage] updateRosterStudent failed', error); return null; }
    return data ? rowToRosterStudent(data) : null;
  },

  async createAssignment(input): Promise<Assignment> {
    const { data, error } = await supabaseAdmin()
      .from('assignments')
      .insert({ roster_student_id: input.rosterStudentId, session_id: input.sessionId, topic: input.topic })
      .select('*')
      .single();
    if (error || !data) throw new Error(`[storage] createAssignment failed: ${error?.message}`);
    return rowToAssignment(data);
  },

  async listAssignmentsForStudent(rosterStudentId): Promise<Assignment[]> {
    if (!supabaseConfigured()) return [];
    const { data } = await supabaseAdmin()
      .from('assignments')
      .select('*')
      .eq('roster_student_id', rosterStudentId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToAssignment);
  },

  async listAssignmentsForSession(sessionId): Promise<Assignment[]> {
    if (!supabaseConfigured()) return [];
    const { data } = await supabaseAdmin()
      .from('assignments')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToAssignment);
  },

  async listSessions(limit = 50): Promise<SessionSummary[]> {
    if (!supabaseConfigured()) return [];
    const { data } = await supabaseAdmin()
      .from('pathway_sessions')
      .select('id, topic, standard_code, grade_hint, completion_count, created_at, session_opens(count)')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      topic: String(row.topic),
      standardCode: row.standard_code ? String(row.standard_code) : null,
      gradeHint: row.grade_hint ? String(row.grade_hint) : null,
      openCount: Number((row.session_opens as unknown as { count: number }[])?.[0]?.count ?? 0),
      completionCount: Number(row.completion_count ?? 0),
      createdAt: String(row.created_at),
    }));
  },

  async sessionReport(sessionId): Promise<SessionStudentRow[]> {
    if (!supabaseConfigured()) return [];

    // Get all assignments for this session to map anon studentId → roster student.
    const { data: assignmentRows } = await supabaseAdmin()
      .from('assignments')
      .select('roster_student_id, session_id, roster_students(id, name)')
      .eq('session_id', sessionId);

    // Get the session's own student_id (the anon owner).
    const { data: sessionRow } = await supabaseAdmin()
      .from('pathway_sessions')
      .select('student_id, plan')
      .eq('id', sessionId)
      .maybeSingle();

    // Build anon studentId → roster info mapping via the session owner.
    // Each assignment creates a fresh anon student + session — the session's
    // student_id IS the anon student for that assignment's pathway copy.
    // We need: for each assignment's session, get the session's student_id.
    const anonToRoster = new Map<string, { rosterStudentId: string; name: string }>();
    if (assignmentRows) {
      for (const a of assignmentRows) {
        const rs = (a as Record<string, unknown>).roster_students as { id: string; name: string } | null;
        if (!rs) continue;
        // Each assignment points to a specific session (the personalized copy).
        // That session's student_id is the anon student who did the work.
        const { data: assignedSession } = await supabaseAdmin()
          .from('pathway_sessions')
          .select('student_id')
          .eq('id', String((a as Record<string, unknown>).session_id))
          .maybeSingle();
        if (assignedSession) {
          anonToRoster.set(String(assignedSession.student_id), {
            rosterStudentId: String(rs.id),
            name: String(rs.name),
          });
        }
      }
    }

    // Aggregate interactions for this session grouped by student.
    const { data: interactionRows } = await supabaseAdmin()
      .from('interactions')
      .select('student_id, event_type, correct, elapsed_ms')
      .eq('session_id', sessionId);

    const byStudent = new Map<string, {
      attempts: number; correctCount: number; hintsUsed: number;
      elapsedMs: number[]; lastSeenAt: string;
    }>();

    for (const row of interactionRows ?? []) {
      const sid = String(row.student_id);
      const entry = byStudent.get(sid) ?? { attempts: 0, correctCount: 0, hintsUsed: 0, elapsedMs: [], lastSeenAt: new Date(0).toISOString() };
      if (row.correct !== null) entry.attempts += 1;
      if (row.correct === true) entry.correctCount += 1;
      if (row.event_type === 'hint_requested') entry.hintsUsed += 1;
      if (row.elapsed_ms != null) entry.elapsedMs.push(Number(row.elapsed_ms));
      entry.lastSeenAt = new Date().toISOString();
      byStudent.set(sid, entry);
    }

    // Include session owner even with no interactions.
    if (sessionRow && !byStudent.has(String(sessionRow.student_id))) {
      byStudent.set(String(sessionRow.student_id), { attempts: 0, correctCount: 0, hintsUsed: 0, elapsedMs: [], lastSeenAt: new Date().toISOString() });
    }

    const stepCount = (sessionRow?.plan as { steps?: unknown[] } | null)?.steps?.length ?? 0;

    return [...byStudent.entries()].map(([studentId, row]) => {
      const sorted = [...row.elapsedMs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length === 0 ? null : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      const roster = anonToRoster.get(studentId) ?? null;
      return {
        studentId,
        rosterStudentId: roster?.rosterStudentId ?? null,
        rosterStudentName: roster?.name ?? null,
        attempts: row.attempts,
        correctCount: row.correctCount,
        hintsUsed: row.hintsUsed,
        completed: stepCount > 0 && row.attempts >= stepCount,
        medianElapsedMs: median,
        lastSeenAt: row.lastSeenAt,
      };
    });
  },
};

function rowToRosterStudent(row: Record<string, unknown>): RosterStudent {
  return {
    id: String(row.id),
    name: String(row.name),
    grade: String(row.grade),
    learningStyle: row.learning_style as RosterStudent['learningStyle'],
    preferredActivityTypes: (row.preferred_activity_types as string[]) ?? [],
    avoidActivityTypes: (row.avoid_activity_types as string[]) ?? [],
    adaptations: String(row.adaptations ?? ''),
    pacingPreference: String(row.pacing_preference ?? ''),
    attentionSpanMinutes: Number(row.attention_span_minutes ?? 20),
    socialPreference: String(row.social_preference ?? 'pairs') as RosterStudent['socialPreference'],
    motivators: (row.motivators as string[]) ?? [],
    feedbackStyle: String(row.feedback_style ?? ''),
    readingLevelGrade: String(row.reading_level_grade ?? ''),
  };
}

function rosterStudentToRow(s: Omit<RosterStudent, 'id'>): Record<string, unknown> {
  return {
    name: s.name,
    grade: s.grade,
    learning_style: s.learningStyle,
    preferred_activity_types: s.preferredActivityTypes,
    avoid_activity_types: s.avoidActivityTypes,
    adaptations: s.adaptations,
    pacing_preference: s.pacingPreference,
    attention_span_minutes: s.attentionSpanMinutes,
    social_preference: s.socialPreference,
    motivators: s.motivators,
    feedback_style: s.feedbackStyle,
    reading_level_grade: s.readingLevelGrade,
  };
}

function rowToAssignment(row: Record<string, unknown>): Assignment {
  return {
    id: String(row.id),
    rosterStudentId: String(row.roster_student_id),
    sessionId: String(row.session_id),
    topic: String(row.topic),
    createdAt: String(row.created_at),
  };
}
