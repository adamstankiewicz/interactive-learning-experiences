import type { Anchor, DeepPartial, PathwayEvent } from '@/lib/pathway/events';
import { pathwayPlan, standardProposal, type PathwayPlan, type WidgetSpec } from '@/lib/pathway/schema';
import {
  activeSourceLabels,
  proposalPromptFragment,
  sourceById,
  verifyAcrossSources,
  type StandardRef,
} from '@/lib/standards';
import { generateStructured, streamStructured } from '@/lib/structured';
import type { StudentProfile } from '@/lib/student/schema';
import '@/lib/widgets/builtins';
import '@/lib/widgets/builtins.generate';
import { widgetContext } from '@/lib/widgets/context';
import { fallbackWidgetKind, getWidgetCatalogEntry, getWidgetGenerator } from '@/lib/widgets/types';

export type { Anchor };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Enforce the bounds the schema can't express (see the note in `schema.ts`).
 * The model is asked for these counts in prose and usually complies; this is
 * the backstop that keeps a chatty response from failing the whole request.
 *
 * Every step carries a widget by design, so the step cap (6) is the widget
 * cap too — there is no separate limit to enforce, only the outcome
 * cross-reference to keep in range once outcomes are trimmed.
 */
function normalizePlan(plan: PathwayPlan): PathwayPlan {
  const outcomes = plan.outcomes.slice(0, 5);

  return {
    ...plan,
    outcomes,
    priorKnowledge: plan.priorKnowledge.slice(0, 4),
    misconceptions: plan.misconceptions.slice(0, 4),
    steps: plan.steps.slice(0, 6).map((step) => ({
      ...step,
      outcomeIndex: clamp(step.outcomeIndex, 0, Math.max(outcomes.length - 1, 0)),
    })),
  };
}

/**
 * Stage 1 — the model proposes standard codes for a free-text topic.
 * Nothing here is trusted; stage 2 checks every code against the graph.
 */
async function proposeStandardCodes(topic: string, gradeHint?: string) {
  return generateStructured({
    schema: standardProposal,
    system: [
      'You map a teaching topic to standard codes from an authoritative graph.',
      proposalPromptFragment(),
      'Search across every subject the topic could plausibly belong to — math, ELA, science, social',
      'studies — rather than defaulting to the first subject that comes to mind; a topic can have a',
      'real standard in a subject that is not the obvious one.',
      'Order candidates best-first. Prefer the single standard that most directly names the topic.',
      'A wrong guess is cheap — every code is verified against the graph before use.',
    ].join(' '),
    prompt: gradeHint
      ? `Topic: ${topic}\nGrade level: ${gradeHint}`
      : `Topic: ${topic}\nGrade level: infer the most typical one.`,
  });
}

/**
 * Stage 2 lives inline in `streamPathway`: resolving proposals in order against
 * the graph is the same loop as before, but each verdict is reported as it
 * lands instead of only the winner surviving. This is where the standards
 * source stops being a lookup and starts being the source of truth — the
 * anchor standard's wording is the graph's, not the model's.
 */

/**
 * Stage 3 — pull the pedagogical spine hanging off the anchor standard.
 * Routed by `standard.sourceId`, not the active-source list — with more than
 * one source active, whichever one actually verified this code is the only
 * one that has ever heard of it, so decompose/progression have to go back to
 * that same source, not just "the first active one."
 */
async function loadGraphContext(standard: StandardRef, companions: StandardRef[]): Promise<Anchor> {
  const source = sourceById(standard.sourceId);
  const [learningComponents, prerequisites] = await Promise.all([
    source.decompose(standard),
    source.progression(standard, 'backward'),
  ]);

  return { standard, learningComponents, prerequisites, companions };
}

/**
 * What prior evidence says about this student, rendered for the planner.
 *
 * Only the weakest components are included. The profile grows without bound,
 * and the tail of it is mastered material the planner should not spend a
 * pathway on.
 */
function profileBlock(profile: StudentProfile | null): string {
  if (!profile || profile.mastery.length === 0) {
    return '(no prior evidence for this student — plan at grade level)';
  }

  const weakest = profile.mastery
    .slice(0, 5)
    .map(
      (entry) =>
        `- ${entry.learningComponentId}: mastery ${entry.score.toFixed(2)} over ${entry.attempts} attempts`,
    )
    .join('\n');

  const misconceptions = profile.confirmedMisconceptions.length
    ? profile.confirmedMisconceptions.map((m) => `- ${m}`).join('\n')
    : '(none observed yet)';

  return [
    'Weakest learning components so far (lowest mastery first):',
    weakest,
    '',
    'Misconceptions this student has actually demonstrated:',
    misconceptions,
    '',
    `Overall accuracy ${(profile.pacing.accuracy * 100).toFixed(0)}%, hint rate ${profile.pacing.hintRate.toFixed(2)}.`,
  ].join('\n');
}

/**
 * Stage 4 — author the pathway from verified facts.
 *
 * Yields partial plans as the model writes; returns the normalized final one.
 * `yield*` passes both through to the caller in one expression.
 */
async function* planPathway(
  topic: string,
  anchor: Anchor,
  gradeBand: string,
  profile: StudentProfile | null,
  teacherNote?: string,
): AsyncGenerator<DeepPartial<PathwayPlan>, PathwayPlan> {
  const componentBlock = anchor.learningComponents.length
    ? anchor.learningComponents
        .map((c) => `- id: ${c.id}\n  skill: ${c.description}`)
        .join('\n')
    : '(none published for this standard — write outcomes yourself and set learningComponentId to null)';

  const prerequisiteBlock = anchor.prerequisites.length
    ? anchor.prerequisites
        .map((p) => `- ${p.code} (grade ${p.gradeLevels.join('/')}): ${p.description}`)
        .join('\n')
    : '(no prerequisite standards published)';

  // Peer-level, not foundational — companions inform framing (bigIdea, an
  // "activate" hook, maybe a crossword term) but never gain their own
  // outcomes or steps. Weak by design: real when there's something there,
  // silent when there isn't, never forced into a lesson that doesn't need it.
  const companionBlock = anchor.companions.length
    ? anchor.companions.map((c) => `- ${c.code} (${c.subject}): ${c.description}`).join('\n')
    : null;

  const plan = yield* streamStructured({
    schema: pathwayPlan,
    system: [
      'You design a short student learning pathway from authoritative standards data.',
      'Ground every outcome in the supplied learning components: when a component fits, put its',
      'id in learningComponentId. Never invent component ids — use null instead.',
      'Outcomes are observable and student-facing. Steps run activate -> model -> practice -> check',
      'and each names the outcome it advances. Misconceptions are specific and diagnosable',
      '("thinks the parts need not be equal"), never generic ("finds fractions hard").',
      'When prior evidence is supplied, weight the pathway toward the components the student is',
      'weakest on and directly confront misconceptions they have already demonstrated.',
      teacherNote
        ? 'The teacher who wrote this pathway named something specific their students find tricky about'
          + ' this topic, supplied below — treat it as the strongest available signal for the'
          + ' misconceptions list, ahead of anything you would otherwise guess.'
        : '',
      companionBlock
        ? 'Related standards are supplied below, from other subjects the topic also touches. Use them only'
          + ' if they genuinely sharpen the bigIdea or give a step a richer hook — never invent an outcome or'
          + ' a step for them, and never force a connection that is not really there.'
        : '',
      anchor.standard.verified
        ? ''
        : 'This topic did not resolve to any verified standard — there is no graph-authoritative skill'
          + ' decomposition to ground outcomes in, so write them from solid general subject-matter'
          + ' knowledge for this grade band instead. Keep the framing exploratory rather than implying an'
          + ' alignment that was never actually confirmed.',
    ].join(' '),
    prompt: [
      `Teacher's topic: ${topic}`,
      '',
      anchor.standard.verified
        ? `Anchor standard ${anchor.standard.code} (${anchor.standard.subject}, grade ${anchor.standard.gradeLevels.join('/')}):\n${anchor.standard.description}`
        : `No standard verified for this topic — proceed as an exploration pathway on "${anchor.standard.description}", not standards-aligned.`,
      '',
      'Learning components (the authoritative skill decomposition):',
      componentBlock,
      '',
      'Prerequisite standards (unfinished learning to activate, not to reteach):',
      prerequisiteBlock,
      ...(companionBlock ? ['', 'Related standards this topic also touches (optional, weave in only if it helps):', companionBlock] : []),
      ...(teacherNote ? ['', "What the teacher says is tricky for their students:", teacherNote] : []),
      '',
      'Prior evidence for this student:',
      profileBlock(profile),
      '',
      `Grade band: ${gradeBand}`,
    ].join('\n'),
  });

  return normalizePlan(plan);
}

/**
 * Stage 5 — configure the widget each step asked for.
 *
 * The plan chooses the kind; this configures it against the specific step it
 * serves, which is why it runs as a second pass rather than inside the plan
 * call. One model call per widget, run in parallel per step (see
 * `streamPathway`) rather than one call for the whole pathway.
 *
 * Both the per-kind generation logic and the coverage gate used to live here
 * as a hardcoded switch and a pair of regex checks. Both now come from the
 * widget registry (`@/lib/widgets`) — this function is orchestration only:
 * resolve which kind actually fits, ask that kind's own definition to
 * generate it, and fall back to `fallbackWidgetKind()` if it can't.
 */
async function attemptStepWidget(
  anchor: Anchor,
  plan: PathwayPlan,
  step: PathwayPlan['steps'][number],
): Promise<{ widget: WidgetSpec; note: string | null }> {
  const requested = getWidgetCatalogEntry(step.widgetKind);
  const prompt = widgetContext(anchor, plan, step);
  const ctx = { anchor, plan, step, prompt };

  let kind = step.widgetKind;
  let substitutionNote: string | null = null;

  if (!requested || (requested.coverageRule && !requested.coverageRule(anchor.standard))) {
    kind = fallbackWidgetKind() as typeof step.widgetKind;
    substitutionNote = requested
      ? `${requested.plannerDescription.split('.')[0]} doesn't fit ${anchor.standard.code} — built a fallback activity for this step instead.`
      : `"${step.widgetKind}" isn't a registered widget — built a fallback activity for this step instead.`;
  }

  const generator = getWidgetGenerator(kind);
  if (!generator) {
    throw new Error(`No generator registered for fallback kind "${kind}" — check builtins.generate.ts.`);
  }

  const result = await generator.generate(ctx);
  const widget = (result.widget ?? (await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx)).widget) as WidgetSpec;

  return { widget, note: [substitutionNote, result.note].filter(Boolean).join(' ') || null };
}

/**
 * `streamPathway` runs every step's widget concurrently via `Promise.race`,
 * which means one rejection ends the whole run even when the other widgets
 * already succeeded — a single model response that fails schema validation
 * would otherwise take four good widgets down with it. One retry absorbs
 * that: model non-compliance on structured output is usually transient, not
 * systematic, so trying again is more useful here than surfacing the failure.
 */
export async function generateStepWidget(
  anchor: Anchor,
  plan: PathwayPlan,
  step: PathwayPlan['steps'][number],
): Promise<{ widget: WidgetSpec; note: string | null }> {
  try {
    return await attemptStepWidget(anchor, plan, step);
  } catch {
    return attemptStepWidget(anchor, plan, step);
  }
}

/**
 * The whole pipeline, as a stream of events.
 *
 * The stages were already sequential and independently meaningful, so this adds
 * no orchestration — it just stops discarding the intermediate results. The
 * verdict events matter most: watching the graph reject a model-proposed code
 * is the clearest statement of what this product does.
 */
export async function* streamPathway(
  topic: string,
  gradeHint?: string,
  profile: StudentProfile | null = null,
  teacherNote?: string,
): AsyncGenerator<PathwayEvent> {
  yield { type: 'stage', stage: 'propose', status: 'active' };
  const proposal = await proposeStandardCodes(topic, gradeHint);
  yield { type: 'candidates', candidates: proposal.candidates };
  yield {
    type: 'stage',
    stage: 'propose',
    status: 'done',
    detail: `${proposal.candidates.length} candidate${proposal.candidates.length === 1 ? '' : 's'}`,
  };

  // Resolve every candidate, not just until the first hit — the first match
  // becomes the anchor, and up to two more become companions (see the
  // `Anchor.companions` doc comment): peer-level standards this topic also
  // touches, for a genuinely cross-subject topic a single anchor can't carry
  // alone. Each candidate is tried against every active source in priority
  // order (see `verifyAcrossSources`) before being counted as rejected.
  const MAX_COMPANIONS = 2;
  yield { type: 'stage', stage: 'verify', status: 'active' };
  const rejected: string[] = [];
  const companions: StandardRef[] = [];
  let standard: StandardRef | null = null;

  // Started together, awaited in order. Each candidate is an independent MCP
  // round trip (~565ms measured), and nothing in the loop body depends on the
  // previous result — serializing them cost ~1.1s of dead wall clock on a
  // four-candidate proposal. Verdicts still stream in candidate order.
  const pending = proposal.candidates.map((candidate) =>
    verifyAcrossSources(candidate.statementCode),
  );
  // Marks each rejection handled now so a later-awaited failure is not an
  // unhandled rejection; awaiting still rethrows, as it did when serial.
  for (const p of pending) p.catch(() => {});

  for (const [index, candidate] of proposal.candidates.entries()) {
    const match = await pending[index]!;
    yield { type: 'verdict', code: candidate.statementCode, resolved: Boolean(match) };

    if (!match) {
      rejected.push(candidate.statementCode);
    } else if (!standard) {
      standard = match;
    } else if (companions.length < MAX_COMPANIONS) {
      companions.push(match);
    }
  }

  // Honest fallback, not a dead end: nothing resolved against any active
  // source, so continue with a synthetic, explicitly-unverified standard
  // instead of failing outright. `tags: []` already makes every tag-gated
  // coverageRule (fraction-area-model, draft-meter) correctly exclude
  // themselves, and empty learningComponents/prerequisites is a state the
  // rest of the pipeline already degrades around — see `standard.verified`,
  // which the UI (PathwayDocument, /learn) reads to show an honest
  // "exploration pathway" badge instead of a fabricated standard code.
  standard ??= {
    sourceId: 'none',
    sourceLabel: 'no matching standard',
    code: 'EXPLORATION',
    id: 'unverified',
    description: topic,
    jurisdiction: 'n/a',
    gradeLevels: gradeHint ? [gradeHint] : [],
    subject: 'General',
    tags: [],
    verified: false,
  };

  yield {
    type: 'stage',
    stage: 'verify',
    status: 'done',
    detail: standard.verified
      ? standard.code
      : `no standard resolved against ${activeSourceLabels()} — exploring "${topic}" without one`,
  };

  yield { type: 'stage', stage: 'graph', status: 'active' };
  const anchor: Anchor = standard.verified
    ? await loadGraphContext(standard, companions)
    : { standard, learningComponents: [], prerequisites: [], companions };
  yield { type: 'anchor', anchor };
  yield {
    type: 'stage',
    stage: 'graph',
    status: 'done',
    detail: `${anchor.learningComponents.length} components · ${anchor.prerequisites.length} prerequisites`,
  };

  yield { type: 'stage', stage: 'plan', status: 'active' };
  const planStream = planPathway(topic, anchor, proposal.gradeBand, profile, teacherNote);
  let planResult = await planStream.next();

  while (!planResult.done) {
    yield { type: 'plan-partial', plan: planResult.value };
    planResult = await planStream.next();
  }

  const plan = planResult.value;
  yield { type: 'plan', plan };
  yield { type: 'stage', stage: 'plan', status: 'done', detail: `${plan.steps.length} steps` };

  // Every step carries a widget, so this stage is never skipped — only how
  // many run concurrently varies. Parallel rather than sequential: with one
  // call per step, serializing would multiply the slowest single call by up
  // to 6.
  yield { type: 'stage', stage: 'widget', status: 'active' };

  const running = new Map(
    plan.steps.map((step, index) => [
      index,
      generateStepWidget(anchor, plan, step).then((result) => ({ index, ...result })),
    ]),
  );

  // Yield in completion order, not step order, so the fastest widget appears
  // against its step immediately rather than waiting behind a slower one.
  while (running.size > 0) {
    const { index, widget, note } = await Promise.race(running.values());
    running.delete(index);
    yield { type: 'step-widget', stepIndex: index, widget, note };
  }

  yield { type: 'stage', stage: 'widget', status: 'done', detail: `${plan.steps.length} built` };
  yield { type: 'done' };
}
