import { storageAdapter } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const student = await storageAdapter().getRosterStudent(studentId);
  if (!student) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json(student);
}

export async function PUT(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected JSON body.' }, { status: 400 });
  }

  const updated = await storageAdapter().updateRosterStudent(studentId, body as never);
  if (!updated) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json(updated);
}
