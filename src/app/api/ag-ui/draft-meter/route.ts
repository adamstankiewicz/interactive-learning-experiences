import { randomUUID } from 'node:crypto';

import { EventType, type RunFinishedEvent, type RunStartedEvent, type StateDeltaEvent } from '@ag-ui/core';

import { scoreDraft } from '@/lib/draft-meter/score';
import { scoreRequest } from '@/lib/draft-meter/schema';

export const maxDuration = 30;

/**
 * Phase 3a's prototype target, isolated from the production pipeline (a new
 * route, a new demo page, nothing in `/api/pathway` or `DraftMeter.tsx`
 * touched) per the plan's own recommendation: draft-meter's continuous
 * re-score-while-typing loop is the one built-in widget with no single
 * terminal "done" turn, so it's the case that proves — or breaks — mapping
 * AG-UI's turn-based event vocabulary onto this app's shape before the other
 * five widgets are migrated.
 *
 * Every debounced pause in typing is its own short AG-UI run
 * (RUN_STARTED -> STATE_DELTA -> RUN_FINISHED) against state that persists
 * across runs on the client — proving a continuous loop can ride a
 * turn-based protocol without inventing a fake "done" moment for a widget
 * that doesn't have one.
 */
function encodeEvent(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(encodeEvent({ type: EventType.RUN_ERROR, message: 'Expected a JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const parsed = scoreRequest.safeParse(body);
  if (!parsed.success || !parsed.data.response.trim()) {
    return new Response(
      encodeEvent({ type: EventType.RUN_ERROR, message: 'Malformed or empty scoring request.' }),
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } },
    );
  }

  const threadId = 'draft-meter-prototype';
  const runId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(encoder.encode(encodeEvent(event)));

      const runStarted: RunStartedEvent = { type: EventType.RUN_STARTED, threadId, runId };
      emit(runStarted);

      try {
        const result = await scoreDraft(parsed.data);

        // The whole point of this prototype: the model's judgement arrives as
        // an RFC 6902 patch against state the client already holds, not a
        // full response replacing what came before — the same shape a
        // draft-meter-style widget would receive on every one of its many
        // re-scores per session, not just a single terminal turn.
        const delta: StateDeltaEvent = {
          type: EventType.STATE_DELTA,
          delta: [
            { op: 'replace', path: '/score', value: result.score },
            { op: 'replace', path: '/band', value: result.band },
            { op: 'replace', path: '/label', value: result.label },
            { op: 'replace', path: '/criteriaMet', value: result.criteriaMet },
            { op: 'replace', path: '/nudge', value: result.nudge },
          ],
        };
        emit(delta);

        const runFinished: RunFinishedEvent = { type: EventType.RUN_FINISHED, threadId, runId };
        emit(runFinished);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Scoring failed.';
        emit({ type: EventType.RUN_ERROR, threadId, runId, message });
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
