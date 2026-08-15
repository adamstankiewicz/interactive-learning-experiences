import { NextResponse } from 'next/server';

import { respondInDebate } from '@/lib/debate/respond';
import { debateRequest } from '@/lib/debate/schema';

/**
 * One exchange in a debate.
 *
 * Like `/api/defend-claim` and unlike `/api/score`, this never fires on a
 * debounce — it runs once per message a student decides to send, so it is a
 * handful of calls per activity rather than one per pause in typing.
 */
export const maxDuration = 30;

/** A debate turn is a paragraph at most; anything longer is not a turn. */
const MAX_MESSAGE_CHARS = 2_000;

/**
 * How much of the exchange rides along. Six messages is three rounds, which is
 * what it takes for the opponent to avoid repeating an argument it already
 * made — and the prompt grows by a whole message per entry, so the cap lives
 * here rather than with the client: `transcript` is untrusted input like
 * everything else in the body.
 */
const MAX_TRANSCRIPT = 6;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = debateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed debate request.' }, { status: 400 });
  }

  const message = parsed.data.message.trim();

  // An empty box is not a turn. The widget never sends one; this is the
  // backstop that keeps a stray request from burning a model call.
  if (!message) {
    return NextResponse.json({ error: 'Nothing to reply to yet.' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await respondInDebate({
        ...parsed.data,
        message: message.slice(0, MAX_MESSAGE_CHARS),
        transcript: parsed.data.transcript.slice(-MAX_TRANSCRIPT),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not continue the debate.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
