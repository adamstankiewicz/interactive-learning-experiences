import { storageAdapter } from '@/lib/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const sessions = await storageAdapter().listSessions(limit);
  return Response.json(sessions);
}
