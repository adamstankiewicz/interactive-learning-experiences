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
        leftLabel: z.string().describe('Label shown on the left swipe affordance'),
        rightLabel: z.string().describe('Label shown on the right swipe affordance'),
        correctDirection: z.enum(['left', 'right']).describe('Which direction is the correct answer'),
        explanation: z.string().describe('Brief explanation shown after the student swipes'),
      }),
    )
    .describe('Give 4-8 cards.'),
});

export type SwiperFlashcardSpec = z.infer<typeof swiperFlashcardSpec>;

/** Discriminated union — add widget kinds here as generators are registered. */
export const widgetSpec = z.discriminatedUnion('kind', [
  fractionAreaModelSpec,
  swiperFlashcardSpec,
]);
export type WidgetSpec = z.infer<typeof widgetSpec>;

export const learningOutcome = z.object({
  statement: z.string().describe('Student-facing "I can..." statement'),
  /** Learning component identifier from the graph, or null when the standard has no decomposition. */
  learningComponentId: z.string().nullable(),
  evidence: z.string().describe('What a student does that shows they reached this outcome'),
});

export const pathwayStep = z.object({
  title: z.string(),
  purpose: z.enum(['activate', 'model', 'practice', 'check']),
  description: z.string(),
  outcomeIndex: z.number().int().describe('Zero-based index into outcomes[] this step advances'),
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
