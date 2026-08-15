import { storageAdapter } from '@/lib/storage';

/**
 * GET /api/pathway/sessions/[sessionId]/children
 * Returns each child assignment enriched with the child session's plan and topic.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const storage = storageAdapter();

  const assignments = await storage.listChildAssignments(sessionId);

  const children = await Promise.all(
    assignments.map(async (a) => {
      const [session, rosterStudent] = await Promise.all([
        storage.loadSession(a.sessionId),
        storage.getRosterStudent(a.rosterStudentId),
      ]);
      return {
        assignmentId: a.id,
        sessionId: a.sessionId,
        rosterStudentId: a.rosterStudentId,
        rosterStudentName: rosterStudent?.name ?? null,
        topic: a.topic,
        createdAt: a.createdAt,
        plan: session?.plan ?? null,
        stepWidgets: session?.stepWidgets ?? {},
      };
    }),
  );

  return Response.json(children);
}
