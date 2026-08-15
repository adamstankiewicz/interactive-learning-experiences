import { rosterStudentInput } from '@/lib/roster/types';
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

  // A full-record replace, so it is validated as one. Previously the body was
  // cast and written straight through, and a partial body silently erased
  // every field it left out.
  const parsed = rosterStudentInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid student data.' }, { status: 400 });
  }

  try {
    const updated = await storageAdapter().updateRosterStudent(studentId, parsed.data);
    if (!updated) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json(updated);
  } catch (error) {
    console.error('[roster] could not update student', error);
    return Response.json({ error: 'Could not save this student.' }, { status: 502 });
  }
}
