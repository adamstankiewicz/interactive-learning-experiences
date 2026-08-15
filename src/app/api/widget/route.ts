import type { Anchor } from '@/lib/pathway/events';
import { generateStepWidget } from '@/lib/pathway/generate';
import { widgetKind, type PathwayPlan } from '@/lib/pathway/schema';
import { sourceById, verifyAcrossSources } from '@/lib/standards';

export const maxDuration = 60;

/**
 * One widget, from a standard code and a kind — without building a pathway.
 *
 * `/api/pathway` is the real thing and takes ~30s across five model calls,
 * which is right for authoring a lesson and wrong for a conversation. Here the
 * caller already knows which standard and which interaction it wants, so the
 * only work left is configuring the widget: one model call, a few seconds.
 *
 * Built for the MCP server (`mcp/`), where the model in the chat plays the
 * part stage 1 plays in the pipeline — it proposes the standard code, and the
 * graph still gets the final say on whether that code exists.
 */

/** CORS is open here for the same reason it is on `/api/score`: see that file. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

/**
 * A pathway's worth of context, minus the pathway.
 *
 * Widget generators read outcomes and misconceptions out of the plan to
 * sharpen their prompt. There are none here, and inventing them would cost the
 * model call this endpoint exists to avoid — so they are empty and the
 * generator works from the standard alone. Widgets come out a little more
 * generic than the pipeline's; that is the trade for answering in seconds.
 */
function syntheticPlan(anchor: Anchor, kind: string): PathwayPlan {
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
        widgetKind: kind as PathwayPlan['steps'][number]['widgetKind'],
      },
    ],
  };
}

export async function POST(request: Request) {
  let body: { standardCode?: unknown; kind?: unknown; jurisdiction?: unknown };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const standardCode = typeof body.standardCode === 'string' ? body.standardCode.trim() : '';
  if (!standardCode) return json({ error: 'A standardCode is required.' }, 400);

  const parsedKind = widgetKind.safeParse(body.kind);
  if (!parsedKind.success) {
    return json({ error: `Unknown widget kind. Known kinds: ${widgetKind.options.join(', ')}.` }, 400);
  }

  // The graph still decides whether the code exists, exactly as in the pipeline.
  const standard = await verifyAcrossSources(
    standardCode,
    typeof body.jurisdiction === 'string' ? body.jurisdiction : undefined,
  );
  if (!standard) {
    return json({ error: `"${standardCode}" did not resolve against any standards source.` }, 404);
  }

  const source = sourceById(standard.sourceId);
  const [learningComponents, prerequisites] = await Promise.all([
    source.decompose(standard),
    source.progression(standard, 'backward'),
  ]);

  const anchor: Anchor = { standard, learningComponents, prerequisites, companions: [] };

  try {
    const plan = syntheticPlan(anchor, parsedKind.data);
    const { widget, note } = await generateStepWidget(anchor, plan, plan.steps[0]);
    return json({ widget, note, standard });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build that widget.';
    return json({ error: message }, 502);
  }
}
