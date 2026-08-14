import { encodeEvent } from '@/lib/pathway/events';
import { streamPathway } from '@/lib/pathway/generate';

export const maxDuration = 120;

function errorStream(message: string, status: number) {
  return new Response(encodeEvent({ type: 'error', message }), {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

export async function POST(request: Request) {
  let body: { topic?: unknown; gradeHint?: unknown };

  try {
    body = await request.json();
  } catch {
    return errorStream('Expected a JSON body.', 400);
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) return errorStream('A topic is required.', 400);

  const gradeHint =
    typeof body.gradeHint === 'string' && body.gradeHint.trim() ? body.gradeHint.trim() : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamPathway(topic, gradeHint)) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      } catch (error) {
        // A mid-stream failure has already sent a 200, so the error has to
        // travel as an event rather than a status code.
        const message = error instanceof Error ? error.message : 'Pathway generation failed.';
        controller.enqueue(encoder.encode(encodeEvent({ type: 'error', message })));
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
