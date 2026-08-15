import { storageAdapter } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const rows = await storageAdapter().sessionReport(sessionId);
    return Response.json(rows);
  } catch (error) {
    // Detail stays in the server log; the message can carry schema names.
    console.error('[report] sessionReport failed', error);
    return Response.json({ error: 'Could not load the report.' }, { status: 500 });
  }
}
