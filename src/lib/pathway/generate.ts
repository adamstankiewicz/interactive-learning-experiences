import {
  findLearningComponents,
  findProgression,
  findStandardStatement,
  type StandardStatement,
} from '@/lib/learning-commons/client';
import { FRACTION_CODE, READING_EVIDENCE_CODE, WRITING_CODE } from '@/lib/pathway/coverage';
import { layoutCrossword, sanitizeAnswer } from '@/lib/pathway/crossword';
import type { Anchor, DeepPartial, PathwayEvent } from '@/lib/pathway/events';
import {
  crosswordSpec,
  draftMeterSpec,
  dragCategorizeSpec,
  dragSortSpec,
  fractionAreaModelSpec,
  pathwayPlan,
  standardProposal,
  swiperFlashcardSpec,
  type CrosswordSpec,
  type DragCategorizeSpec,
  type DragSortSpec,
  type FractionAreaModelSpec,
  type PathwayPlan,
  type SwiperFlashcardSpec,
  type WidgetKind,
  type WidgetSpec,
} from '@/lib/pathway/schema';
import { generateStructured, streamStructured } from '@/lib/structured';
import type { StudentProfile } from '@/lib/student/schema';

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
 * Keep the puzzle solvable. `correctOrder` is prose to the model, not a
 * validated reference — an id it drops or invents would make the widget
 * unwinnable rather than just wrong, so missing ids are appended in list
 * order rather than left out.
 */
function normalizeDragSort(spec: DragSortSpec): DragSortSpec {
  const items = spec.items.slice(0, 8);
  const validIds = new Set(items.map((item) => item.id));
  const ordered = spec.correctOrder.filter((id) => validIds.has(id));
  const missing = items.map((item) => item.id).filter((id) => !ordered.includes(id));

  return { ...spec, items, correctOrder: [...ordered, ...missing] };
}

/**
 * Same reasoning as `normalizeDragSort`: an item whose `categoryId` names a
 * category the model didn't actually define would be permanently
 * unplaceable. Falling back to the first category keeps every item solvable.
 */
function normalizeDragCategorize(spec: DragCategorizeSpec): DragCategorizeSpec {
  const categories = spec.categories.slice(0, 4);
  const validCategoryIds = new Set(categories.map((category) => category.id));

  const items = spec.items.slice(0, 10).map((item) =>
    validCategoryIds.has(item.categoryId) || !categories[0]
      ? item
      : { ...item, categoryId: categories[0].id },
  );

  return { ...spec, categories, items };
}

/**
 * A crossword is only a crossword if the words interlock. The model authors
 * terms, `layoutCrossword` decides which of them earn a square, and anything
 * that cannot cross what is already on the grid is dropped here rather than
 * shipped as a clue pointing at nothing. Ported from Bethany's pathway-level
 * crossword generator — the interlocking algorithm and its rules are unchanged,
 * only the call site (per-step now, not once per pathway) differs.
 */
const MIN_CROSSWORD_ENTRIES = 5;
const MAX_CROSSWORD_ENTRIES = 18;

function normalizeCrossword(spec: CrosswordSpec): { widget: CrosswordSpec | null; note: string | null } {
  const requested = spec.entries.slice(0, MAX_CROSSWORD_ENTRIES);
  const layout = layoutCrossword(requested);

  if (layout.entries.length < MIN_CROSSWORD_ENTRIES) {
    return {
      widget: null,
      note: `Only ${layout.entries.length} of ${requested.length} generated terms interlocked into a grid — too few for a crossword, so none is shown.`,
    };
  }

  // Keep the survivors in their authored order, carrying the sanitized answer.
  // Layout is deterministic and greedy, so replaying it on this pruned list in
  // the browser reproduces exactly the grid measured here.
  const placed = new Set(layout.entries.map((entry) => entry.answer));
  const kept: CrosswordSpec['entries'] = [];
  const seen = new Set<string>();

  for (const entry of requested) {
    const answer = sanitizeAnswer(entry.answer);
    if (!placed.has(answer) || seen.has(answer)) continue;

    seen.add(answer);
    kept.push({ ...entry, answer });
  }

  return {
    widget: { ...spec, entries: kept },
    note: layout.unplaced.length
      ? `${layout.unplaced.length} generated term${layout.unplaced.length === 1 ? '' : 's'} could not interlock and was dropped from the crossword: ${layout.unplaced.join(', ')}.`
      : null,
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
      'When prior evidence is supplied, weight the pathway toward the components the student is',
      'weakest on and directly confront misconceptions they have already demonstrated.',
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
 */

/** Context every widget generator gets, regardless of kind. */
function widgetContext(anchor: Anchor, plan: PathwayPlan, step: PathwayPlan['steps'][number]): string {
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
    `Grade band: ${plan.gradeBand}`,
    '',
    `This widget belongs to the "${step.purpose}" step: ${step.title} — ${step.description}`,
  ].join('\n');
}

/**
 * Every step needs a widget, so a mismatch is resolved by substitution, not
 * omission — this is the only place `widgetKind` can differ from what the plan
 * asked for, and it always resolves to a kind that fits the standard.
 * `swiper-flashcard` is the fallback for both gated kinds: it has no subject
 * restriction of its own, so it always fits. `crossword` is never gated here
 * at all — every standard carries vocabulary, so it is always a valid choice
 * (see `coverage.ts`'s `CROSSWORD_SERVES_EVERY_STANDARD`).
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

  if (
    requested === 'draft-meter' &&
    !(WRITING_CODE.test(standardCode) || READING_EVIDENCE_CODE.test(standardCode))
  ) {
    return {
      kind: 'swiper-flashcard',
      note: `A Draft Meter doesn't fit ${standardCode} — it scores written arguments, and this isn't a writing or reading-evidence standard. Built a sorting activity for this step instead.`,
    };
  }

  return { kind: requested, note: null };
}

/**
 * A crossword can legitimately come back too sparse to interlock (see
 * `normalizeCrossword`) — the one widget kind whose *normalization*, not just
 * its subject-match, can fail. When that happens the step still needs
 * something, so it falls back the same way a subject mismatch does.
 */
/**
 * Broken out because it has two call sites: the normal `swiper-flashcard`
 * case below, and the crossword case's own fallback when too few terms
 * interlock to make a puzzle (see `normalizeCrossword`). Swiper-flashcard has
 * no subject restriction of its own, which is what makes it a safe landing
 * spot for either kind of failure.
 */
async function generateSwiperFlashcard(context: string): Promise<SwiperFlashcardSpec> {
  const spec = await generateStructured({
    schema: swiperFlashcardSpec,
    system: [
      'You configure a two-way sorting activity: the student reads a statement on a card and',
      'swipes it up or down into one of two labelled buckets.',
      'Pick a single, consistent dichotomy for the whole set (true/false, example/non-example,',
      'equivalent/not equivalent) and use the same two labels on every card.',
      'Write cards that discriminate: at least one should sit on a known misconception, so a',
      'student holding it sorts wrongly. Vary which direction is correct across the set.',
      'Each explanation names why the answer is what it is, in one student-facing sentence.',
    ].join(' '),
    prompt: context,
  });

  return normalizeFlashcards(spec);
}

async function attemptStepWidget(
  anchor: Anchor,
  plan: PathwayPlan,
  step: PathwayPlan['steps'][number],
): Promise<{ widget: WidgetSpec; note: string | null }> {
  const { kind, note } = resolveWidgetKind(step.widgetKind, anchor.standard.statementCode);
  const context = widgetContext(anchor, plan, step);

  switch (kind) {
    case 'fraction-area-model': {
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
        prompt: context,
      });

      return { widget: normalizeWidget(spec), note };
    }

    case 'swiper-flashcard':
      return { widget: await generateSwiperFlashcard(context), note };

    // The standard's wording is copied into the spec verbatim rather than
    // regenerated: the scoring call needs the graph's text, not a paraphrase.
    // Two modes, decided by the standard rather than by the model — see
    // `resolveWidgetKind`, which already guarantees one of the two applies.
    case 'draft-meter': {
      const needsPassage = READING_EVIDENCE_CODE.test(anchor.standard.statementCode);

      const mode = needsPassage
        ? [
            'This is a READING standard, so the widget supplies a source passage the student reads',
            'before answering. Write it yourself: 40-120 words, age-appropriate, with a real position',
            'or tension in it worth disagreeing about, and give it a plausible short attribution.',
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
          'standardForStudents IS shown to the student behind a "?", so it must name what counts as',
          'done in plain words — the point is that they can see the goalposts, not just be measured',
          'against them.',
        ].join(' '),
        prompt: [
          context,
          '',
          'Copy standardCode and standardDescription from the standard above exactly as given.',
        ].join('\n'),
      });

      // The mode is the pipeline's call, not the model's — a passage on a
      // writing standard would change the task the standard actually asks for.
      return {
        widget: { ...spec, criteria: spec.criteria.slice(0, 4), passage: needsPassage ? spec.passage : null },
        note,
      };
    }

    case 'drag-sort': {
      const spec = await generateStructured({
        schema: dragSortSpec,
        system: [
          'You configure a drag-to-reorder activity: the student arranges items into the order they',
          'believe is correct.',
          'Pick items with a real, teachable order along ONE dimension — chronological sequence,',
          'magnitude, or steps in a process. Never an order guessable from surface cues alone',
          '(alphabetical, item length) — getting it right must require understanding the content.',
          'correctOrder must list every item id exactly once, true order first to last.',
        ].join(' '),
        prompt: context,
      });

      return { widget: normalizeDragSort(spec), note };
    }

    case 'drag-categorize': {
      const spec = await generateStructured({
        schema: dragCategorizeSpec,
        system: [
          'You configure a drag-to-sort activity: the student places each item into the category it',
          'belongs in.',
          'Choose categories that partition the items cleanly, with no item that could reasonably',
          'belong to more than one. Spread items roughly evenly — never load one category with most',
          'of them and leave another with one or two.',
          "Every item's categoryId must be one of the category ids you defined.",
        ].join(' '),
        prompt: context,
      });

      return { widget: normalizeDragCategorize(spec), note };
    }

    case 'crossword': {
      const prerequisiteBlock = anchor.prerequisites.length
        ? anchor.prerequisites
            .map((p) => `- ${p.statementCode} (grade ${p.gradeLevel}): ${p.description}`)
            .join('\n')
        : '(no prerequisite standards published — draw the supporting terms from the anchor standard instead)';

      const spec = await generateStructured({
        schema: crosswordSpec,
        system: [
          'You write the terms and clues for a vocabulary crossword. You do not lay out a grid:',
          'the words are interlocked by an algorithm afterwards, and any word that cannot cross',
          'another is thrown away — so supply words that share letters, and plenty of short ones.',
          'Terms are the vocabulary this standard makes students read, say and write — words that',
          'would earn a place on the classroom word wall. Never lift incidental words out of the',
          'phrasing of a standard: in "the quantity formed by 1 part", the term being taught is',
          '"unit fraction", not "quantity" or "formed". Draw the central terms from the anchor',
          'standard, its learning components and the learning outcomes; mark those source',
          '"anchor". Fill the rest from the prerequisite standards, marked source "prerequisite",',
          'so solving the puzzle rehearses the prior knowledge the lesson depends on.',
          'Set sourceCode to the statement code the term came from.',
          'A clue defines or exemplifies the term in the plainest language the grade band allows.',
          'Never put the answer, its plural, or a word sharing its root inside its own clue.',
          'Write clues in words, never in LaTeX or symbols. Where a known misconception has a',
          'name, clue the correct term precisely enough to rule the misconception out.',
          'No proper nouns, no abbreviations, no two entries meaning the same thing.',
        ].join(' '),
        prompt: [
          context,
          '',
          'Prerequisite standards (source of the supporting terms):',
          prerequisiteBlock,
        ].join('\n'),
      });

      const result = normalizeCrossword(spec);
      if (result.widget) return { widget: result.widget, note };

      // Too few terms interlocked for a solvable grid — the one way this
      // kind's own normalization, not just a subject mismatch, can fail. The
      // step still needs a widget, so it falls back the same way the gated
      // kinds do above.
      return {
        widget: await generateSwiperFlashcard(context),
        note: [note, result.note].filter(Boolean).join(' '),
      };
    }
  }
}

/**
 * `streamPathway` runs every step's widget concurrently via `Promise.race`,
 * which means one rejection ends the whole run even when the other widgets
 * already succeeded — a single model response that fails schema validation
 * would otherwise take four good widgets down with it. One retry absorbs
 * that: model non-compliance on structured output is usually transient, not
 * systematic, so trying again is more useful here than surfacing the failure.
 */
async function generateStepWidget(
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
  const planStream = planPathway(topic, anchor, proposal.gradeBand, profile);
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
