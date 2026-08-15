import { NextResponse } from 'next/server';

import { scoreDraft } from '@/lib/draft-meter/score';
import { scoreRequest } from '@/lib/draft-meter/schema';

/**
 * The meter's live scoring call. Unlike `/api/pathway`, this runs on a debounce
 * while a student types, so it is one model call and stays that way.
 */
export const maxDuration = 30;

/**
 * Open CORS, on purpose.
 *
 * When this widget renders inside an MCP host, it runs in a sandboxed iframe
 * with an opaque origin — every call to us is cross-origin, and without these
 * headers the meter simply cannot score. The endpoint is unauthenticated for
 * the same hackathon reasons everything else here is; before this went
 * anywhere real it would want a scoped token minted alongside the widget spec.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const parsed = scoreRequest.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Malformed scoring request.' }, 400);
  }

  // An empty draft is the idle state, not a score. The widget never sends one;
  // this is the backstop that keeps a stray request from burning a model call.
  if (!parsed.data.response.trim()) {
    return json({ error: 'Nothing to score yet.' }, 400);
  }

  try {
    return json(await scoreDraft(parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scoring failed.';
    return json({ error: message }, 500);
  }
}
