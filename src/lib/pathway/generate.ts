import { streamText, Output } from 'ai';
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
  COVERAGE_SENTENCE,
  FRACTION_CODE,
  READING_EVIDENCE_CODE,
  WRITING_CODE,
  hasGeneratorFor,
} from '@/lib/pathway/coverage';
import {
  draftMeterSpec,
  fractionAreaModelSpec,
  pathwayPlan,
  standardProposal,
  type DraftMeterSpec,
  type FractionAreaModelSpec,
  type PathwayPlan,
  type WidgetSpec,
} from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';

export type { Anchor };

const MODEL = pathwayModel();

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
      // A step pointing past the trimmed outcomes would break the UI's cross-reference.
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

export type PathwayResult = {
  topic: string;
  anchor: Anchor;
  /** Codes the model proposed that the graph rejected — surfaced, not hidden. */
  rejectedCodes: string[];
  plan: PathwayPlan;
  widget: WidgetSpec | null;
  /** Why no widget, when widget is null. */
  widgetNote: string | null;
};

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
 * Stage 5 — configure a widget for the anchor standard.
 *
 * Each generator declares the standards it can serve (see `coverage.ts`).
 * Rather than force every topic through whichever widget happens to exist, an
 * unmatched standard returns a note explaining why — the honest shape of a
 * first step.
 */

/** Shared context block — the graph's skill decomposition, when it has one. */
function componentBlockFor(anchor: Anchor): string {
  return (
    anchor.learningComponents.map((c) => `- id: ${c.identifier}\n  skill: ${c.description}`).join('\n') ||
    '(none published for this standard)'
  );
}

async function generateFractionAreaModel(
  anchor: Anchor,
  plan: PathwayPlan,
): Promise<FractionAreaModelSpec> {
  const componentBlock = componentBlockFor(anchor);

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
    prompt: [
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
      'Configure the widget for the "model" step of this pathway.',
    ].join('\n'),
  });

  return normalizeWidget(spec);
}

/**
 * The standard's wording is copied into the spec verbatim rather than
 * regenerated: the scoring call needs the graph's text, not a paraphrase.
 *
 * Two modes, decided by the standard rather than by the model. A reading
 * standard asks the student to cite a source, so one has to exist; a writing
 * standard asks them to argue from their own knowledge, and a passage there
 * would quietly change the task.
 */
async function generateDraftMeter(anchor: Anchor, plan: PathwayPlan): Promise<DraftMeterSpec> {
  const needsPassage = READING_EVIDENCE_CODE.test(anchor.standard.statementCode);

  const mode = needsPassage
    ? [
        'This is a READING standard, so the widget supplies a source passage the student reads',
        'before answering. Write it yourself: 40-120 words, age-appropriate, with a real position or',
        'tension in it worth disagreeing about, and give it a plausible short attribution.',
        'The question must be answerable ONLY from that passage — it asks the student to take a',
        'position about the text and back it with something the passage actually says.',
      ]
    : [
        'This is a WRITING standard, so set passage to null.',
        'The question must be answerable in three to five sentences by a middle schooler with no',
        'source material in front of them, and must have a real second side — a question with one',
        'obvious answer produces no argument to measure.',
        "Prefer something in a student's own life over an abstract civic topic.",
      ];

  const spec = await generateStructured({
    schema: draftMeterSpec,
    system: [
      'You configure a Draft Meter: a question, a textbox, and one line that scores the strength',
      'of what the student writes.',
      ...mode,
      'The criteria name what a strong answer contains; they ground the scorer and are never shown.',
      'standardForStudents IS shown to the student behind a "?", so it must name what counts as done',
      'in plain words — the point is that they can see the goalposts, not just be measured against them.',
    ].join(' '),
    prompt: [
      `Standard ${anchor.standard.statementCode}: ${anchor.standard.description}`,
      '',
      'Learning components:',
      componentBlockFor(anchor),
      '',
      'Pathway outcomes:',
      plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
      '',
      `Grade band: ${plan.gradeBand}`,
      '',
      'Copy standardCode and standardDescription from the standard above exactly as given.',
      'Configure the widget for the "practice" step of this pathway.',
    ].join('\n'),
  });

  // The mode is the pipeline's call, not the model's — a passage on a writing
  // standard would change the task the standard actually asks for.
  return {
    ...spec,
    criteria: spec.criteria.slice(0, 4),
    passage: needsPassage ? spec.passage : null,
  };
}

async function generateWidget(
  anchor: Anchor,
  plan: PathwayPlan,
): Promise<{ widget: WidgetSpec | null; note: string | null }> {
  const code = anchor.standard.statementCode;

  if (FRACTION_CODE.test(code)) {
    return { widget: await generateFractionAreaModel(anchor, plan), note: null };
  }

  if (WRITING_CODE.test(code) || READING_EVIDENCE_CODE.test(code)) {
    return { widget: await generateDraftMeter(anchor, plan), note: null };
  }

  return {
    widget: null,
    note: `No widget generator is registered for ${code} yet. Generators so far cover ${COVERAGE_SENTENCE}. The pathway above is still fully grounded in the graph.`,
  };
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

  // The widget gate depends only on the anchor, so a skip is knowable here and
  // reported as a skip rather than a silent absence.
  if (!hasGeneratorFor(anchor.standard.statementCode)) {
    const { note } = await generateWidget(anchor, plan);
    yield { type: 'stage', stage: 'widget', status: 'skipped', detail: 'No generator for this standard' };
    yield { type: 'widget', widget: null, note };
    yield { type: 'done' };
    return;
  }

  yield { type: 'stage', stage: 'widget', status: 'active' };
  const { widget, note } = await generateWidget(anchor, plan);
  yield { type: 'widget', widget, note };
  yield { type: 'stage', stage: 'widget', status: 'done' };
  yield { type: 'done' };
}
