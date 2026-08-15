import { storageAdapter } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const rows = await storageAdapter().sessionReport(sessionId);
  return Response.json(rows);
}
