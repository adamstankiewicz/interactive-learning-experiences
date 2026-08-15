import { streamPathway } from '@/lib/pathway/generate';
import type { Anchor } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { RosterStudent } from '@/lib/roster/types';
import { storageAdapter } from '@/lib/storage';

export const maxDuration = 300;

/**
 * POST /api/assign
 *
 * Body: { topic: string; gradeHint?: string; rosterStudentIds: string[] }
 *
 * Generates a personalized pathway for each roster student (in parallel) and
 * creates an assignment row linking each student to their session.
 *
 * Returns NDJSON — one JSON line per event:
 *   { type: 'started', studentId, name }
 *   { type: 'done', studentId, name, sessionId, assignmentId }
 *   { type: 'error', studentId, name, message }
 *   { type: 'complete' }   — all students processed
 */
export async function POST(request: Request) {
  let body: { topic?: unknown; gradeHint?: unknown; parentSessionId?: unknown; rosterStudentIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected JSON body.' }, { status: 400 });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) return Response.json({ error: 'topic is required.' }, { status: 400 });

  const gradeHint = typeof body.gradeHint === 'string' && body.gradeHint.trim() ? body.gradeHint.trim() : undefined;
  const parentSessionId = typeof body.parentSessionId === 'string' ? body.parentSessionId : null;

  const ids = Array.isArray(body.rosterStudentIds) ? (body.rosterStudentIds as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  if (ids.length === 0) return Response.json({ error: 'rosterStudentIds must be a non-empty array.' }, { status: 400 });

  const storage = storageAdapter();
  const students = await Promise.all(ids.map((id) => storage.getRosterStudent(id)));
  const valid = students.filter((s): s is RosterStudent => s !== null);

  if (valid.length === 0) return Response.json({ error: 'No matching roster students found.' }, { status: 404 });

  const encoder = new TextEncoder();
  const emit = (controller: ReadableStreamDefaultController, obj: unknown) =>
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await Promise.all(
        valid.map(async (student) => {
          emit(controller, { type: 'started', studentId: student.id, name: student.name });
          try {
            // Build a teacher note from the student's profile so the planner
            // personalizes without needing a full StudentProfile mastery object.
            const teacherNote = buildPersonalizationNote(student);

            // Mint an anonymous student row so the session has a valid FK.
            const anonymousId = await storage.createStudent();
            if (!anonymousId) throw new Error('Could not create student row.');

            // Run the full pathway pipeline with the personalization note.
            let anchor: Anchor | null = null;
            let plan: PathwayPlan | null = null;
            const stepWidgets: Record<number, unknown> = {};
            const rejected: string[] = [];

            for await (const event of streamPathway(topic, gradeHint ?? student.grade, null, teacherNote)) {
              if (event.type === 'anchor') anchor = event.anchor;
              if (event.type === 'plan') plan = event.plan;
              if (event.type === 'step-widget') stepWidgets[event.stepIndex] = event.widget;
              if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);
            }

            if (!anchor || !plan) throw new Error('Pathway generation did not complete.');

            const sessionId = await storage.persistSession({
              studentId: anonymousId,
              topic,
              gradeHint: gradeHint ?? student.grade ?? null,
              anchor,
              plan,
              stepWidgets,
              rejectedCodes: rejected,
            });

            if (!sessionId) throw new Error('Could not persist session.');

            const assignment = await storage.createAssignment({
              rosterStudentId: student.id,
              sessionId,
              parentSessionId,
              topic,
            });

            emit(controller, { type: 'done', studentId: student.id, name: student.name, sessionId, assignmentId: assignment.id });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            emit(controller, { type: 'error', studentId: student.id, name: student.name, message });
          }
        }),
      );

      emit(controller, { type: 'complete' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

function buildPersonalizationNote(student: RosterStudent): string {
  const lines: string[] = [
    `This pathway is for ${student.name}, a grade ${student.grade} student.`,
    `Learning style: ${student.learningStyle.primary} (secondary: ${student.learningStyle.secondary}).`,
    `Attention span: approximately ${student.attentionSpanMinutes} minutes. Pacing preference: ${student.pacingPreference}.`,
    `Social preference: ${student.socialPreference}.`,
  ];

  if (student.preferredActivityTypes.length) {
    lines.push(`Preferred activity types: ${student.preferredActivityTypes.join(', ')}.`);
  }
  if (student.avoidActivityTypes.length) {
    lines.push(`Avoid these activity types: ${student.avoidActivityTypes.join(', ')}.`);
  }
  if (student.motivators.length) {
    lines.push(`Motivators / interests: ${student.motivators.join(', ')} — weave these into examples where natural.`);
  }
  if (student.adaptations) {
    lines.push(`Adaptations needed: ${student.adaptations}`);
  }
  if (student.feedbackStyle) {
    lines.push(`Feedback style: ${student.feedbackStyle}.`);
  }
  if (student.readingLevelGrade) {
    lines.push(`Reading level: grade ${student.readingLevelGrade} — calibrate written content accordingly.`);
  }

  return lines.join(' ');
}
