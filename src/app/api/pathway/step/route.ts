import type { Anchor } from '@/lib/pathway/events';
import { generateStepWidget } from '@/lib/pathway/generate';
import { pathwayPlan } from '@/lib/pathway/schema';

export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

/**
 * Steering, not start-over: redo one step's interaction without regenerating
 * the whole pathway. Reuses the same per-widget `generate()` boundary the
 * initial pipeline calls — a teacher unhappy with one step's activity gets a
 * fresh one for that step only, everything else untouched.
 *
 * The client sends back the `anchor`/`plan` it already received from
 * `/api/pathway` moments ago — the same round-trip trust the rest of this
 * app extends to a browser it has no auth model for yet. `plan` is
 * schema-validated on the way back in; `anchor` isn't (no zod schema exists
 * for it yet, see `standards/types.ts`), consistent with how the client
 * itself never re-validates it either.
 */
export async function POST(request: Request) {
  let body: { anchor?: unknown; plan?: unknown; stepIndex?: unknown };

  try {
    body = await request.json();
  } catch {
    return jsonError('Expected a JSON body.', 400);
  }

  const planResult = pathwayPlan.safeParse(body.plan);
  if (!planResult.success) return jsonError('Invalid pathway plan.', 400);
  const plan = planResult.data;

  const stepIndex = typeof body.stepIndex === 'number' ? body.stepIndex : NaN;
  const step = plan.steps[stepIndex];
  if (!step) return jsonError('That step does not exist in this plan.', 400);

  if (!body.anchor || typeof body.anchor !== 'object' || !('standard' in body.anchor)) {
    return jsonError('Invalid anchor.', 400);
  }
  const anchor = body.anchor as Anchor;

  try {
    const { widget, note } = await generateStepWidget(anchor, plan, step);
    return Response.json({ widget, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not regenerate this step.';
    return jsonError(message, 502);
  }
}
