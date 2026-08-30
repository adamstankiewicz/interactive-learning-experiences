import type { Anchor } from '@/lib/pathway/events';
import { streamPathway } from '@/lib/pathway/generate';
import type { PathwayPlan } from '@/lib/pathway/schema';

export type PathwayRun = {
  anchor: Anchor;
  plan: PathwayPlan;
  stepWidgets: Record<number, unknown>;
  /** Per-step degradation notes — e.g. "draft-meter didn't fit, built a fallback". */
  stepWidgetNotes: Record<number, string>;
  rejected: string[];
};

/**
 * The pipeline as a single promise instead of a stream.
 *
 * `streamPathway` is the real thing; the app consumes it event by event so
 * the in-progress state can be the design. A protocol caller (the MCP
 * `build_pathway` tool) has nowhere to put intermediate events — a tool call
 * returns once — so this collects the same stream into the same shape the
 * NDJSON route accumulates. Generator failures throw and propagate out of
 * the `for await` — there is no in-band error event to handle.
 *
 * The pass-through options mirror `streamPathway`'s remaining parameters so
 * other collect-the-stream callers (the assign route carries a third copy of
 * this loop) can converge on this helper instead of forking it.
 */
export async function runPathway(
  topic: string,
  gradeHint?: string,
  extras?: { teacherNote?: string; lessonPlanExcerpt?: string },
): Promise<PathwayRun> {
  let anchor: Anchor | null = null;
  let plan: PathwayPlan | null = null;
  const stepWidgets: Record<number, unknown> = {};
  const stepWidgetNotes: Record<number, string> = {};
  const rejected: string[] = [];

  for await (const event of streamPathway(
    topic,
    gradeHint,
    null,
    extras?.teacherNote,
    extras?.lessonPlanExcerpt,
  )) {
    if (event.type === 'anchor') anchor = event.anchor;
    if (event.type === 'plan') plan = event.plan;
    if (event.type === 'step-widget') {
      stepWidgets[event.stepIndex] = event.widget;
      if (event.note) stepWidgetNotes[event.stepIndex] = event.note;
    }
    if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);
  }

  if (!anchor || !plan) {
    throw new Error('The run did not produce a pathway — no anchor or plan came back.');
  }

  return { anchor, plan, stepWidgets, stepWidgetNotes, rejected };
}
