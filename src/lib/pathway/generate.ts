import { generateText, streamText, Output } from 'ai';
import type { FlexibleSchema } from 'ai';

import { pathwayModel } from '@/lib/model';
import {
  findLearningComponents,
  findProgression,
  findStandardStatement,
  type StandardStatement,
} from '@/lib/learning-commons/client';
import type { Anchor, DeepPartial, PathwayEvent } from '@/lib/pathway/events';
import {
  fractionAreaModelSpec,
  pathwayPlan,
  standardProposal,
  swiperFlashcardSpec,
  type FractionAreaModelSpec,
  type PathwayPlan,
  type SwiperFlashcardSpec,
  type WidgetKind,
  type WidgetSpec,
} from '@/lib/pathway/schema';

export type { Anchor };

const MODEL = pathwayModel();

/**
 * Every stage here is the same shape: a schema, a system prompt, and a user
 * prompt, in and a validated object out. `generateObject` is deprecated in AI
 * SDK v7 in favour of `generateText` with an `output` spec, so that lives in
 * one place rather than being repeated at each call site.
 */
async function generateStructured<T>(options: {
  schema: FlexibleSchema<T>;
  system: string;
  prompt: string;
}): Promise<T> {
  const result = await generateText({
    model: MODEL,
    output: Output.object({ schema: options.schema }),
    system: options.system,
    prompt: options.prompt,
  });

  return result.output;
}

/**
 * The same call, surfaced incrementally. The plan is the slowest stage by far
 * and the only one whose intermediate state is worth showing, so it is the only
 * one that streams: each yielded object is a more complete version of the last.
 */
async function* streamStructured<T>(options: {
  schema: FlexibleSchema<T>;
  system: string;
  prompt: string;
}): AsyncGenerator<DeepPartial<T>, T> {
  const result = streamText({
    model: MODEL,
    output: Output.object({ schema: options.schema }),
    system: options.system,
    prompt: options.prompt,
  });

  for await (const partial of result.partialOutputStream) {
    yield partial as DeepPartial<T>;
  }

  return (await result.output) as T;
}

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
 * Keep the widget solvable. The student picks a partition before selecting
 * parts, so the target denominator has to be among the offered choices —
 * otherwise the task the prompt states cannot be completed.
 */
function normalizeWidget(spec: FractionAreaModelSpec): FractionAreaModelSpec {
  const denominator = clamp(spec.denominator, 2, 12);
  const numerator = clamp(spec.numerator, 1, denominator);

  const choices = [...new Set([...spec.denominatorChoices, denominator])]
    .filter((value) => value >= 2 && value <= 12)
    .sort((a, b) => a - b)
    .slice(0, 6);

  return {
    ...spec,
    denominator,
    numerator,
    denominatorChoices: choices.includes(denominator) ? choices : [...choices, denominator].sort((a, b) => a - b),
  };
}

/**
 * Trim the card set to the count the prompt asks for.
 *
 * Deliberately does not touch `correctDirection`. A set that is all one
 * direction is gameable, and the system prompt asks the model to vary it — but
 * the direction is a fact about the card's text, so "fixing" it here would
 * make the widget mark true statements false.
 */
function normalizeFlashcards(spec: SwiperFlashcardSpec): SwiperFlashcardSpec {
  return { ...spec, cards: spec.cards.slice(0, 8) };
}

/**
 * Stage 1 — the model proposes standard codes for a free-text topic.
 * Nothing here is trusted; stage 2 checks every code against the graph.
 */
async function proposeStandardCodes(topic: string, gradeHint?: string) {
  return generateStructured({
    schema: standardProposal,
    system: [
      'You map a teaching topic to Common Core standard codes.',
      'Propose codes in official Common Core notation only: math like "3.NF.A.1", "5.NBT.A.2";',
      'ELA like "RI.5.2", "RL.4.3". Do not invent codes for frameworks like NGSS.',
      'Order candidates best-first. Prefer the single standard that most directly names the topic.',
      'A wrong guess is cheap — every code is verified against an authoritative graph before use.',
    ].join(' '),
    prompt: gradeHint
      ? `Topic: ${topic}\nGrade level: ${gradeHint}`
      : `Topic: ${topic}\nGrade level: infer the most typical one.`,
  });
}

/**
 * Stage 2 lives inline in `streamPathway`: resolving proposals in order against
 * the graph is the same loop as before, but each verdict is reported as it
 * lands instead of only the winner surviving. This is where the Learning
 * Commons stops being a lookup and starts being the source of truth — the
 * anchor standard's wording is the graph's, not the model's.
 */

/** Stage 3 — pull the pedagogical spine hanging off the anchor standard. */
async function loadGraphContext(standard: StandardStatement): Promise<Anchor> {
  const [learningComponents, prerequisites] = await Promise.all([
    findLearningComponents(standard.caseIdentifierUUID),
    findProgression(standard.caseIdentifierUUID, 'backward'),
  ]);

  return { standard, learningComponents, prerequisites };
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
): AsyncGenerator<DeepPartial<PathwayPlan>, PathwayPlan> {
  const componentBlock = anchor.learningComponents.length
    ? anchor.learningComponents
        .map((c) => `- id: ${c.identifier}\n  skill: ${c.description}`)
        .join('\n')
    : '(none published for this standard — write outcomes yourself and set learningComponentId to null)';

  const prerequisiteBlock = anchor.prerequisites.length
    ? anchor.prerequisites
        .map((p) => `- ${p.statementCode} (grade ${p.gradeLevel}): ${p.description}`)
        .join('\n')
    : '(no prerequisite standards published)';

  const plan = yield* streamStructured({
    schema: pathwayPlan,
    system: [
      'You design a short student learning pathway from authoritative standards data.',
      'Ground every outcome in the supplied learning components: when a component fits, put its',
      'id in learningComponentId. Never invent component ids — use null instead.',
      'Outcomes are observable and student-facing. Steps run activate -> model -> practice -> check',
      'and each names the outcome it advances. Misconceptions are specific and diagnosable',
      '("thinks the parts need not be equal"), never generic ("finds fractions hard").',
    ].join(' '),
    prompt: [
      `Teacher's topic: ${topic}`,
      '',
      `Anchor standard ${anchor.standard.statementCode} (${anchor.standard.academicSubject}, grade ${anchor.standard.gradeLevels.join('/')}):`,
      anchor.standard.description,
      '',
      'Learning components (the authoritative skill decomposition):',
      componentBlock,
      '',
      'Prerequisite standards (unfinished learning to activate, not to reteach):',
      prerequisiteBlock,
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
 * call. One model call per widget, so `normalizePlan` caps how many a pathway
 * may request.
 */
const FRACTION_CODE = /^(3|4|5)\.NF\./;

/** Context every widget generator gets, regardless of kind. */
function widgetContext(anchor: Anchor, plan: PathwayPlan, step: PathwayPlan['steps'][number]) {
  const componentBlock = anchor.learningComponents
    .map((c) => `- id: ${c.identifier}\n  skill: ${c.description}`)
    .join('\n');

  return [
    `Standard ${anchor.standard.statementCode}: ${anchor.standard.description}`,
    '',
    'Learning components:',
    componentBlock || '(none)',
    '',
    'Pathway outcomes:',
    plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
    '',
    'Known misconceptions:',
    plan.misconceptions.map((m) => `- ${m}`).join('\n'),
    '',
    `This widget belongs to the "${step.purpose}" step: ${step.title} — ${step.description}`,
  ].join('\n');
}

/**
 * Every step needs a widget, so a mismatch is resolved by substitution, not
 * omission — this is the only place `widgetKind` can differ from what the plan
 * asked for, and it always resolves to a kind that fits the standard.
 */
function resolveWidgetKind(
  requested: WidgetKind,
  standardCode: string,
): { kind: WidgetKind; note: string | null } {
  if (requested === 'fraction-area-model' && !FRACTION_CODE.test(standardCode)) {
    return {
      kind: 'swiper-flashcard',
      note: `A fraction area model doesn't fit ${standardCode} — it's not a fractions standard. Built a sorting activity for this step instead.`,
    };
  }
  return { kind: requested, note: null };
}

async function generateStepWidget(
  anchor: Anchor,
  plan: PathwayPlan,
  step: PathwayPlan['steps'][number],
): Promise<{ widget: WidgetSpec; note: string | null }> {
  const { kind, note } = resolveWidgetKind(step.widgetKind, anchor.standard.statementCode);

  if (kind === 'fraction-area-model') {
    const spec = await generateStructured({
      schema: fractionAreaModelSpec,
      system: [
        'You configure an interactive fraction area model: the student picks how many equal parts',
        'to partition a whole into, then selects parts to build a target fraction.',
        'Choose a numerator and denominator that make the target learning component visible —',
        'a unit fraction (numerator 1) for partitioning skills, a non-unit fraction for composing.',
        'Keep the denominator inside the grade-level range the standard implies.',
        'The hint names the specific misconception a wrong answer reveals.',
      ].join(' '),
      prompt: widgetContext(anchor, plan, step),
    });

    return { widget: normalizeWidget(spec), note };
  }

  const spec = await generateStructured({
    schema: swiperFlashcardSpec,
    system: [
      'You configure a two-way sorting activity: the student reads a statement on a card and',
      'swipes it left or right into one of two labelled buckets.',
      'Pick a single, consistent dichotomy for the whole set (true/false, example/non-example,',
      'equivalent/not equivalent) and use the same two labels on every card.',
      'Write cards that discriminate: at least one should sit on a known misconception, so a',
      'student holding it sorts wrongly. Vary which direction is correct across the set.',
      'Each explanation names why the answer is what it is, in one student-facing sentence.',
    ].join(' '),
    prompt: widgetContext(anchor, plan, step),
  });

  return { widget: normalizeFlashcards(spec), note };
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

  // Resolve in order and report each verdict, rather than only the winner.
  yield { type: 'stage', stage: 'verify', status: 'active' };
  const rejected: string[] = [];
  let standard: StandardStatement | null = null;

  for (const candidate of proposal.candidates) {
    const match = await findStandardStatement(candidate.statementCode);
    yield { type: 'verdict', code: candidate.statementCode, resolved: Boolean(match) };

    if (match) {
      standard = match;
      break;
    }
    rejected.push(candidate.statementCode);
  }

  if (!standard) {
    yield {
      type: 'error',
      message: `No proposed standard resolved in the Learning Commons graph. Tried: ${proposal.candidates
        .map((c) => c.statementCode)
        .join(', ')}. Try naming the topic more concretely, or include a grade level.`,
    };
    return;
  }

  yield { type: 'stage', stage: 'verify', status: 'done', detail: standard.statementCode };

  yield { type: 'stage', stage: 'graph', status: 'active' };
  const anchor = await loadGraphContext(standard);
  yield { type: 'anchor', anchor };
  yield {
    type: 'stage',
    stage: 'graph',
    status: 'done',
    detail: `${anchor.learningComponents.length} components · ${anchor.prerequisites.length} prerequisites`,
  };

  yield { type: 'stage', stage: 'plan', status: 'active' };
  const planStream = planPathway(topic, anchor, proposal.gradeBand);
  let planResult = await planStream.next();

  while (!planResult.done) {
    yield { type: 'plan-partial', plan: planResult.value };
    planResult = await planStream.next();
  }

  const plan = planResult.value;
  yield { type: 'plan', plan };
  yield { type: 'stage', stage: 'plan', status: 'done', detail: `${plan.steps.length} steps` };

  // Every step carries a widget, so this is never skipped — only how many run
  // concurrently varies. Parallel rather than sequential: with one call per
  // step, serializing would multiply the slowest single stage by up to 6.
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
