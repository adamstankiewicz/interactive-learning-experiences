import { encodeEvent, type Anchor, type PathwayEvent } from '@/lib/pathway/events';
import { streamPathway } from '@/lib/pathway/generate';
import type { PathwayPlan } from '@/lib/pathway/schema';
import { storageAdapter } from '@/lib/storage';
import { loadProfile } from '@/lib/student/profile';

export const maxDuration = 120;

function errorStream(message: string, status: number) {
  return new Response(encodeEvent({ type: 'error', message }), {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

export async function POST(request: Request) {
  let body: { topic?: unknown; gradeHint?: unknown; studentId?: unknown; teacherNote?: unknown };

  try {
    body = await request.json();
  } catch {
    return errorStream('Expected a JSON body.', 400);
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) return errorStream('A topic is required.', 400);

  const gradeHint =
    typeof body.gradeHint === 'string' && body.gradeHint.trim() ? body.gradeHint.trim() : undefined;
  const studentId = typeof body.studentId === 'string' && body.studentId ? body.studentId : null;
  const teacherNote =
    typeof body.teacherNote === 'string' && body.teacherNote.trim() ? body.teacherNote.trim() : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Parameters<typeof encodeEvent>[0]) =>
        controller.enqueue(encoder.encode(encodeEvent(event)));

      try {
        // Prior evidence steers the plan. With no student this is the original
        // stateless behaviour.
        const profile = studentId ? await loadProfile(studentId) : null;

        // The pathway is assembled from the events as they pass through, so
        // persistence needs no second run of the pipeline.
        let anchor: Anchor | null = null;
        let plan: PathwayPlan | null = null;
        const stepWidgets: Record<number, unknown> = {};
        const rejected: string[] = [];

        for await (const event of streamPathway(topic, gradeHint, profile, teacherNote)) {
          if (event.type === 'anchor') anchor = event.anchor;
          if (event.type === 'plan') plan = event.plan;
          if (event.type === 'step-widget') stepWidgets[event.stepIndex] = event.widget;
          if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);

          // The session id has to reach the client before `done`, so telemetry
          // has something to attach to. Emitted unconditionally, even when
          // there is nothing to save — the client needs to know a share link
          // is impossible and why, not just never receive one.
          if (event.type === 'done') {
            emit(
              anchor && plan
                ? await persistSession(studentId, topic, gradeHint, {
                    anchor,
                    plan,
                    stepWidgets,
                    rejected,
                  })
                : { type: 'session', sessionId: null, reason: 'This run did not produce a pathway to save.' },
            );
          }

          emit(event);
        }
      } catch (error) {
        // A mid-stream failure has already sent a 200, so the error has to
        // travel as an event rather than a status code.
        const message = error instanceof Error ? error.message : 'Pathway generation failed.';
        emit({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      // Without this a proxy may buffer the whole response and defeat the point.
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Best-effort: a storage failure must not lose a pathway the teacher is already
 * looking at. But it must not be *invisible* either — an unshareable pathway
 * that says nothing about why looks exactly like a build that simply has no
 * share feature, which is how a broken write path can sit unnoticed. So the
 * failure is swallowed as far as the stream is concerned and reported as far
 * as the teacher is concerned.
 */
async function persistSession(
  studentId: string | null,
  topic: string,
  gradeHint: string | undefined,
  result: { anchor: Anchor; plan: PathwayPlan; stepWidgets: Record<number, unknown>; rejected: string[] },
): Promise<Extract<PathwayEvent, { type: 'session' }>> {
  if (!studentId) {
    return { type: 'session', sessionId: null, reason: 'This browser has no learner id, so the pathway was not saved.' };
  }

  try {
    const sessionId = await storageAdapter().persistSession({
      studentId,
      topic,
      gradeHint: gradeHint ?? null,
      anchor: result.anchor,
      plan: result.plan,
      stepWidgets: result.stepWidgets,
      rejectedCodes: result.rejected,
    });

    // An adapter returning null rather than throwing means it declined to
    // write (unconfigured, or it logged its own error) — still not shareable.
    return sessionId
      ? { type: 'session', sessionId }
      : { type: 'session', sessionId: null, reason: 'Storage is not accepting writes, so the pathway was not saved.' };
  } catch (error) {
    console.error('[pathway] could not persist session', error);
    const detail = error instanceof Error ? error.message : 'Unknown storage error.';
    return { type: 'session', sessionId: null, reason: `The pathway could not be saved: ${detail}` };
  }
}
