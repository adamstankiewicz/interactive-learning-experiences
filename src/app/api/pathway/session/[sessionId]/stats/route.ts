import { storageAdapter } from '@/lib/storage';

/** The teacher's half of closing the loop — how many students opened/finished a shared link. */
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const stats = await storageAdapter().sessionStats(sessionId);

  if (!stats) return Response.json({ message: 'No stats for this session.' }, { status: 404 });
  return Response.json(stats);
}
