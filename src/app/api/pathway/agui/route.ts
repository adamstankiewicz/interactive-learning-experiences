import { randomUUID } from 'node:crypto';

import {
  EventType,
  type CustomEvent,
  type RunErrorEvent,
  type RunFinishedEvent,
  type RunStartedEvent,
  type StateSnapshotEvent,
} from '@ag-ui/core';

import type { Anchor } from '@/lib/pathway/events';
import { streamPathway } from '@/lib/pathway/generate';
import type { PathwayPlan } from '@/lib/pathway/schema';

export const maxDuration = 120;

/**
 * The pathway build as an AG-UI run — the standards-conformant transport
 * beside the app's own NDJSON at `/api/pathway`.
 *
 * Same pipeline, same events, different envelope: any AG-UI client can
 * drive a build without learning our vocabulary. The mapping is deliberate
 * and total:
 *
 * - the run brackets as `RUN_STARTED` / `RUN_FINISHED` (or `RUN_ERROR`);
 * - every domain event crosses as a `CUSTOM` event named
 *   `a2learn.<type>` with the untouched event as its value — domain
 *   semantics belong to the a2learn layer, not to the transport;
 * - one `STATE_SNAPSHOT` lands before the finish with the assembled
 *   result, for clients that want the artifact without replaying events.
 *
 * Conformance is compile-checked: every emitted object is typed against
 * `@ag-ui/core`'s event interfaces, so drifting from the protocol fails
 * the build rather than a partner's integration.
 */

function encode(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  let body: { topic?: unknown; gradeHint?: unknown; threadId?: unknown };
  try {
    body = await request.json();
  } catch {
    const error: RunErrorEvent = { type: EventType.RUN_ERROR, message: 'Expected a JSON body.' };
    return new Response(encode(error), { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    const error: RunErrorEvent = { type: EventType.RUN_ERROR, message: 'A topic is required.' };
    return new Response(encode(error), { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } });
  }

  const gradeHint = typeof body.gradeHint === 'string' && body.gradeHint.trim() ? body.gradeHint.trim() : undefined;
  const threadId = typeof body.threadId === 'string' && body.threadId ? body.threadId : 'a2learn-pathway';
  const runId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(encoder.encode(encode(event)));

      const started: RunStartedEvent = { type: EventType.RUN_STARTED, threadId, runId };
      emit(started);

      try {
        let anchor: Anchor | null = null;
        let plan: PathwayPlan | null = null;
        const stepWidgets: Record<number, unknown> = {};
        const rejected: string[] = [];

        for await (const event of streamPathway(topic, gradeHint, null)) {
          if (event.type === 'anchor') anchor = event.anchor;
          if (event.type === 'plan') plan = event.plan;
          if (event.type === 'step-widget') stepWidgets[event.stepIndex] = event.widget;
          if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);
          if (event.type === 'error') throw new Error(event.message);

          const custom: CustomEvent = { type: EventType.CUSTOM, name: `a2learn.${event.type}`, value: event };
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
        controller.close();
      }
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
