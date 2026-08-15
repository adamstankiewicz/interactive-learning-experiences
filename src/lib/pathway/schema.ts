import { z } from 'zod';

/**
 * The widget spec is the seam. A widget is data, not a React tree: the model
 * emits a spec, a registry renders it. Swapping the AI SDK for CopilotKit/AG-UI
 * later changes how specs arrive, not what they are.
 *
 * A note on bounds. Providers serialize these schemas to JSON Schema in strict
 * mode, which drops `minItems`/`maxItems`/`minimum`/`maximum` — the model never
 * sees them, so a hard `.max()` here fails validation on output the model was
 * never told to avoid. Counts and ranges therefore live in `.describe()`, where
 * the model does read them, and the bounds below stay permissive.
 * `normalize()` in `generate.ts` is what actually enforces them.
 */

export const fractionAreaModelSpec = z.object({
  kind: z.literal('fraction-area-model'),
  /** Learning component identifier this widget is bound to, when one exists. */
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('What the student is asked to build, e.g. "Build 3/4"'),
  representation: z.enum(['bar', 'circle']),
  denominator: z
    .number()
    .int()
    .positive()
    .describe('Number of equal parts the whole splits into. Use 2-12.'),
  numerator: z
    .number()
    .int()
    .positive()
    .describe('Target number of parts to select. Must be no greater than the denominator.'),
  denominatorChoices: z
    .array(z.number().int().positive())
    .describe(
      'Denominators the student may switch between, so partitioning is itself part of the work. Give 3-5 options, ascending, and include the target denominator among them.',
    ),
  successMessage: z.string(),
  hint: z.string().describe('Shown after an incorrect attempt; names the misconception'),
});

export type FractionAreaModelSpec = z.infer<typeof fractionAreaModelSpec>;

export const swiperFlashcardSpec = z.object({
  kind: z.literal('swiper-flashcard'),
  learningComponentId: z.string().nullable(),
  cards: z
    .array(
      z.object({
        question: z.string().describe('Text shown on the face of the card'),
        upLabel: z.string().describe('Label shown on the up-swipe affordance'),
        downLabel: z.string().describe('Label shown on the down-swipe affordance'),
        correctDirection: z.enum(['up', 'down']).describe('Which direction is the correct answer'),
        explanation: z.string().describe('Brief explanation shown after the student swipes'),
      }),
    )
    .describe('Give 4-8 cards.'),
});

export type SwiperFlashcardSpec = z.infer<typeof swiperFlashcardSpec>;

/**
 * Draft Meter: question, textbox, one line. The student writes; a live model
 * call moves the line.
 *
 * Note what is *not* here. There is no rubric, no per-dimension weighting, no
 * band copy — scoring lives entirely in `lib/draft-meter`, and this spec only
 * carries what makes one instance different from another. This is also the
 * first widget that keeps talking to the server after render, so it carries
 * the standard with it: it is the payload the scoring call is grounded in.
 */
export const draftMeterSpec = z.object({
  kind: z.literal('draft-meter'),
  learningComponentId: z.string().nullable(),
  question: z
    .string()
    .describe(
      'The prompt the student answers. One sentence, concrete, and it must invite a position plus a reason — e.g. "Should our school start at 8:45? Say what you think — and why."',
    ),
  placeholder: z.string().describe('Textbox placeholder. Short and inviting, under 60 characters.'),
  standardCode: z.string().describe('The anchor standard code, copied verbatim.'),
  standardDescription: z.string().describe('The anchor standard wording, copied verbatim.'),
  /**
   * The standard, translated. Shown behind a "?" so a student can find out what
   * they are actually being asked for — standards wording is written for adults
   * and is useless as an explanation to the person being measured by it.
   */
  standardForStudents: z
    .string()
    .describe(
      'The standard restated in one or two sentences a 13-year-old understands, addressed to them ("You take a side, then..."). No jargon, no standard code, no quoting the official wording.',
    ),
  /**
   * An optional source the student reads before answering.
   *
   * This is what makes reading standards reachable. Without it, "cite textual
   * evidence" has nothing to cite and the scorer has to take a claimed fact on
   * trust; with it, evidence is checkable against something on screen. Null for
   * writing standards, where the argument comes from the student's own head.
   */
  passage: z
    .object({
      source: z
        .string()
        .describe('Short attribution, e.g. "Frederick Douglass, 1852" or "School newspaper editorial"'),
      text: z
        .string()
        .describe(
          'The source itself, 40-120 words. Short enough to sit above a textbox and be re-read while writing.',
        ),
    })
    .nullable(),
  criteria: z
    .array(z.string())
    .describe(
      'Give 2-4 short phrases naming what a strong answer contains, drawn from the standard. These ground the scoring call and are never shown to the student.',
    ),
});

export type DraftMeterSpec = z.infer<typeof draftMeterSpec>;

export const dragSortSpec = z.object({
  kind: z.literal('drag-sort'),
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('Instruction shown above the list, e.g. "Order these events from earliest to latest."'),
  items: z
    .array(
      z.object({
        id: z.string().describe('Stable unique identifier for this item'),
        label: z.string().describe('Text shown on the draggable chip'),
      }),
    )
    .describe('Give 4-8 items. They will be shuffled before display.'),
  correctOrder: z
    .array(z.string())
    .describe('Item ids in the correct order, first to last.'),
  successMessage: z.string().describe('Shown when the student arranges all items correctly.'),
  hint: z.string().describe('Shown after a wrong submission; names the misconception or gives a nudge.'),
});

export type DragSortSpec = z.infer<typeof dragSortSpec>;

export const dragCategorizeSpec = z.object({
  kind: z.literal('drag-categorize'),
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('Instruction shown above the activity, e.g. "Sort each term into the correct era."'),
  categories: z
    .array(
      z.object({
        id: z.string().describe('Stable unique identifier for this category'),
        label: z.string().describe('Column heading shown to the student'),
      }),
    )
    .describe('Give 2-4 categories.'),
  items: z
    .array(
      z.object({
        id: z.string().describe('Stable unique identifier for this item'),
        label: z.string().describe('Text shown on the draggable chip'),
        categoryId: z.string().describe('id of the category this item belongs to'),
      }),
    )
    .describe('Give 4-10 items spread across the categories.'),
  successMessage: z.string().describe('Shown when all items are placed correctly.'),
  hint: z.string().describe('Shown after a wrong submission; names the misconception or gives a nudge.'),
});

export type DragCategorizeSpec = z.infer<typeof dragCategorizeSpec>;

export const markdownCardSpec = z.object({
  kind: z.literal('markdown-card'),
  learningComponentId: z.string().nullable(),
  title: z.string().describe('Short heading shown above the content, e.g. "Why fractions matter"'),
  body: z
    .string()
    .describe(
      'Markdown content for the student. Use headings, bold, bullet lists, and blockquotes freely. Aim for 80-200 words — enough to re-teach a concept without overwhelming. Address the student directly ("you", "your").',
    ),
  tip: z
    .string()
    .nullable()
    .describe(
      'Optional one-sentence callout shown in a highlighted box at the bottom, e.g. "Remember: the denominator tells you how many equal parts the whole is split into." Null to omit.',
    ),
});

export type MarkdownCardSpec = z.infer<typeof markdownCardSpec>;

const flashcardSide = z.object({
  text: z.string().nullable().describe('Plain text shown on this side. Null if unused.'),
  markdown: z.string().nullable().describe('Markdown content shown below text, if richer formatting is needed. Null if unused.'),
  imageUrl: z.string().nullable().describe('URL of an image shown on this side. Null if unused.'),
  imageAlt: z.string().nullable().describe('Alt text for the image. Required when imageUrl is set.'),
});

export const flashcardSpec = z.object({
  kind: z.literal('flashcard'),
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('Instruction shown above the deck, e.g. "Tap each card to reveal its definition."'),
  cards: z
    .array(
      z.object({
        id: z.string().describe('Stable unique identifier for this card'),
        front: flashcardSide.describe('What the student sees before flipping'),
        back: flashcardSide.describe('What is revealed after flipping'),
      }),
    )
    .describe('Give 3-8 cards. Each card needs at least one field on each side.'),
  successMessage: z.string().describe('Shown after the student works through all cards.'),
});

export type FlashcardSpec = z.infer<typeof flashcardSpec>;

const stepShape = z.object({
  id: z.string(),
  title: z.string().describe('Short label for this step, e.g. "Step 1: Isolate the variable"'),
  body: z.string().describe('Markdown explanation of this step. Be clear and direct. Avoid markdown headings — use bold instead.'),
  why: z.string().nullable().describe('Optional one-sentence callout explaining the reasoning behind this step. Null to omit.'),
});

export const stepRevealSpec = z.object({
  kind: z.literal('step-reveal'),
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('Framing sentence shown above the steps, e.g. "Let\'s walk through this together."'),
  steps: z.array(stepShape).describe('Give 3-6 steps.'),
});
export type StepRevealSpec = z.infer<typeof stepRevealSpec>;

export const narratedCardSpec = z.object({
  kind: z.literal('narrated-card'),
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('Framing sentence shown above the steps, e.g. "Listen along as we walk through this."'),
  steps: z.array(stepShape).describe('Give 3-6 steps. Keep body text concise — it will be read aloud sentence by sentence.'),
});
export type NarratedCardSpec = z.infer<typeof narratedCardSpec>;

export const crosswordEntrySpec = z.object({
  answer: z
    .string()
    .describe(
      'The term typed into the grid. One word, 3-12 letters, letters only — no spaces, hyphens, digits or punctuation. Case is ignored.',
    ),
  clue: z
    .string()
    .describe(
      'One student-facing line at the grade level of the standard. Never contains the answer or a word sharing its root.',
    ),
  source: z
    .enum(['anchor', 'prerequisite'])
    .describe(
      '"anchor" for vocabulary the anchor standard and its learning components carry; "prerequisite" for terms drawn from earlier standards.',
    ),
  sourceCode: z
    .string()
    .nullable()
    .describe('Statement code the term came from, e.g. "3.NF.A.1". Null for general academic vocabulary.'),
});

export type CrosswordEntrySpec = z.infer<typeof crosswordEntrySpec>;

/**
 * Terms and clues only. The grid itself is interlocked in code — see
 * `pathway/crossword.ts` — so nothing here can describe an impossible puzzle.
 */
export const crosswordSpec = z.object({
  kind: z.literal('crossword'),
  learningComponentId: z.string().nullable(),
  title: z.string().describe('Short heading, e.g. "Fraction vocabulary"'),
  prompt: z.string().describe('One line telling the student what to do'),
  entries: z
    .array(crosswordEntrySpec)
    .describe(
      'Give 12-16 terms, most central first. Vary the lengths and include at least four 3-5 letter terms: short words with common letters are what let the grid interlock. Terms that share letters with each other beat terms that do not.',
    ),
  successMessage: z.string(),
});

export type CrosswordSpec = z.infer<typeof crosswordSpec>;

export const timelineBuilderSpec = z.object({
  kind: z.literal('timeline-builder'),
  learningComponentId: z.string().nullable(),
  prompt: z.string().describe('Instruction shown above the timeline, e.g. "Place each event in the correct period."'),
  zones: z
    .array(
      z.object({
        id: z.string().describe('Stable unique identifier for this zone'),
        label: z.string().describe('Period or era label shown on the timeline, e.g. "1800s" or "Ancient Rome"'),
        sublabel: z.string().nullable().describe('Optional date range or subtitle shown below the label, e.g. "1800–1899". Null to omit.'),
      }),
    )
    .describe('Give 3-5 zones in chronological order, left to right.'),
  events: z
    .array(
      z.object({
        id: z.string().describe('Stable unique identifier for this event'),
        label: z.string().describe('Short event name shown on the draggable chip, e.g. "Moon landing"'),
        zoneId: z.string().describe('id of the zone this event belongs to'),
      }),
    )
    .describe('Give 4-10 events spread across the zones. They will be shuffled before display.'),
  successMessage: z.string().describe('Shown when all events are placed correctly.'),
  hint: z.string().describe('Shown after a wrong submission; names the misconception or gives a nudge.'),
});

export type TimelineBuilderSpec = z.infer<typeof timelineBuilderSpec>;

/** Discriminated union — add widget kinds here as generators are registered. */
export const widgetSpec = z.discriminatedUnion('kind', [
  fractionAreaModelSpec,
  swiperFlashcardSpec,
  draftMeterSpec,
  dragSortSpec,
  dragCategorizeSpec,
  markdownCardSpec,
  flashcardSpec,
  stepRevealSpec,
  narratedCardSpec,
  timelineBuilderSpec,
  crosswordSpec,
]);
export type WidgetSpec = z.infer<typeof widgetSpec>;

export const learningOutcome = z.object({
  statement: z.string().describe('Student-facing "I can..." statement'),
  /** Learning component identifier from the graph, or null when the standard has no decomposition. */
  learningComponentId: z.string().nullable(),
  evidence: z.string().describe('What a student does that shows they reached this outcome'),
});

/** The widget kinds the registry can render. Keep in step with `widgetSpec`. */
export const widgetKind = z.enum([
  'fraction-area-model',
  'swiper-flashcard',
  'draft-meter',
  'drag-sort',
  'drag-categorize',
  'crossword',
  'markdown-card',
  'flashcard',
  'step-reveal',
  'narrated-card',
  'timeline-builder',
]);
export type WidgetKind = z.infer<typeof widgetKind>;

export const pathwayStep = z.object({
  title: z.string(),
  purpose: z.enum(['activate', 'model', 'practice', 'check']),
  description: z.string(),
  outcomeIndex: z.number().int().describe('Zero-based index into outcomes[] this step advances'),
  /**
   * Composition happens here. Every step is something a student does, so every
   * step names which interaction does it; a second pass configures the chosen
   * widget with full context. That keeps the plan call cheap and lets each
   * widget be configured against the step it actually serves.
   */
  widgetKind: widgetKind.describe(
    [
      'Which interactive widget the student uses to do this step. Every step gets one — this is',
      'not supporting material, it is the task.',
      '"fraction-area-model" partitions a whole into equal parts to build a target fraction —',
      'only meaningful for fractions.',
      '"swiper-flashcard" is a binary sort of statements (true/false, example/non-example,',
      'prime/composite) and suits almost any subject, including an "activate" step sorting prior',
      'statements or a "check" step sorting worked answers.',
      '"drag-sort" orders items along one dimension — chronology, magnitude, steps in a process.',
      '"drag-categorize" sorts items into 2-4 named buckets — use this over swiper-flashcard when',
      'there are more than two groups, e.g. sorting terms by era or by part of speech.',
      '"draft-meter" is a short written-argument prompt, live-scored as the student types. Only for',
      'standards about writing an argument (W, WHST) or citing textual evidence (RL/RI/RH/RST',
      'strands 1 and 8) — it is meaningless for any other standard. It is also the heaviest',
      'interaction: use it for at most one step in a pathway, normally "practice" or "check".',
      '"crossword" is a vocabulary puzzle built from the standard\'s own terms — every standard has',
      'vocabulary, so this fits any subject. Best for a "check" step that consolidates the words the',
      'lesson taught, not for introducing a concept the student has not met yet.',
    ].join(' '),
  ),
});

/** What the model authors, given graph-verified facts. */
export const pathwayPlan = z.object({
  gradeBand: z.string(),
  bigIdea: z.string().describe('One sentence naming the concept in plain language'),
  outcomes: z.array(learningOutcome).describe('Give 2-4 outcomes.'),
  priorKnowledge: z
    .array(z.string())
    .describe('What students need coming in, drawn from the prerequisite standards. Give 2-4.'),
  misconceptions: z.array(z.string()).describe('Give 2-3 specific, diagnosable misconceptions.'),
  steps: z
    .array(pathwayStep)
    .describe('Give 4-5 steps running activate -> model -> practice -> check.'),
});

export type PathwayPlan = z.infer<typeof pathwayPlan>;

/** What the model proposes before the graph gets a vote. */
export const standardProposal = z.object({
  candidates: z
    .array(
      z.object({
        statementCode: z.string(),
        rationale: z.string(),
      }),
    )
    .describe('Give 2-4 candidate standards, ordered best-first.'),
  gradeBand: z.string(),
});

export type StandardProposal = z.infer<typeof standardProposal>;
