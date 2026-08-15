import { NextResponse } from 'next/server';

import { scoreDraft } from '@/lib/draft-meter/score';
import { scoreRequest } from '@/lib/draft-meter/schema';

/**
 * The meter's live scoring call. Unlike `/api/pathway`, this runs on a debounce
 * while a student types, so it is one model call and stays that way.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = scoreRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed scoring request.' }, { status: 400 });
  }

  // An empty draft is the idle state, not a score. The widget never sends one;
  // this is the backstop that keeps a stray request from burning a model call.
  if (!parsed.data.response.trim()) {
    return NextResponse.json({ error: 'Nothing to score yet.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await scoreDraft(parsed.data));
  } catch (error) {
    // The provider's message can name models, regions and quota state, so it is
    // logged rather than returned. The widget only branches on the status.
    console.error('[score] scoring failed', error);
    return NextResponse.json({ error: 'Scoring failed.' }, { status: 500 });
  }
}
