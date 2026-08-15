import { encodeEvent, type Anchor } from '@/lib/pathway/events';
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
  let body: { topic?: unknown; gradeHint?: unknown; studentId?: unknown };

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

        for await (const event of streamPathway(topic, gradeHint, profile)) {
          if (event.type === 'anchor') anchor = event.anchor;
          if (event.type === 'plan') plan = event.plan;
          if (event.type === 'step-widget') stepWidgets[event.stepIndex] = event.widget;
          if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);

          // The session id has to reach the client before `done`, so telemetry
          // has something to attach to.
          if (event.type === 'done' && studentId && anchor && plan) {
            const sessionId = await persistSession(studentId, topic, gradeHint, {
              anchor,
              plan,
              stepWidgets,
              rejected,
            });
            emit({ type: 'session', sessionId });
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
 * Best-effort: a storage failure must not lose a pathway the student is already
 * looking at. Telemetry simply has nothing to attach itself to.
 */
async function persistSession(
  studentId: string,
  topic: string,
  gradeHint: string | undefined,
  result: { anchor: Anchor; plan: PathwayPlan; stepWidgets: Record<number, unknown>; rejected: string[] },
): Promise<string | null> {
  try {
    return await storageAdapter().persistSession({
      studentId,
      topic,
      gradeHint: gradeHint ?? null,
      anchor: result.anchor,
      plan: result.plan,
      stepWidgets: result.stepWidgets,
      rejectedCodes: result.rejected,
    });
  } catch (error) {
    console.error('[pathway] could not persist session', error);
    return null;
  }
}
