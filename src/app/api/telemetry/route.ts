import { storageAdapter } from '@/lib/storage';
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
  const parsed = telemetryBatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid batch', issues: parsed.error.issues }, { status: 400 });
  }
  const { sessionId, studentId, events } = parsed.data;

  const adapter = storageAdapter();

  // Existence, not ownership: a student walking a shared pathway has their own
  // anonymous id and never owns the session they were sent. Checking ownership
  // here rejected every interaction a share link produced. Events remain
  // attributed to `studentId`, so the rollup still separates the students.
  if (!(await adapter.sessionExists(sessionId))) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    await adapter.recordInteractions(
      events.map((event) => ({
        sessionId,
        studentId,
        widgetKind: event.widgetKind,
        eventType: event.eventType,
        standardCode: event.standardCode,
        learningComponentId: event.learningComponentId,
        elapsedMs: event.elapsedMs,
        correct: event.correct,
        payload: truncate(event.payload),
      })),
    );
  } catch (error) {
    console.error('[telemetry] insert failed', error);
    return Response.json({ error: 'Write failed' }, { status: 500 });
  }

  if (events.some((event) => event.eventType === 'widget_completed')) {
    await recomputeProfile(studentId);
  }

  return Response.json({ accepted: events.length }, { status: 202 });
}

function truncate(payload: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(payload);
  return serialized.length <= MAX_PAYLOAD_BYTES
    ? payload
    : { truncated: true, bytes: serialized.length };
}
