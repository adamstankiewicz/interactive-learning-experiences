import { storageAdapter } from '@/lib/storage';

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { studentId } = await req.json().catch(() => ({}));
  if (!studentId) return new Response('studentId required', { status: 400 });

  const exists = await storageAdapter().sessionExists(sessionId);
  if (!exists) return new Response('not found', { status: 404 });

  await storageAdapter().recordSessionOpen(sessionId, studentId);
  return new Response(null, { status: 204 });
}
