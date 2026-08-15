import { randomUUID } from 'node:crypto';

import { EventType, type CustomEvent, type RunFinishedEvent, type RunStartedEvent } from '@ag-ui/core';

import { generateStructured } from '@/lib/structured';
import { composePrompt, composedWidget, validateComposedWidget } from '@/lib/ag-ui-prototype/compose-schema';

export const maxDuration = 60;

/**
 * A second, separate Phase 3a prototype from the draft-meter one — that
 * prototype proved AG-UI carries a *continuous* loop over one fixed widget;
 * this one proves the model can *compose a novel widget structure* from a
 * primitive catalog (never one of today's six named kinds), same trust
 * boundary as everywhere else in this app: the model picks from a
 * developer-registered set by name, it never authors executable logic or
 * rendering code. Isolated from the production pipeline the same way.
 */
function encodeEvent(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  let body: { topic?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(encodeEvent({ type: EventType.RUN_ERROR, message: 'Expected a JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return new Response(encodeEvent({ type: EventType.RUN_ERROR, message: 'A topic is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const threadId = 'compose-prototype';
  const runId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(encoder.encode(encodeEvent(event)));

      const runStarted: RunStartedEvent = { type: EventType.RUN_STARTED, threadId, runId };
      emit(runStarted);

      try {
        const { system, prompt } = composePrompt(topic);
        const widget = await generateStructured({ schema: composedWidget, system, prompt });

        const problem = validateComposedWidget(widget);
        if (problem) throw new Error(`Composed widget failed validation: ${problem}`);

        // Carried as a CUSTOM event, not STATE_DELTA: a freshly-composed
        // widget's *structure* is a new artifact, not a patch against
        // something the client already had — draft-meter's prototype
        // patches scalar state because there's a stable shape underneath to
        // patch; a novel element tree has no "before" to diff against.
        const composed: CustomEvent = { type: EventType.CUSTOM, name: 'widget-composed', value: widget };
        emit(composed);

        const runFinished: RunFinishedEvent = { type: EventType.RUN_FINISHED, threadId, runId };
        emit(runFinished);
      } catch (error) {
        console.error('[ag-ui/compose] composition failed', error);
        const message = error instanceof Error ? error.message : 'Composition failed.';
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
