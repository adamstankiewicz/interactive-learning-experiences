import { pathwayPlan } from '@/lib/pathway/schema';
import { storageAdapter } from '@/lib/storage';

/**
 * A teacher hand-edited a prose field (bigIdea, a step's title/description,
 * an outcome, a misconception) after generation finished. The client holds
 * the authoritative edited plan already — this just overwrites the
 * persisted row so the share link a teacher hands out reflects the edit,
 * not the pipeline's first draft. Widget specs never travel through here:
 * only `plan` is schema-validated and written.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let body: { plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Expected a JSON body.' }, { status: 400 });
  }

  const result = pathwayPlan.safeParse(body.plan);
  if (!result.success) return Response.json({ message: 'Invalid pathway plan.' }, { status: 400 });

  try {
    await storageAdapter().updateSessionPlan(sessionId, result.data);
  } catch (error) {
    console.error('[pathway] could not update session plan', error);
    return Response.json({ message: 'Could not save this edit.' }, { status: 502 });
  }

  return Response.json({ ok: true });
}
