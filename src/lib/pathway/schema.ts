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
  /**
   * What this particular meter looks for — the rubric as data.
   *
   * The scorer used to hard-code one trio: take a side, say why, cite
   * something. That is an argument rubric, and it fits an argument standard
   * and nothing else. "What does May value most in marriage, and what shows
   * it?" has no side to take, so a student who read the passage perfectly was
   * still measured against a question the standard never asked.
   *
   * Making the checks part of the spec turns one widget into the short-written-
   * response widget: the meter asks "did you do the things *this* standard
   * asks for", and the answer differs by standard. Comprehension wants
   * interpretation, textual support and accuracy; history wants a claim,
   * source evidence and context; science wants claim, evidence, reasoning.
   */
  checks: z
    .array(
      z.object({
        id: z
          .string()
          .describe('Short stable key, lowercase, one word, e.g. "claim", "evidence", "accuracy".'),
        label: z
          .string()
          .describe(
            'Student-facing noun phrase, 1-4 words, that reads inside a sentence: "a claim", "evidence from the source", "context". It is shown when the student finishes, as "That\'s all three — a claim, evidence from the source, and context."',
          ),
        lookFor: z
          .string()
          .describe('One sentence telling the scorer what counts as meeting this check.'),
        essential: z
          .boolean()
          .describe(
            'True only when getting this wrong invalidates the response however well written — reading the passage correctly, for instance. At most one check is essential, and for a pure opinion prompt none are.',
          ),
      }),
    )
    .describe(
      'Give exactly 3 checks: the three things this standard actually asks a short written response to do. Order them the way a student builds an answer.',
    ),
});

export type DraftMeterSpec = z.infer<typeof draftMeterSpec>;

/**
 * Defend a Claim: a contestable historical claim, two sources, and a defense
 * the student revises against feedback they asked for.
 *
 * The near neighbour is Draft Meter, and the difference between them is the
 * whole point of having both. Draft Meter scores continuously and silently —
 * the line moves while you type, and you never ask it anything. This one never
 * scores unprompted: the student writes, decides they are ready, and requests a
 * reading. That request is the pedagogy. History argument at this level is
 * about holding a position under objection, and an objection you did not invite
 * is an interruption; one you asked for is a rebuttal you have to answer.
 *
 * Hence the two things this spec carries that Draft Meter's does not: a
 * `stance` the student commits to before writing (so the feedback can catch a
 * paragraph arguing against the box its author ticked), and `sources` that make
 * "evidence" mean a specific document rather than anything true the student
 * happens to know.
 */
export const defendClaimSpec = z.object({
  kind: z.literal('defend-claim'),
  learningComponentId: z.string().nullable(),
  era: z
    .string()
    .describe(
      'The period or episode this claim sits in, 1-3 words, shown as a small label — e.g. "Reconstruction", "The New Deal", "Partition of India".',
    ),
  claim: z
    .string()
    .describe(
      [
        'The claim the student agrees or disagrees with. One sentence, and it must be genuinely',
        'contestable by a well-informed person — an interpretive judgement about cause, significance',
        'or responsibility, never a fact with a settled answer. A claim a student can look up is not',
        'a claim they can defend. Write it as an assertion, not a question.',
      ].join(' '),
    ),
  context: z
    .string()
    .describe(
      'One sentence of neutral, uncontested factual grounding — dates, who did what — so a student who is hazy on the period can still engage the argument. State facts only; take no side.',
    ),
  sources: z
    .array(
      z.object({
        attribution: z
          .string()
          .describe('Short attribution, e.g. "Frederick Douglass, speech, 1875" or "Northern newspaper editorial, 1874".'),
        text: z
          .string()
          .describe('The excerpt itself, 25-60 words, in period-appropriate voice and readable by a 7th grader.'),
      }),
    )
    .describe(
      [
        'Give exactly 2 excerpts that pull in different directions, so citing one is a choice the',
        'student has to justify rather than the only move available. Together they must make both',
        'sides of the claim defensible — if both support the same side, the disagree option is a trap.',
      ].join(' '),
    ),
  placeholder: z.string().describe('Textarea placeholder. Short and inviting, under 60 characters.'),
  /**
   * The pre-submission checklist, and the model's per-criterion verdict, are
   * the same three keys by construction.
   *
   * This started as a free-text `string[]` the model wrote, alongside a
   * separate booleans object — which is the exact trap `draft-meter/schema.ts`
   * documents for score/band/label: two independently authored things that
   * describe the same judgement will eventually disagree, and there is no
   * sane way to reconcile "a reason that supports it" with a fourth boolean at
   * render time. Fixing the keys means the ticks cannot drift from the list,
   * while the wording still gets to name *this* claim's sources.
   */
  checklist: z
    .object({
      position: z.string().describe('e.g. "A clear position on the claim" — under 45 characters.'),
      reasoning: z.string().describe('e.g. "A reason that supports it" — under 45 characters.'),
      evidence: z
        .string()
        .describe('Names the supplied sources, e.g. "A quote from Douglass or the editorial" — under 45 characters.'),
    })
    .describe('Shown before submitting, and ticked off one-to-one by the feedback call.'),
  standardCode: z.string().describe('The anchor standard code, copied verbatim.'),
  standardDescription: z.string().describe('The anchor standard wording, copied verbatim.'),
  standardForStudents: z
    .string()
    .describe(
      'The standard restated in one or two sentences a 13-year-old understands, addressed to them ("You take a side, then..."). No jargon, no standard code, no quoting the official wording.',
    ),
  criteria: z
    .array(z.string())
    .describe(
      'Give 2-4 short phrases naming what a strong defense of this particular claim contains. These ground the feedback call and are never shown to the student.',
    ),
});

export type DefendClaimSpec = z.infer<typeof defendClaimSpec>;

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
/**
 * Find the Flaw: a worked example with one deliberate mistake in it.
 *
 * Every other widget asks a student to produce a correct answer or arrange
 * given pieces. This one hands them finished work and asks them to judge it —
 * a different act, and the one the catalogue could not previously ask for.
 * Evaluating flawed reasoning is where misconceptions surface, because a
 * student who cannot spot the error usually holds it.
 *
 * Two stages, both checked locally so there is no model call in the loop:
 * *where* it goes wrong, then *why*. The second stage is what stops it being
 * a one-in-five guess, and it is where the actual diagnosis happens.
 */
export const findTheFlawSpec = z.object({
  kind: z.literal('find-the-flaw'),
  learningComponentId: z.string().nullable(),
  prompt: z
    .string()
    .describe(
      'Instruction shown above the work, e.g. "This solution has one mistake. Find the step where it goes wrong."',
    ),
  /** What the student is looking at, so the steps have something to be about. */
  scenario: z
    .object({
      title: z.string().describe('Short label for the work, e.g. "Maya\'s solution" or "A student\'s experiment".'),
      setup: z
        .string()
        .describe(
          'One or two sentences establishing the task the work was attempting — the problem posed, the question investigated, the claim argued.',
        ),
    })
    .describe('The worked example being judged.'),
  steps: z
    .array(
      z.object({
        id: z.string().describe('Short stable lowercase slug.'),
        label: z
          .string()
          .describe(
            'One step of the work, stated as the worker did it. Self-contained — never "then do the next part".',
          ),
      }),
    )
    .describe('Give 4-6 steps in order. Exactly one contains the mistake; every other step is genuinely correct.'),
  flawedStepId: z.string().describe('The id of the one step that contains the mistake.'),
  /**
   * Stage two: having found *where*, name *what*. The wrong options are the
   * misdiagnoses a student plausibly makes, which is what makes this worth
   * asking — a distractor nobody would pick teaches nothing.
   */
  whyOptions: z
    .array(
      z.object({
        id: z.string().describe('Short stable lowercase slug.'),
        label: z.string().describe('One sentence naming what is wrong with that step.'),
        correct: z.boolean().describe('True for exactly one option.'),
      }),
    )
    .describe('Give 3-4 options, exactly one correct. The wrong ones are plausible misdiagnoses, not filler.'),
  explanation: z
    .string()
    .describe('Shown once the student has it right: what the mistake actually is and what should have happened.'),
  hint: z
    .string()
    .describe('Shown after a wrong attempt. Points at what to re-check without naming the step or the answer.'),
});

export type FindTheFlawSpec = z.infer<typeof findTheFlawSpec>;

/**
 * Draw the Curve: shape a line by dragging its points, then see the real one.
 *
 * The generalisation that gets this out of maths is dropping exact values. The
 * x positions are fixed and labelled, the student only sets heights, and the
 * check is on *shape* — does the line rise where it should rise, peak where it
 * should peak. For a story's tension curve an exact number is meaningless and
 * "the peak is at the climax, not the opening" is the entire point; the same
 * check does honest work for a distance-time graph or a population trend.
 *
 * Predict first, then reveal. The student commits a shape before the real
 * curve is drawn over the top, which is where the learning actually happens —
 * seeing your own wrong intuition next to the right answer beats being shown
 * the right answer cold.
 */
export const drawTheCurveSpec = z.object({
  kind: z.literal('draw-the-curve'),
  learningComponentId: z.string().nullable(),
  prompt: z
    .string()
    .describe(
      'Instruction shown above the chart, e.g. "Drag each point to show how the tension changes across the story."',
    ),
  /**
   * The situation being graphed.
   *
   * Without this the task is unanswerable for anything but a conventional
   * shape: "show how far Ana is from home during her walk" cannot be predicted
   * unless the walk is described, and a student who misses the five minutes she
   * spent in the shop was never told about them. The setup has to carry every
   * fact the shape depends on, while stopping short of naming the shape.
   */
  setup: z
    .string()
    .describe(
      'One to three sentences describing what happens, in enough detail that the shape can be worked out — every event that changes the line must be mentioned. Never describe the line itself ("it rises then flattens"); describe the situation and let the student infer the shape.',
    ),
  xAxis: z
    .object({
      label: z.string().describe('What the horizontal axis runs over, e.g. "Stage of the story", "Time".'),
      points: z
        .array(
          z.object({
            id: z.string().describe('Short stable lowercase slug.'),
            label: z
              .string()
              .describe('Short label under this position, 1-3 words, e.g. "Climax", "1850", "10 min".'),
          }),
        )
        .describe('Give 4-7 positions in order, left to right. Short labels — they sit under the axis.'),
    })
    .describe('The fixed horizontal positions. The student sets heights, never x.'),
  yAxis: z
    .object({
      label: z.string().describe('What the vertical axis measures, e.g. "Tension", "Distance from home".'),
      lowLabel: z.string().describe('Two or three words for the bottom of the scale, e.g. "calm", "close".'),
      highLabel: z.string().describe('Two or three words for the top, e.g. "intense", "far away".'),
    })
    .describe('The vertical scale, described in words rather than numbers — no units are ever shown.'),
  /**
   * The real curve, revealed after the student commits. Its *shape* is also
   * what the answer is checked against: segment by segment, does the student's
   * line go the same direction? Absolute heights are never compared, so a
   * student who draws the right shape too low still gets it right.
   */
  actual: z
    .array(
      z.object({
        pointId: z.string().describe('Must match one of the xAxis point ids.'),
        value: z.number().describe('0-100, where 0 is the bottom of the chart and 100 the top.'),
      }),
    )
    .describe('One entry per x position, in the same order. This is the correct curve.'),
  reveal: z
    .string()
    .describe(
      'Shown with the real curve once the student commits: what the true shape is and why it goes that way. Two or three sentences.',
    ),
  hint: z
    .string()
    .describe('Shown after a wrong shape. Points at what to reconsider without describing the curve.'),
});

export type DrawTheCurveSpec = z.infer<typeof drawTheCurveSpec>;

/**
 * Debate an AI: the assistant argues a position and will not simply fold.
 *
 * Aimed at Bloom's *evaluate*, which is why the thing being credited is not
 * winning. A student who says "you're wrong, everyone knows that" has disagreed
 * without evaluating anything; a student who says "your study was of adults, so
 * it doesn't support a claim about students" has judged the argument on its
 * merits, which is the level. So the widget tracks evaluative *moves* —
 * challenging evidence, spotting an unsupported leap, conceding a fair point —
 * rather than counting turns or declaring a winner.
 *
 * Distinct from defend-claim, which is a single written defense of the
 * student's own position against fixed sources. Here the opposition answers
 * back and adapts, and the student is judging someone else's reasoning as it
 * arrives.
 */
export const debateAiSpec = z.object({
  kind: z.literal('debate-ai'),
  learningComponentId: z.string().nullable(),
  prompt: z
    .string()
    .describe(
      'One line above the exchange, addressed to the student. It should frame this as a debate they are taking part in, e.g. "Pick a side. I\'ll argue the other one — and I won\'t make it easy."',
    ),
  motion: z.string().describe('The contestable claim under debate, stated in one sentence.'),
  /**
   * Both sides, as first-class things.
   *
   * The student picks one and the assistant takes the other, which is what
   * makes this a debate rather than a critique exercise. An earlier version
   * fixed the assistant's position and asked the student to "test my argument"
   * — that is a worthwhile task, but it is not debating: nobody is arguing
   * *for* anything, and the student never has to build a case they own.
   *
   * Each side carries its own opening, so the exchange can start the moment a
   * side is chosen rather than spending a model call working out how to begin.
   */
  sides: z
    .array(
      z.object({
        id: z.string().describe('Short stable lowercase key, e.g. "for", "against".'),
        label: z.string().describe('Short name for this side, 2-6 words, as it appears on the button.'),
        summary: z
          .string()
          .describe('One sentence putting the strongest version of this side, so a student can choose knowingly.'),
        opening: z
          .string()
          .describe(
            'The message the assistant sends when it holds THIS side: states the position and gives one supporting reason. Two or three sentences, conversational.',
          ),
      }),
    )
    .describe(
      'Give exactly 2 sides, both genuinely arguable. If one is obviously right the debate is a formality and the student learns to recite rather than argue.',
    ),
  /**
   * How the assistant argues — deliberately separate from *what* it argues,
   * because it could end up on either side. An opponent that argues flawlessly
   * gives a student nothing to work with, and one that argues stupidly makes
   * winning meaningless. Plausible but findably flawed is the target.
   */
  aiPersona: z
    .string()
    .describe(
      'How the assistant argues whichever side it ends up on, including the specific weaknesses a student could find: e.g. "Confident and friendly. Cites real statistics but sometimes ones that do not quite fit the claim, and occasionally treats a correlation as a cause."',
    ),
  /**
   * What counts as arguing well — the rubric, as data, in the same spirit as
   * draft-meter's checks.
   *
   * Nobody declares a winner, and that is deliberate. Debates are not won on
   * points by a judge in the corner, and a widget that announced one would
   * teach students to play to it. What it tracks instead is whether the student
   * argued like someone evaluating: challenged the evidence rather than the
   * person, caught a leap, granted a fair point. Written in the student's own
   * language because they are shown before the debate starts.
   */
  moves: z
    .array(
      z.object({
        id: z.string().describe('Short stable lowercase key, e.g. "evidence", "leap", "concede".'),
        label: z
          .string()
          .describe('Student-facing name, 2-4 words: "Challenged the evidence", "Spotted a leap".'),
        lookFor: z
          .string()
          .describe('One sentence telling the judge what counts as making this move.'),
      }),
    )
    .describe(
      'Give 3-4 moves. At least one must be a concession move — recognising a fair point is an evaluative act, and a debate where conceding is never credited teaches students to never concede.',
    ),
  turnLimit: z
    .number()
    .describe('How many student replies the exchange runs for. Use 4-6.'),
});

export type DebateAiSpec = z.infer<typeof debateAiSpec>;

/**
 * Writing Workshop: long-form writing, marked up when the student asks.
 *
 * The opposite tuning to draft-meter, deliberately. That widget scores three
 * sentences live, because a short answer is a thing you fiddle with. This one
 * is for work with a shape — an essay, a lab write-up, a research proposal, a
 * short story — where live feedback would be a hand on your shoulder while you
 * think. Nothing happens until the student presses the button.
 *
 * And the feedback lands *on the writing* rather than beside it: passages are
 * underlined where they work and where they don't, each with a note. A general
 * verdict on a thousand words tells a student nothing they can act on; "this
 * sentence is where your argument actually turns" tells them where to look.
 */
export const writingWorkshopSpec = z.object({
  kind: z.literal('writing-workshop'),
  learningComponentId: z.string().nullable(),
  prompt: z
    .string()
    .describe('One line above the editor, e.g. "Write your lab report. Ask for a read whenever you want one."'),
  brief: z
    .object({
      title: z.string().describe('Short name for the piece, e.g. "Argument essay: school start times".'),
      task: z
        .string()
        .describe(
          'What the student is being asked to write, in two to four sentences. Concrete enough to start from — the question, the audience, and roughly how long.',
        ),
    })
    .describe('The assignment.'),
  /**
   * What kind of writing this is. Carried into the review prompt because the
   * same sentence is a strength in a short story and a weakness in a lab
   * report — a reviewer that does not know which one it is reading defaults to
   * scoring everything as an essay.
   */
  genre: z
    .string()
    .describe(
      'The form, in a few words: "argument essay", "lab report", "research proposal", "short story", "historical explanation".',
    ),
  placeholder: z.string().describe('Editor placeholder. One short inviting line.'),
  targetWords: z
    .number()
    .describe('Roughly how long the piece should be. Guidance shown to the student, never enforced. Use 150-600.'),
  /**
   * The dimensions the reviewer marks against — the rubric as data, so one
   * component reviews a lab report and a short story without either being
   * judged by the other one's standards.
   */
  lookFor: z
    .array(
      z.object({
        id: z.string().describe('Short stable lowercase key.'),
        label: z.string().describe('Student-facing name, 2-4 words: "Evidence", "Method", "Voice".'),
        lookFor: z
          .string()
          .describe('One sentence telling the reviewer what a strong and a weak version of this looks like in this genre.'),
      }),
    )
    .describe('Give 3-4 dimensions drawn from the standard and the genre.'),
});

export type WritingWorkshopSpec = z.infer<typeof writingWorkshopSpec>;

// --- composed: an activity assembled from pedagogical primitives ---------

/**
 * The composed kind is the registry's generative escape hatch: instead of one
 * fixed interaction, the model emits a flat tree of *pedagogical primitives*
 * (issue #100 holds the vocabulary and its learning-science grounding) and
 * human-written renderers draw it. Invariant 1 holds — this is data, validated
 * here, never code. The v1 alphabet is deliberately verdict-free: nothing in
 * it can measure, so a composed activity's `assesses` is false by
 * construction (derived from the alphabet, not asserted). Verdict-carrying
 * primitives (Check/Response) join only with the #99 evidence contract.
 *
 * Components reference each other by id in a flat list — the same shape A2UI
 * surfaces use, so compositions project to the a2learn catalog verbatim.
 */

const composedChildId = z.string().describe('The id of another component in this composition.');

const composedText = z.object({
  type: z.literal('Text'),
  id: z.string(),
  text: z.string().describe('Markdown body text. Bold key terms; no headings, links, or images.'),
  variant: z
    .enum(['body', 'caption'])
    .nullable()
    .describe('"caption" renders small and muted; null means body.'),
});

const composedCallout = z.object({
  type: z.literal('Callout'),
  id: z.string(),
  intent: z
    .enum(['why', 'tip', 'note'])
    .describe('"why" for reasoning behind an idea (elaborative), "tip" for strategy advice, "note" for anything else.'),
  label: z.string().describe('Short bold lead-in, e.g. "Why?" or "Tip:".'),
  text: z.string().describe('One or two sentences of markdown.'),
});

const composedGroup = z.object({
  type: z.literal('Group'),
  id: z.string(),
  children: z.array(composedChildId).describe('2–6 child ids, rendered top to bottom.'),
});

const composedReveal = z.object({
  type: z.literal('Reveal'),
  id: z.string(),
  faces: z
    .array(z.object({ title: z.string(), child: composedChildId }))
    .describe('Exactly 2 faces: front first, back second. The student taps to turn it over — put the prompt on the front and the payoff on the back.'),
});

const composedSequence = z.object({
  type: z.literal('Sequence'),
  id: z.string(),
  policy: z.object({
    order: z.enum(['linear', 'free']).describe('"linear" when items build on each other; "free" when they can be browsed.'),
    disclosure: z.enum(['gated', 'all']).describe('"gated" holds each item back until the student advances — use for walkthroughs.'),
    revealed: z.enum(['accumulate', 'replace']).describe('"accumulate" keeps passed items visible (worked examples); "replace" shows one at a time (decks).'),
  }),
  children: z.array(composedChildId).describe('2–8 item ids, in teaching order.'),
});

const composedCheck = z.object({
  type: z.literal('Check'),
  id: z.string(),
  prompt: z.string().describe('The question, in markdown. One concrete thing to retrieve or apply.'),
  options: z
    .array(
      z.object({
        text: z.string().describe('The option as the student sees it.'),
        feedback: z
          .string()
          .describe('Shown immediately when this option is picked — why it is or is not the one, one sentence.'),
      }),
    )
    .describe('2-4 options, exactly one of them right.'),
  answer: z.number().int().describe('Zero-based index of the right option.'),
});

/**
 * Check is deliberately *local*: feedback renders in the widget and nothing
 * leaves it — no verdict, no event, no evidence. It exists because retrieval
 * beats rereading (the learner checks themself), not because anyone is
 * measured; `assesses` on a composed activity stays false with Check in the
 * alphabet. An answer that should count as evidence is the Response
 * primitive, which waits for the #99 contract.
 */

const composedMatch = z.object({
  type: z.literal('Match'),
  id: z.string(),
  prompt: z.string().describe('What matching means here, e.g. "Match each term to its meaning."'),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .describe('2-6 pairs. Left items show in order; right items are shuffled by the renderer.'),
});

const composedHunt = z.object({
  type: z.literal('Hunt'),
  id: z.string(),
  prompt: z.string().describe('What to find, e.g. "Tap every fraction equivalent to 1/2."'),
  items: z
    .array(
      z.object({
        text: z.string(),
        target: z.boolean().describe('True if this is one of the things to find.'),
        feedback: z.string().describe('Shown when tapped — why it is or is not one, one sentence.'),
      }),
    )
    .describe('4-9 items, mixing targets and near-miss decoys. At least one of each.'),
});

/**
 * Match and Hunt are the stateful tier of the local alphabet: real game
 * mechanics (selection state, progress, lockout on success) implemented
 * entirely renderer-side. Like Check, nothing leaves the component — they
 * exist for retrieval and discrimination practice, not measurement, and a
 * composed activity's `assesses` stays false with them in play.
 */

const composedComponent = z.discriminatedUnion('type', [
  composedText,
  composedCheck,
  composedMatch,
  composedHunt,
  composedCallout,
  composedGroup,
  composedReveal,
  composedSequence,
]);
export type ComposedComponent = z.infer<typeof composedComponent>;

export const composedSpec = z.object({
  kind: z.literal('composed'),
  learningComponentId: z.string().nullable(),
  title: z.string().describe('Short student-facing activity title.'),
  components: z
    .array(composedComponent)
    .describe('Flat component list. Exactly one component must have id "root" — usually a Group or Sequence that references the rest. 3–20 components.'),
});
export type ComposedSpec = z.infer<typeof composedSpec>;

/**
 * Structural rules the union cannot express (discriminated-union members must
 * stay plain objects, and providers never see refinements anyway). The
 * generator runs this before accepting a composition; the registry entry's
 * schema runs it again at render time.
 */
export function compositionProblems(spec: ComposedSpec): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of spec.components) {
    if (ids.has(c.id)) problems.push(`duplicate component id: ${c.id}`);
    ids.add(c.id);
  }
  if (!ids.has('root')) problems.push('no component with id "root"');

  const childRefs = (c: ComposedComponent): string[] =>
    c.type === 'Group' || c.type === 'Sequence'
      ? c.children
      : c.type === 'Reveal'
        ? c.faces.map((f) => f.child)
        : [];

  for (const c of spec.components) {
    for (const ref of childRefs(c)) {
      if (!ids.has(ref)) problems.push(`${c.id} references missing component: ${ref}`);
      if (ref === c.id) problems.push(`${c.id} references itself`);
    }
  }
  if (spec.components.some((c) => c.type === 'Reveal' && c.faces.length !== 2)) {
    problems.push('a Reveal must have exactly 2 faces');
  }
  for (const c of spec.components) {
    if (c.type === 'Check' && (c.options.length < 2 || c.answer < 0 || c.answer >= c.options.length)) {
      problems.push(`${c.id}: a Check needs 2+ options and an answer index inside them`);
    }
    if (c.type === 'Match' && c.pairs.length < 2) {
      problems.push(`${c.id}: a Match needs 2+ pairs`);
    }
    if (
      c.type === 'Hunt' &&
      (c.items.length < 3 || !c.items.some((i) => i.target) || !c.items.some((i) => !i.target))
    ) {
      problems.push(`${c.id}: a Hunt needs 3+ items with at least one target and one decoy`);
    }
  }

  // Cycle check: walk from root; a composition is a tree, not a graph.
  const byId = new Map(spec.components.map((c) => [c.id, c]));
  const visiting = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return false;
    visiting.add(id);
    const node = byId.get(id);
    const ok = !node || childRefs(node).every(walk);
    visiting.delete(id);
    return ok;
  };
  if (ids.has('root') && !walk('root')) problems.push('composition contains a reference cycle');

  return problems;
}

/** The strict form — for the registry entry, where refinements are allowed. */
export const composedSpecStrict = composedSpec.superRefine((spec, ctx) => {
  for (const problem of compositionProblems(spec)) {
    ctx.addIssue({ code: 'custom', message: problem });
  }
});

export const widgetSpec = z.discriminatedUnion('kind', [
  composedSpec,
  debateAiSpec,
  writingWorkshopSpec,
  fractionAreaModelSpec,
  swiperFlashcardSpec,
  draftMeterSpec,
  defendClaimSpec,
  dragSortSpec,
  dragCategorizeSpec,
  markdownCardSpec,
  flashcardSpec,
  stepRevealSpec,
  narratedCardSpec,
  timelineBuilderSpec,
  crosswordSpec,
  findTheFlawSpec,
  drawTheCurveSpec,
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
  'composed',
  'fraction-area-model',
  'swiper-flashcard',
  'draft-meter',
  'defend-claim',
  'drag-sort',
  'drag-categorize',
  'crossword',
  'markdown-card',
  'flashcard',
  'step-reveal',
  'narrated-card',
  'timeline-builder',
  'find-the-flaw',
  'draw-the-curve',
  'debate-ai',
  'writing-workshop',
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
   *
   * No per-kind prose here. That guidance is built from the widget registry in
   * `generate.ts` — see `widgetGuidance()`. Keeping a second hand-maintained
   * copy is what let five kinds ship with no description at all, and left
   * draft-meter described as argument-only long after it stopped being.
   */
  widgetKind: widgetKind.describe(
    'Which interactive widget the student uses to do this step. Every step gets one — this is not'
      + ' supporting material, it is the task. The available kinds, and when each fits, are listed'
      + ' in the system prompt.',
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
