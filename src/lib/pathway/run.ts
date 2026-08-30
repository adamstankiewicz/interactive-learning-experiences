import type { Anchor } from '@/lib/pathway/events';
import { streamPathway } from '@/lib/pathway/generate';
import type { PathwayPlan } from '@/lib/pathway/schema';

export type PathwayRun = {
  anchor: Anchor;
  plan: PathwayPlan;
  stepWidgets: Record<number, unknown>;
  rejected: string[];
};

/**
 * The pipeline as a single promise instead of a stream.
 *
 * `streamPathway` is the real thing; the app consumes it event by event so
 * the in-progress state can be the design. A protocol caller (the MCP
 * `build_pathway` tool) has nowhere to put intermediate events — a tool call
 * returns once — so this collects the same stream into the same shape the
 * NDJSON route accumulates, and throws where the route would have emitted an
 * error event.
 */
export async function runPathway(topic: string, gradeHint?: string): Promise<PathwayRun> {
  let anchor: Anchor | null = null;
  let plan: PathwayPlan | null = null;
  const stepWidgets: Record<number, unknown> = {};
  const rejected: string[] = [];

  for await (const event of streamPathway(topic, gradeHint, null)) {
    if (event.type === 'anchor') anchor = event.anchor;
    if (event.type === 'plan') plan = event.plan;
    if (event.type === 'step-widget') stepWidgets[event.stepIndex] = event.widget;
    if (event.type === 'verdict' && !event.resolved) rejected.push(event.code);
    if (event.type === 'error') throw new Error(event.message);
  }

  if (!anchor || !plan) {
    throw new Error('The run did not produce a pathway — no anchor or plan came back.');
  }

  return { anchor, plan, stepWidgets, rejected };
}
