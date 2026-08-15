import { NextResponse } from 'next/server';

import { reviewDefense } from '@/lib/defend-claim/review';
import { feedbackRequest } from '@/lib/defend-claim/schema';

/**
 * Feedback on one defense, on request.
 *
 * Unlike `/api/score`, this never fires on a debounce — it runs once per time a
 * student decides they are ready, so it is a handful of calls per lesson rather
 * than one per pause in typing. That budget is what pays for replaying earlier
 * rounds into the prompt.
 */
export const maxDuration = 30;

/** Enough to write a paragraph and then some; short of a denial-of-wallet. */
const MAX_DEFENSE_CHARS = 4_000;

/**
 * How many earlier rounds ride along. Two is what it takes for the model to see
 * a trajectory ("they added the quote, then sharpened the reason") rather than
 * a single before-and-after, and the prompt grows by a whole draft per round,
 * so the cap is here rather than left to the client — the client's `history` is
 * untrusted input like everything else in the body.
 */
const MAX_HISTORY = 2;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = feedbackRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed feedback request.' }, { status: 400 });
  }

  const defense = parsed.data.defense.trim();

  // An empty box is the idle state, not a defense. The widget never sends one;
  // this is the backstop that keeps a stray request from burning a model call.
  if (!defense) {
    return NextResponse.json({ error: 'Nothing to read yet.' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await reviewDefense({
        ...parsed.data,
        defense: defense.slice(0, MAX_DEFENSE_CHARS),
        history: parsed.data.history.slice(-MAX_HISTORY),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read your defense.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
