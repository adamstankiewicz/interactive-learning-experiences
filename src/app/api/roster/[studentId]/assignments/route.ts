import { storageAdapter } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const assignments = await storageAdapter().listAssignmentsForStudent(studentId);
  return Response.json(assignments);
}
