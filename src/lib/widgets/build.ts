import { z } from 'zod';

import type { Anchor } from '@/lib/pathway/events';
import { generateStepWidget } from '@/lib/pathway/generate';
import { widgetKind, type PathwayPlan, type WidgetSpec } from '@/lib/pathway/schema';
import { sourceById, verifyAcrossSources } from '@/lib/standards';
import { generateStructured } from '@/lib/structured';
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

/**
 * Turn a plain topic into a standard and an interaction.
 *
 * Everything a caller must decide before it can ask for an activity is a
 * reason not to ask. Requiring both a standard code and a widget kind was
 * enough friction that a model with a general-purpose alternative would often
 * reach for that instead — so both are optional, and this fills the gap.
 *
 * Same shape as stage 1 of the pathway pipeline: guesses are cheap because the
 * graph rejects the ones that do not exist.
 */
async function proposeFor(topic: string, gradeHint?: string) {
  const proposal = await generateStructured({
    schema: z.object({
      candidates: z
        .array(z.string())
        .describe('2-4 standard codes, best first, in official notation — "RI.8.8", "MS-PS1-1".'),
      kind: z.enum(WIDGET_KINDS).describe('The interaction that best suits this topic.'),
    }),
    system: [
      'You map a teaching topic to a Common Core or NGSS standard and the interaction that best',
      'teaches it. Propose codes in official notation only. A wrong guess is cheap — every code is',
      'verified against an authoritative graph before use.',
      'Match the interaction to the work: writing tasks for argument standards, find-the-flaw where',
      'a worked example can contain a mistake, draw-the-curve where something changes over time,',
      'crossword for vocabulary consolidation.',
    ].join(' '),
    prompt: gradeHint ? `Topic: ${topic}\nGrade: ${gradeHint}` : `Topic: ${topic}`,
  });

  return proposal;
}

export async function buildWidget(input: {
  standardCode?: string;
  kind?: string;
  topic?: string;
  gradeHint?: string;
  jurisdiction?: string;
}): Promise<BuiltWidget> {
  let standardCode = input.standardCode?.trim() ?? '';
  let kind = input.kind ?? '';
  let fallbackCodes: string[] = [];

  if (!standardCode || !kind) {
    if (!input.topic?.trim() && !standardCode) {
      throw new WidgetBuildError('Give either a standardCode or a topic.', 400);
    }


    const proposal = await proposeFor(input.topic ?? standardCode, input.gradeHint);
    if (!standardCode) {
      [standardCode = '', ...fallbackCodes] = proposal.candidates;
    }
    if (!kind) kind = proposal.kind;
  }

  const parsedKind = widgetKind.safeParse(kind);
  if (!parsedKind.success) {
    throw new WidgetBuildError(`Unknown widget kind. Known kinds: ${WIDGET_KINDS.join(', ')}.`, 400);
  }

  // The graph still decides whether a code exists, exactly as in the pipeline.
  let standard = await verifyAcrossSources(standardCode, input.jurisdiction);
  for (const candidate of fallbackCodes) {
    if (standard) break;
    standard = await verifyAcrossSources(candidate, input.jurisdiction);
  }

  /**
   * Never come back empty-handed.
   *
   * A tool call that returns prose instead of a widget draws nothing, and the
   * student is left with an apology where an activity should be. The pathway
   * pipeline already answers this the honest way — carry on with a synthetic,
   * explicitly-unverified standard rather than failing — and this mirrors it.
   *
   * `tags: []` matters: every tag-gated coverageRule correctly excludes itself,
   * so the widget that gets built is one that does not need a standard to make
   * sense, and the note says plainly that nothing was verified.
   */
  const unverified = !standard;
  standard ??= {
    sourceId: 'none',
    sourceLabel: 'no matching standard',
    code: 'EXPLORATION',
    id: 'unverified',
    description: input.topic?.trim() || standardCode,
    jurisdiction: 'n/a',
    gradeLevels: input.gradeHint ? [input.gradeHint] : [],
    subject: 'General',
    tags: [],
    verified: false,
  };

  // A synthetic standard belongs to no source, so there is nothing to ask for
  // its decomposition — asking anyway throws "unknown standards source id".
  const [learningComponents, prerequisites] = unverified
    ? [[], []]
    : await (async () => {
        const source = sourceById(standard.sourceId);
        return Promise.all([source.decompose(standard), source.progression(standard, 'backward')]);
      })();

  const anchor: Anchor = { standard, learningComponents, prerequisites, companions: [] };
  const plan = syntheticPlan(anchor, parsedKind.data);

  const { widget, note } = await generateStepWidget(anchor, plan, plan.steps[0]);
  if (!widget) throw new WidgetBuildError('The generator produced no widget.', 502);

  const unverifiedNote = unverified
    ? `No standard matched${standardCode ? ` "${standardCode}"` : ''}, so this is an exploration activity rather than a standards-aligned one.`
    : null;

  return {
    widget,
    note: [unverifiedNote, note].filter(Boolean).join(' ') || null,
    standard,
  };
}
