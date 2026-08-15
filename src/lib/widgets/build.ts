import type { Anchor } from '@/lib/pathway/events';
import { generateStepWidget } from '@/lib/pathway/generate';
import { widgetKind, type PathwayPlan, type WidgetSpec } from '@/lib/pathway/schema';
import { sourceById, verifyAcrossSources } from '@/lib/standards';
import type { StandardRef } from '@/lib/standards/types';

/**
 * One widget, from a standard code and a kind — without building a pathway.
 *
 * `streamPathway` is the real thing and takes ~30s across five model calls,
 * which is right for authoring a lesson and wrong for a conversation. Here the
 * caller already knows which standard and which interaction it wants, so the
 * only work left is configuring the widget: one model call, a few seconds.
 *
 * Two callers: `/api/widget` and the MCP server at `/api/mcp`, where the model
 * in the chat plays the part stage 1 plays in the pipeline — it proposes the
 * standard code, and the graph still decides whether that code exists.
 */

export const WIDGET_KINDS = widgetKind.options;

export type BuiltWidget = {
  widget: WidgetSpec;
  note: string | null;
  standard: StandardRef;
};

export class WidgetBuildError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * A pathway's worth of context, minus the pathway.
 *
 * Widget generators read outcomes and misconceptions out of the plan to
 * sharpen their prompt. There are none here, and inventing them would cost the
 * model call this exists to avoid — so they are empty and the generator works
 * from the standard alone. Widgets come out a little more generic than the
 * pipeline's; that is the trade for answering in seconds.
 */
function syntheticPlan(anchor: Anchor, kind: (typeof WIDGET_KINDS)[number]): PathwayPlan {
  return {
    gradeBand: anchor.standard.gradeLevels.join('/') || 'middle school',
    bigIdea: anchor.standard.description,
    outcomes: [],
    priorKnowledge: [],
    misconceptions: [],
    steps: [
      {
        title: 'Practice',
        purpose: 'practice',
        description: `A single activity for ${anchor.standard.code}, outside a full pathway.`,
        outcomeIndex: 0,
        widgetKind: kind,
      },
    ],
  };
}

export async function buildWidget(input: {
  standardCode: string;
  kind: string;
  jurisdiction?: string;
}): Promise<BuiltWidget> {
  const standardCode = input.standardCode.trim();
  if (!standardCode) throw new WidgetBuildError('A standardCode is required.', 400);

  const parsedKind = widgetKind.safeParse(input.kind);
  if (!parsedKind.success) {
    throw new WidgetBuildError(`Unknown widget kind. Known kinds: ${WIDGET_KINDS.join(', ')}.`, 400);
  }

  // The graph still decides whether the code exists, exactly as in the pipeline.
  const standard = await verifyAcrossSources(standardCode, input.jurisdiction);
  if (!standard) {
    throw new WidgetBuildError(`"${standardCode}" did not resolve against any standards source.`, 404);
  }

  const source = sourceById(standard.sourceId);
  const [learningComponents, prerequisites] = await Promise.all([
    source.decompose(standard),
    source.progression(standard, 'backward'),
  ]);

  const anchor: Anchor = { standard, learningComponents, prerequisites, companions: [] };
  const plan = syntheticPlan(anchor, parsedKind.data);

  const { widget, note } = await generateStepWidget(anchor, plan, plan.steps[0]);
  if (!widget) throw new WidgetBuildError('The generator produced no widget.', 502);

  return { widget, note, standard };
}
