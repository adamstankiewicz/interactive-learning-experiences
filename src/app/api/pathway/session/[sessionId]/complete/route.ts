import { storageAdapter } from '@/lib/storage';

/**
 * The student's half of closing the loop: fired once a walkthrough reaches
 * its "All done!" screen for a persisted session. Best-effort, like
 * `persistSession` itself — a storage hiccup here shouldn't interrupt a
 * student who already finished.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  try {
    await storageAdapter().recordSessionCompletion(sessionId);
  } catch (error) {
    console.error('[pathway] could not record session completion', error);
  }

  return Response.json({ ok: true });
}
