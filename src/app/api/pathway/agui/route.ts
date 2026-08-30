import { randomUUID } from 'node:crypto';

import {
  EventType,
  type CustomEvent,
  type RunErrorEvent,
  type RunFinishedEvent,
  type RunStartedEvent,
  type StateSnapshotEvent,
} from '@ag-ui/core';

import { A2LEARN_EVENT_PREFIX } from '@/lib/a2learn/manifest';
import type { Anchor } from '@/lib/pathway/events';
import { streamPathway } from '@/lib/pathway/generate';
import type { PathwayPlan } from '@/lib/pathway/schema';

export const maxDuration = 120;

/**
 * The pathway build as an AG-UI run — the standards-conformant transport
 * beside the app's own NDJSON at `/api/pathway`.
 *
 * Same pipeline, different envelope:
 *
 * - the run brackets as `RUN_STARTED` / `RUN_FINISHED` (or `RUN_ERROR`);
 * - every event the pipeline yields crosses as a `CUSTOM` event named
 *   `a2learn.<type>` with the untouched event as its value — domain
 *   semantics belong to the a2learn layer, not to the transport;
 * - one `STATE_SNAPSHOT` lands before the finish with the assembled
 *   result, for clients that want the artifact without replaying events.
 *
 * Two honest scope limits, phase-2 work rather than accidents: this
 * transport takes topic + gradeHint only (no student profile, teacher note,
 * or lesson-plan context yet), and it does not persist a session — no share
 * link comes back. Both converge on the shared `runPathway` collector when
 * the build_pathway branch lands, so the two transports stop diverging.
 *
 * Event shapes are compile-checked against `@ag-ui/core`, so drifting from
 * the protocol fails the build rather than a partner's integration.
 */

function encode(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Even a rejected request speaks legal AG-UI: standard client middleware
 * asserts the first event is RUN_STARTED, so a bare RUN_ERROR would surface
 * as a protocol violation in the partner's SDK instead of a message.
 */
function refusalStream(message: string): string {
  const runId = randomUUID();
  const started: RunStartedEvent = { type: EventType.RUN_STARTED, threadId: 'a2learn-pathway', runId };
  const error: RunErrorEvent = { type: EventType.RUN_ERROR, message };
  return encode(started) + encode(error);
}

export async function POST(request: Request) {
  let body: { topic?: unknown; gradeHint?: unknown; threadId?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(refusalStream('Expected a JSON body.'), {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return new Response(refusalStream('A topic is required.'), {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const gradeHint = typeof body.gradeHint === 'string' && body.gradeHint.trim() ? body.gradeHint.trim() : undefined;
  const threadId = typeof body.threadId === 'string' && body.threadId ? body.threadId : 'a2learn-pathway';
  const runId = randomUUID();
  const encoder = new TextEncoder();

  // A cancelled consumer (closed tab, aborted fetch) must produce a quiet
  // teardown, not enqueue-after-close throws cascading through catch and
  // finally. Generation itself still runs to completion — threading an
  // AbortSignal through streamPathway is a repo-wide gap shared with the
  // NDJSON route, tracked separately.
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encode(event)));
      };

      const started: RunStartedEvent = { type: EventType.RUN_STARTED, threadId, runId };
      emit(started);

      try {
        let anchor: Anchor | null = null;
        let plan: PathwayPlan | null = null;
        const stepWidgets: Record<number, unknown> = {};
        const rejected: string[] = [];

        // No in-band error branch: the generator throws on failure (it never
        // yields an error event), and the catch below turns that into
        // RUN_ERROR. If it ever gains recoverable in-band errors, they cross
        // like any other event.
        for await (const event of streamPathway(topic, gradeHint, null)) {
          if (event.type === 'anchor') anchor = event.anchor;
          if (event.type === 'plan') plan = event.plan;
          if (event.type === 'step-widget') stepWidgets[event.stepIndex] = event.widget;
          if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);

          const custom: CustomEvent = {
            type: EventType.CUSTOM,
            name: `${A2LEARN_EVENT_PREFIX}${event.type}`,
            value: event,
          };
          emit(custom);
        }

        const snapshot: StateSnapshotEvent = {
          type: EventType.STATE_SNAPSHOT,
          snapshot: { anchor, plan, stepWidgets, rejectedCodes: rejected },
        };
        emit(snapshot);

        const finished: RunFinishedEvent = { type: EventType.RUN_FINISHED, threadId, runId };
        emit(finished);
      } catch (error) {
        const failed: RunErrorEvent = {
          type: EventType.RUN_ERROR,
          message: error instanceof Error ? error.message : 'Pathway generation failed.',
        };
        emit(failed);
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
