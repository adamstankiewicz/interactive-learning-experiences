import { NextResponse } from 'next/server';

import { reviewDraft } from '@/lib/workshop/review';
import { reviewRequest } from '@/lib/workshop/schema';

/**
 * A read of one long-form draft, on request.
 *
 * The longest single call in the app: a whole piece in, a marked-up copy out.
 * It only ever runs when a student presses the button, which is what pays for
 * sending the entire draft rather than a summary of it — the notes have to
 * attach to real sentences, so the real sentences have to be in the prompt.
 */
export const maxDuration = 60;

/**
 * A generous essay and then some. `targetWords` tops out around 600, so this is
 * roughly four times the longest piece the widget asks for — enough that no
 * honest draft is truncated, short of a denial-of-wallet.
 */
const MAX_DRAFT_CHARS = 12_000;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = reviewRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed review request.' }, { status: 400 });
  }

  const draft = parsed.data.draft.trim();

  // An empty editor is the idle state, not a draft. The widget never sends one;
  // this is the backstop that keeps a stray request from burning a model call.
  if (!draft) {
    return NextResponse.json({ error: 'Nothing to read yet.' }, { status: 400 });
  }

  try {
    /**
     * Truncation is the one place this could quietly mislead. If a draft were
     * cut, notes would be placed against text the student cannot see and the
     * back half would go unmarked with no explanation — so the cut is reported
     * rather than performed silently.
     */
    const truncated = draft.length > MAX_DRAFT_CHARS;

    const result = await reviewDraft({ ...parsed.data, draft: draft.slice(0, MAX_DRAFT_CHARS) });

    return NextResponse.json({
      ...result,
      overall: truncated
        ? `${result.overall} (Only the first ${MAX_DRAFT_CHARS.toLocaleString()} characters were read.)`
        : result.overall,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read your draft.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
