import { streamText, Output } from 'ai';
import type { FlexibleSchema } from 'ai';
import { z } from 'zod';

import { pathwayModel, scoringModel } from '@/lib/model';
import {
  findLearningComponents,
  findProgression,
  findStandardStatement,
  type StandardStatement,
} from '@/lib/learning-commons/client';
import type { Anchor, DeepPartial, PathwayEvent } from '@/lib/pathway/events';
import type { StudentProfile } from '@/lib/student/schema';
import {
  COVERAGE_SENTENCE,
  FRACTION_CODE,
  READING_EVIDENCE_CODE,
  WRITING_CODE,
  hasContentGeneratorFor,
} from '@/lib/pathway/coverage';
import { layoutCrossword, sanitizeAnswer } from '@/lib/pathway/crossword';
import {
  crosswordSpec,
  dragCategorizeSpec,
  dragSortSpec,
  draftMeterSpec,
  fractionAreaModelSpec,
  pathwayPlan,
  standardProposal,
  swiperFlashcardSpec,
  type CrosswordSpec,
  type DragCategorizeSpec,
  type DragSortSpec,
  type DraftMeterSpec,
  type FractionAreaModelSpec,
  type PathwayPlan,
  type SwiperFlashcardSpec,
  type WidgetSpec,
} from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';

export type { Anchor };

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
    // Resolved here rather than at module scope: `pathwayModel()` throws when
    // its provider env vars are missing, and at import time that fails the
    // whole module instead of the request that needed a model. It memoises.
    model: pathwayModel(),
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
 * A crossword is only a crossword if the words interlock. The model authors
 * terms, `layoutCrossword` decides which of them earn a square, and anything
 * that cannot cross what is already on the grid is dropped here rather than
 * shipped as a clue pointing at nothing.
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
 * Card counts are asked for in prose, so trim rather than fail. A deck of one
 * or two is not worth rendering — below that floor the widget is dropped and
 * the student keeps the rest of the pathway.
 */
const MIN_FLASHCARDS = 3;
const MAX_FLASHCARDS = 8;

function normalizeFlashcards(spec: SwiperFlashcardSpec): {
  widget: SwiperFlashcardSpec | null;
  note: string | null;
} {
  // A card whose two affordances read the same gives the student nothing to
  // decide between, so it is dropped rather than shown as an unanswerable swipe.
  const cards = spec.cards
    .filter((card) => card.question.trim() && card.upLabel.trim() !== card.downLabel.trim())
    .slice(0, MAX_FLASHCARDS);

  if (cards.length < MIN_FLASHCARDS) {
    return {
      widget: null,
      note: `Only ${cards.length} usable flashcard${cards.length === 1 ? '' : 's'} were generated — too few for a deck, so none is shown.`,
    };
  }

  return { widget: { ...spec, cards }, note: null };
}

/**
 * `DragSort` decides correctness by comparing the student's item order against
 * `correctOrder` position for position, so the two lists have to describe the
 * same set. Rather than invent an order for an item the model left out of
 * `correctOrder` — which would assert a sequence nobody authored — the
 * mismatch is resolved by keeping only the items that appear in both.
 */
const MIN_DRAG_SORT_ITEMS = 4;
const MAX_DRAG_SORT_ITEMS = 8;

function normalizeDragSort(spec: DragSortSpec): { widget: DragSortSpec | null; note: string | null } {
  const byId = new Map<string, DragSortSpec['items'][number]>();
  for (const item of spec.items) {
    if (item.id.trim() && !byId.has(item.id)) byId.set(item.id, item);
  }

  // The authored sequence is the source of truth for order; items are then
  // re-derived from it so the two lists agree by construction.
  const order: string[] = [];
  const seen = new Set<string>();
  for (const id of spec.correctOrder) {
    if (byId.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }

  const kept = order.slice(0, MAX_DRAG_SORT_ITEMS);

  if (kept.length < MIN_DRAG_SORT_ITEMS) {
    return {
      widget: null,
      note: `The generated ordering activity had only ${kept.length} item${kept.length === 1 ? '' : 's'} with a definite position, so it is not shown.`,
    };
  }

  return {
    widget: {
      ...spec,
      items: kept.map((id) => byId.get(id)!),
      correctOrder: kept,
    },
    note: null,
  };
}

/**
 * `DragCategorize` marks an item correct when its resting column matches
 * `categoryId`, so an item pointing at a column that was never authored can
 * never be placed correctly. Those items are dropped, then any column left
 * holding nothing goes with them.
 */
const MIN_DRAG_CATEGORIZE_ITEMS = 4;
const MAX_DRAG_CATEGORIZE_ITEMS = 10;
const MAX_DRAG_CATEGORIZE_CATEGORIES = 4;

function normalizeDragCategorize(spec: DragCategorizeSpec): {
  widget: DragCategorizeSpec | null;
  note: string | null;
} {
  const categories = spec.categories
    .filter((category, index, all) => category.id.trim() && all.findIndex((c) => c.id === category.id) === index)
    .slice(0, MAX_DRAG_CATEGORIZE_CATEGORIES);

  const categoryIds = new Set(categories.map((category) => category.id));
  const items = spec.items
    .filter((item, index, all) => item.id.trim() && all.findIndex((i) => i.id === item.id) === index)
    .filter((item) => categoryIds.has(item.categoryId))
    .slice(0, MAX_DRAG_CATEGORIZE_ITEMS);

  // A column with nothing in it is a distractor the student can never satisfy,
  // and with fewer than two columns there is no sorting decision left to make.
  const used = new Set(items.map((item) => item.categoryId));
  const keptCategories = categories.filter((category) => used.has(category.id));

  if (keptCategories.length < 2 || items.length < MIN_DRAG_CATEGORIZE_ITEMS) {
    return {
      widget: null,
      note: `The generated sorting activity did not resolve into at least two filled categories, so it is not shown.`,
    };
  }

  return { widget: { ...spec, categories: keptCategories, items }, note: null };
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

/**
 * The crossword: a vocabulary puzzle from the standard's own language.
 *
 * Every standard has vocabulary, so unlike the generators above this one has no
 * gate. The anchor standard and the pathway's outcomes supply the terms the
 * lesson is actually about; the prerequisite standards supply the shorter,
 * already-learned words that give the grid something to interlock with — recall
 * of prior knowledge doing double duty as puzzle scaffolding.
 */
async function generateCrossword(
  anchor: Anchor,
  plan: PathwayPlan,
): Promise<{ widget: CrosswordSpec | null; note: string | null }> {
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
      `Big idea of the lesson: ${plan.bigIdea}`,
      '',
      `Anchor standard ${anchor.standard.statementCode} (${anchor.standard.academicSubject}, grade ${anchor.standard.gradeLevels.join('/')}):`,
      anchor.standard.description,
      '',
      'Learning components:',
      componentBlockFor(anchor),
      '',
      'Learning outcomes this puzzle consolidates:',
      plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
      '',
      'Prerequisite standards (source of the supporting terms):',
      prerequisiteBlock,
      '',
      'Misconceptions the clues should not reinforce:',
      plan.misconceptions.map((m) => `- ${m}`).join('\n'),
      '',
      `Grade band: ${plan.gradeBand}. Write the puzzle for the "practice" step of this pathway.`,
    ].join('\n'),
  });

  return normalizeCrossword(spec);
}

/**
 * A recall check that needs nothing from the subject but its own language, so
 * it runs for every standard — the same reasoning that makes the crossword
 * unconditional. Where the crossword consolidates vocabulary, this one puts a
 * claim in front of the student and asks them to judge it, which is what makes
 * it the widget that surfaces misconceptions rather than gaps in wording.
 */
async function generateSwiperFlashcards(
  anchor: Anchor,
  plan: PathwayPlan,
): Promise<{ widget: WidgetSpec | null; note: string | null }> {
  const spec = await generateStructured({
    schema: swiperFlashcardSpec,
    system: [
      'You write a deck of swipeable judgement cards. Each card states one claim about the',
      'standard, and the student swipes to accept or reject it.',
      'Write 6 cards. Roughly half should be true, in no fixed pattern, so the deck cannot be',
      'passed by alternating.',
      'Every false card must be a claim a student who holds one of the listed misconceptions',
      'would actually accept — not an obvious absurdity, and never a trick of wording.',
      'The up and down labels are the two judgements themselves, phrased for the content',
      '(for example "Always true" and "Not always"), never the literal words "up" and "down".',
      'The explanation says why in one sentence a student at this grade band would follow, and',
      'names the misconception when the card was built from one.',
    ].join(' '),
    prompt: [
      `Standard ${anchor.standard.statementCode} (${anchor.standard.academicSubject}, grade ${anchor.standard.gradeLevels.join('/')}):`,
      anchor.standard.description,
      '',
      'Learning components:',
      componentBlockFor(anchor),
      '',
      'Learning outcomes:',
      plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
      '',
      'Misconceptions the false cards should be built from:',
      plan.misconceptions.map((m) => `- ${m}`).join('\n'),
      '',
      `Grade band: ${plan.gradeBand}. Write the deck for the "check" step of this pathway.`,
      'Set learningComponentId to the id of the component the deck targets, or null if none fits.',
    ].join('\n'),
  });

  return normalizeFlashcards(spec);
}

async function generateDragSort(
  anchor: Anchor,
  plan: PathwayPlan,
): Promise<{ widget: WidgetSpec | null; note: string | null }> {
  const spec = await generateStructured({
    schema: dragSortSpec,
    system: [
      'You configure a drag-to-order activity: the student arranges chips into a single',
      'correct sequence.',
      'Give 5 items. The ordering must be genuinely determined by the content — a sequence of',
      'events, steps, magnitudes, or stages — never a matter of taste or style.',
      'Ids are short, stable, lowercase slugs. correctOrder lists every item id exactly once,',
      'in the correct order.',
      'Labels are self-contained: a student must be able to place a chip without having seen',
      'the others, so no label may refer to "the next one" or "the previous step".',
      'The hint names the misconception a wrong ordering reveals rather than giving the answer.',
    ].join(' '),
    prompt: [
      `Standard ${anchor.standard.statementCode} (${anchor.standard.academicSubject}, grade ${anchor.standard.gradeLevels.join('/')}):`,
      anchor.standard.description,
      '',
      'Learning components:',
      componentBlockFor(anchor),
      '',
      'Learning outcomes:',
      plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
      '',
      'Known misconceptions:',
      plan.misconceptions.map((m) => `- ${m}`).join('\n'),
      '',
      `Grade band: ${plan.gradeBand}. Build the ordering activity for the "practice" step of this pathway.`,
      'Set learningComponentId to the id of the component it targets, or null if none fits.',
    ].join('\n'),
  });

  return normalizeDragSort(spec);
}

async function generateDragCategorize(
  anchor: Anchor,
  plan: PathwayPlan,
): Promise<{ widget: WidgetSpec | null; note: string | null }> {
  const spec = await generateStructured({
    schema: dragCategorizeSpec,
    system: [
      'You configure a drag-to-sort activity: the student drops each chip into the column it',
      'belongs to.',
      'Give 3 categories and 6 items spread across them, with at least one item per category.',
      'Each item belongs in exactly one category, and categoryId must match one of the',
      'category ids you defined. Ids are short, stable, lowercase slugs.',
      'The categories are the distinction the standard actually turns on, and the items are',
      'chosen so that the borderline ones separate students who hold a listed misconception',
      'from students who do not.',
      'The hint names that misconception rather than giving the answer.',
    ].join(' '),
    prompt: [
      `Standard ${anchor.standard.statementCode} (${anchor.standard.academicSubject}, grade ${anchor.standard.gradeLevels.join('/')}):`,
      anchor.standard.description,
      '',
      'Learning components:',
      componentBlockFor(anchor),
      '',
      'Learning outcomes:',
      plan.outcomes.map((o, i) => `${i + 1}. ${o.statement}`).join('\n'),
      '',
      'Known misconceptions:',
      plan.misconceptions.map((m) => `- ${m}`).join('\n'),
      '',
      `Grade band: ${plan.gradeBand}. Build the sorting activity for the "practice" step of this pathway.`,
      'Set learningComponentId to the id of the component it targets, or null if none fits.',
    ].join('\n'),
  });

  return normalizeDragCategorize(spec);
}

const structuralChoice = z.object({
  kind: z
    .enum(['order', 'categorize', 'neither'])
    .describe('Which structure, if either, the content of this standard genuinely has'),
  reason: z.string().describe('One sentence naming the sequence or the categories, or why neither fits'),
});

/**
 * Which of the two structural manipulatives a standard can support is a fact
 * about its content, not its code, so there is no regex that answers it: some
 * science standards are sequences, some are taxonomies, and plenty are neither.
 * Asking is what stops a standard with no natural order from being handed a
 * shuffled list whose "correct" sequence is arbitrary.
 *
 * It reads only the anchor, which is what lets the caller start it against the
 * graph result and let it run underneath the plan rather than after it.
 *
 * A failure here is not worth failing the pathway over — the student still gets
 * the flashcards and the crossword — so it degrades to `neither`.
 */
async function chooseStructuralWidget(anchor: Anchor): Promise<'order' | 'categorize' | 'neither'> {
  try {
    const choice = await generateStructured({
      schema: structuralChoice,
      model: scoringModel(),
      temperature: 0,
      system: [
        'You decide which interactive structure a standard supports. Answer "order" only if its',
        'content has one genuinely correct sequence — events in time, steps that depend on each',
        'other, values that rank. Answer "categorize" only if it turns on a distinction with two',
        'or more clear groups that specific examples fall into.',
        'Most standards are neither, and "neither" is the right answer whenever the sequence',
        'would be a matter of preference or the categories would be invented for the exercise.',
        'Prefer "neither" when both would be a stretch.',
      ].join(' '),
      prompt: [
        `Standard ${anchor.standard.statementCode} (${anchor.standard.academicSubject}, grade ${anchor.standard.gradeLevels.join('/')}):`,
        anchor.standard.description,
        '',
        'Learning components:',
        componentBlockFor(anchor),
      ].join('\n'),
    });

    return choice.kind;
  } catch {
    return 'neither';
  }
}

/**
 * Every generator that can serve this standard, started at once.
 *
 * They are independent model calls, so the run takes as long as the slowest
 * rather than their sum. The returned promises stay in pathway order — the
 * content-specific manipulative first, then the structural one, then the
 * judgement deck and the vocabulary puzzle — so the caller can await them in
 * turn and emit each result as it lands.
 *
 * `structural` is passed in already running: it only needs the anchor, so the
 * caller starts it before the plan and it costs no wall time here.
 */
function startWidgetGenerators(
  anchor: Anchor,
  plan: PathwayPlan,
  structural: Promise<'order' | 'categorize' | 'neither'>,
): Promise<{ widget: WidgetSpec | null; note: string | null }>[] {
  const code = anchor.standard.statementCode;
  const running: Promise<{ widget: WidgetSpec | null; note: string | null }>[] = [];

  if (FRACTION_CODE.test(code)) {
    running.push(generateFractionAreaModel(anchor, plan).then((widget) => ({ widget, note: null })));
  }

  if (WRITING_CODE.test(code) || READING_EVIDENCE_CODE.test(code)) {
    running.push(generateDraftMeter(anchor, plan).then((widget) => ({ widget, note: null })));
  }

  running.push(
    structural.then((choice) => {
      if (choice === 'order') return generateDragSort(anchor, plan);
      if (choice === 'categorize') return generateDragCategorize(anchor, plan);
      return { widget: null, note: null };
    }),
  );

  running.push(generateSwiperFlashcards(anchor, plan));
  running.push(generateCrossword(anchor, plan));

  // Say so when nothing tied to this standard's content could be built, rather
  // than letting a standard we have no manipulative for look fully served. The
  // flashcards and crossword work from any standard's own language, so they are
  // not what this is measuring.
  if (!hasContentGeneratorFor(code)) {
    running.push(
      structural.then((choice) => ({
        widget: null,
        note:
          choice === 'neither'
            ? `No content-specific widget generator is registered for ${code} yet — generators so far cover ${COVERAGE_SENTENCE}, and this standard's content is neither a sequence nor a set of categories. The flashcards and crossword are built from this standard's own language, and the pathway above is fully grounded in the graph.`
            : null,
      })),
    );
  }

  return running;
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

  // Started here rather than with the other generators: it needs only the
  // anchor, so running it against the plan call takes it off the critical path.
  // Nothing awaits it until the plan lands, so a rejection cannot go unhandled.
  const structural = chooseStructuralWidget(anchor);

  const planStream = planPathway(topic, anchor, proposal.gradeBand, profile);
  let planResult = await planStream.next();

  while (!planResult.done) {
    yield { type: 'plan-partial', plan: planResult.value };
    planResult = await planStream.next();
  }

  const plan = planResult.value;
  yield { type: 'plan', plan };
  yield { type: 'stage', stage: 'plan', status: 'done', detail: `${plan.steps.length} steps` };

  yield { type: 'stage', stage: 'widget', status: 'active' };

  // All applicable generators run together, and each result is emitted the
  // moment it lands rather than when the slowest one does.
  let built = 0;
  for (const generator of startWidgetGenerators(anchor, plan, structural)) {
    const { widget, note } = await generator;
    // A generator that was offered and did not apply has nothing to report.
    if (!widget && !note) continue;
    if (widget) built += 1;
    yield { type: 'widget', widget, note };
  }

  yield {
    type: 'stage',
    stage: 'widget',
    status: built > 0 ? 'done' : 'skipped',
    detail: built > 0 ? `${built} widget${built === 1 ? '' : 's'}` : 'No generator produced one',
  };
  yield { type: 'done' };
}
