import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/client';
import { recomputeProfile } from '@/lib/student/profile';
import { telemetryBatch } from '@/lib/student/schema';

export const runtime = 'nodejs';

/** Cap on a single event's JSONB payload, so a hostile client cannot bloat the table. */
const MAX_PAYLOAD_BYTES = 4_000;

/**
 * POST /api/telemetry — append-only writes.
 *
 * Returns as soon as the rows land. Profile recomputation only runs when a
 * batch closes out a widget, which keeps the interactive path clear of it.
 */
export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const parsed = telemetryBatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid batch', issues: parsed.error.issues }, { status: 400 });
  }
  const { sessionId, studentId, events } = parsed.data;

  const db = supabaseAdmin();

  // The service role bypasses RLS, so ownership is checked explicitly here.
  const { data: session } = await db
    .from('pathway_sessions')
    .select('student_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.student_id !== studentId) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const rows = events.map((event) => ({
    session_id: sessionId,
    student_id: studentId,
    widget_kind: event.widgetKind,
    event_type: event.eventType,
    standard_code: event.standardCode,
    learning_component_id: event.learningComponentId,
    elapsed_ms: event.elapsedMs,
    correct: event.correct,
    payload: truncate(event.payload),
  }));

  const { error } = await db.from('interactions').insert(rows);
  if (error) {
    console.error('[telemetry] insert failed', error);
    return Response.json({ error: 'Write failed' }, { status: 500 });
  }

  if (events.some((event) => event.eventType === 'widget_completed')) {
    await recomputeProfile(studentId);
  }

  return Response.json({ accepted: rows.length }, { status: 202 });
}

function truncate(payload: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(payload);
  return serialized.length <= MAX_PAYLOAD_BYTES
    ? payload
    : { truncated: true, bytes: serialized.length };
}
