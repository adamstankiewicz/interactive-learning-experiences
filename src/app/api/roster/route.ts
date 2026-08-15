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

  if (!isStudentInput(body)) {
    return Response.json({ error: 'Invalid student data.' }, { status: 400 });
  }

  const student = await storageAdapter().createRosterStudent(body);
  return Response.json(student, { status: 201 });
}

function isStudentInput(v: unknown): v is Parameters<ReturnType<typeof storageAdapter>['createRosterStudent']>[0] {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.grade === 'string' &&
    typeof o.learningStyle === 'object' &&
    typeof o.adaptations === 'string'
  );
}
