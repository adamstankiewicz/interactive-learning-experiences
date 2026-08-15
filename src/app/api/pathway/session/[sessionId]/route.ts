import { pathwayPlan } from '@/lib/pathway/schema';
import { storageAdapter } from '@/lib/storage';

/**
 * A teacher hand-edited a prose field (bigIdea, a step's title/description,
 * an outcome, a misconception) after generation finished. The client holds
 * the authoritative edited plan already — this just overwrites the
 * persisted row so the share link a teacher hands out reflects the edit,
 * not the pipeline's first draft. Widget specs never travel through here:
 * only `plan` is schema-validated and written.
 *
 * The caller must present the owning `studentId`. `sessionId` alone is not a
 * credential — it is printed in every share link — so without this check any
 * student handed a link could rewrite what every later student reads.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let body: { plan?: unknown; studentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Expected a JSON body.' }, { status: 400 });
  }

  if (typeof body.studentId !== 'string' || body.studentId.length === 0) {
    return Response.json({ message: 'Expected a studentId.' }, { status: 400 });
  }

  const result = pathwayPlan.safeParse(body.plan);
  if (!result.success) return Response.json({ message: 'Invalid pathway plan.' }, { status: 400 });

  let updated: boolean;
  try {
    updated = await storageAdapter().updateSessionPlan(sessionId, body.studentId, result.data);
  } catch (error) {
    console.error('[pathway] could not update session plan', error);
    return Response.json({ message: 'Could not save this edit.' }, { status: 502 });
  }

  // One response for "no such session" and "not yours", so this cannot be
  // used to probe which session ids exist.
  if (!updated) {
    return Response.json({ message: 'No pathway of yours to edit here.' }, { status: 403 });
  }

  return Response.json({ ok: true });
}
