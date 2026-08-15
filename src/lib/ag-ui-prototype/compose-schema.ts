import { z } from 'zod';

/**
 * The primitive catalog for the composition prototype. Every prop a literal
 * value the model authors directly (a string, an enum, a small array) —
 * never a `$state`/`$computed`/`$bindState` expression. The registered
 * components (`compose-catalog.tsx`) own all reactivity themselves; the
 * model only ever picks *content* and *structure* from a fixed,
 * developer-approved set, the same trust boundary as every widget this app
 * has ever generated.
 *
 * `composedElement` is one flat object shape shared by every element, not a
 * `z.discriminatedUnion` of differently-shaped objects — an early version
 * used a discriminated union nested inside an array and it reliably failed
 * structured-output generation entirely (the model fell back to prose with
 * a markdown-fenced JSON block that didn't even match the declared shape).
 *
 * Field count turned out to matter on its own, independent of nesting
 * shape: a first version of this flat schema at ~20 fields also reliably
 * broke structured-output generation the same way, even though every field
 * was a simple scalar/small-array. Trimmed back down by merging fields that
 * meant almost the same thing (`expectedValue`/`revealValue` -> one
 * `matchValue`; `headingText` folded into `text`), and by cutting
 * `RevealWhen`'s condition enum down to the one case that covers nearly
 * every real use ("reveal once the bound value equals X") instead of also
 * offering not-equals/is-set variants nobody was likely to need yet.
 *
 * The state-sharing design this schema exists to support: primitives share
 * *state* — one element's answer gating whether another becomes visible, or
 * feeding a running score — without the model ever authoring a real
 * json-render `$state`/`$cond`/`$computed` expression object (the kind of
 * nested-expression complexity that broke generation in the first place).
 * Every stateful element writes a value keyed by its own `id`; anything
 * that reacts to it just names that `id` in a plain `bindTo` string field.
 * The model composes a graph of references by string, never an expression —
 * `compose-catalog.tsx`'s registered components are the only place that
 * ever touches the actual state-store paths those ids resolve to.
 */
const composedElementType = z.enum([
  'Stack',
  'Card',
  'Heading',
  'Text',
  'SingleChoice',
  'FeedbackBanner',
  'RevealWhen',
  'Counter',
  'QuizGrid',
]);

const gridQuestion = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(4),
  correctOptionId: z.string().describe("Must exactly match one of this question's own `options` ids."),
});

export const composedElement = z.object({
  id: z.string(),
  type: composedElementType,
  children: z
    .array(z.string())
    .nullable()
    .describe("Child ids, in order. Only for 'Stack', 'Card', and 'RevealWhen' — null for every other type."),
  direction: z.enum(['row', 'column']).nullable().describe("Only for 'Stack'."),
  gap: z.enum(['sm', 'md', 'lg']).nullable().describe("Only for 'Stack'."),
  title: z.string().nullable().describe("Only for 'Card': a short heading, or null for none."),
  headingLevel: z.enum(['lg', 'md']).nullable().describe("Only for 'Heading' ('lg' main, 'md' secondary) — Text leaves this null."),
  text: z.string().nullable().describe("For 'Heading' and 'Text': the prose itself, one sentence or two, no markdown."),
  question: z.string().nullable().describe("Only for 'SingleChoice'."),
  options: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .nullable()
    .describe("Only for 'SingleChoice': 2-5 options, at least one genuine distractor."),
  bindTo: z.string().nullable().describe("For 'FeedbackBanner', 'RevealWhen', 'Counter': the id this one reacts to."),
  matchValue: z
    .string()
    .nullable()
    .describe(
      "For 'FeedbackBanner' (the bound SingleChoice option id that counts correct) and 'RevealWhen' (the" +
        ' value that unlocks the children) — same meaning, different primitive.',
    ),
  correctMessage: z.string().nullable().describe("Only for 'FeedbackBanner'."),
  incorrectMessage: z.string().nullable().describe("Only for 'FeedbackBanner'."),
  counterLabel: z.string().nullable().describe("Only for 'Counter'."),
  gridQuestions: z
    .array(gridQuestion)
    .min(3)
    .max(9)
    .nullable()
    .describe(
      "Only for 'QuizGrid': 3-9 questions, one per claimed square, cycling if the board outlasts the pool." +
        ' A QuizGrid writes its own win count to its own id — Counter can bindTo a QuizGrid.',
    ),
});

export type ComposedElement = z.infer<typeof composedElement>;

export const composedWidget = z.object({
  root: z.string().describe('The id of the single top-level element — must exist in `elements`.'),
  elements: z.array(composedElement).min(1).max(28).describe('Every element the composition uses, flat, id-keyed.'),
});

export type ComposedWidget = z.infer<typeof composedWidget>;

const PRIMITIVE_GUIDE = [
  'Compose a small interactive mini-lesson from exactly nine element types — never invent a tenth. Every',
  'element shares one flat shape; set fields that apply, null everything else.',
  "Stack (children, direction, gap) lays out children in a row or column. Card (children, title) is a",
  'bordered surface. Heading and Text (both use: text; Heading also uses headingLevel) carry the actual',
  "teaching, in the topic's own terms.",
  "SingleChoice (question, options) asks a question, recording the picked option id under its own id — it",
  'shows no verdict itself. FeedbackBanner (bindTo, matchValue, correctMessage, incorrectMessage) reads the',
  "value at bindTo, compares to matchValue, shows the matching message once bindTo has a value — pair one",
  "with every SingleChoice. RevealWhen (bindTo, matchValue, children) hides its children until bindTo's value",
  'equals matchValue — wrap a second SingleChoice in one bound to the first, matchValue its correct option',
  'id, to make it unlock only after a correct answer. Counter (bindTo, counterLabel) displays a number read',
  "from bindTo — bind it to a QuizGrid's id to show that grid's win count.",
  'QuizGrid (gridQuestions) is a 3x3 tic-tac-toe board where claiming a square means answering one of',
  'gridQuestions correctly; wrong answers go to the opponent. Only reach for it when the ask is explicitly',
  'playful/a game/competitive — at most one per composition.',
  'Default small: one root Card with a Heading, a sentence of Text, a SingleChoice, and a FeedbackBanner',
  'bound to it. Use a row Stack of two Cards for a real comparison. Use a RevealWhen chain when the ask',
  'implies progression or unlocking. Every child id and every bindTo referenced anywhere must exist as its',
  'own element.',
].join(' ');

export function composePrompt(topic: string): { system: string; prompt: string } {
  return {
    system: PRIMITIVE_GUIDE,
    prompt: `Topic: ${topic}`,
  };
}

/**
 * The model can hallucinate a dangling child/bindTo id or a
 * matchValue/correctOptionId mismatch — structured output only guarantees
 * shape, not referential integrity. Checked once, here, rather than
 * trusted at render time.
 */
export function validateComposedWidget(widget: ComposedWidget): string | null {
  const ids = new Set(widget.elements.map((element) => element.id));
  if (!ids.has(widget.root)) return `root "${widget.root}" is not one of the composed elements.`;

  for (const element of widget.elements) {
    if (element.type === 'Stack' || element.type === 'Card' || element.type === 'RevealWhen') {
      for (const childId of element.children ?? []) {
        if (!ids.has(childId)) return `"${element.id}" references missing child "${childId}".`;
      }
    }
    if (element.type === 'Heading' && (!element.text || !element.headingLevel)) {
      return `"${element.id}" is a Heading missing text/headingLevel.`;
    }
    if (element.type === 'Text' && !element.text) {
      return `"${element.id}" is a Text missing text.`;
    }
    if (element.type === 'Stack' && (!element.direction || !element.gap)) {
      return `"${element.id}" is a Stack missing direction/gap.`;
    }
    if (element.type === 'SingleChoice' && (!element.question || !element.options)) {
      return `"${element.id}" is a SingleChoice missing question/options.`;
    }
    if (element.type === 'FeedbackBanner') {
      if (!element.bindTo || !element.matchValue || !element.correctMessage || !element.incorrectMessage) {
        return `"${element.id}" is a FeedbackBanner missing bindTo/matchValue/correctMessage/incorrectMessage.`;
      }
      if (!ids.has(element.bindTo)) return `"${element.id}"'s bindTo "${element.bindTo}" is not a composed element.`;
    }
    if (element.type === 'RevealWhen') {
      if (!element.bindTo || !element.matchValue) return `"${element.id}" is a RevealWhen missing bindTo/matchValue.`;
      if (!ids.has(element.bindTo)) return `"${element.id}"'s bindTo "${element.bindTo}" is not a composed element.`;
    }
    if (element.type === 'Counter') {
      if (!element.bindTo) return `"${element.id}" is a Counter missing bindTo.`;
      if (!ids.has(element.bindTo)) return `"${element.id}"'s bindTo "${element.bindTo}" is not a composed element.`;
    }
    if (element.type === 'QuizGrid') {
      if (!element.gridQuestions) return `"${element.id}" is a QuizGrid missing gridQuestions.`;
      for (const question of element.gridQuestions) {
        const optionIds = new Set(question.options.map((option) => option.id));
        if (!optionIds.has(question.correctOptionId)) {
          return `"${element.id}"'s question "${question.id}" correctOptionId matches none of its own options.`;
        }
      }
    }
  }

  return null;
}
