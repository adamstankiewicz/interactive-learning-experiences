import { rosterStudentInput } from '@/lib/roster/types';
import { storageAdapter } from '@/lib/storage';

export async function GET() {
  const students = await storageAdapter().listRosterStudents();
  return Response.json(students);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected JSON body.' }, { status: 400 });
  }

  const parsed = rosterStudentInput.safeParse(body);
  if (!parsed.success) {
    // Issues are deliberately not echoed: they quote the offending input, and
    // the input here is student PII.
    return Response.json({ error: 'Invalid student data.' }, { status: 400 });
  }

  try {
    const student = await storageAdapter().createRosterStudent(parsed.data);
    return Response.json(student, { status: 201 });
  } catch (error) {
    console.error('[roster] could not create student', error);
    return Response.json({ error: 'Could not save this student.' }, { status: 502 });
  }
}
