import { z } from 'zod';

/**
 * The primitive catalog for the composition prototype — deliberately small
 * (five primitives) so the model's choices are legible: which of these it
 * reaches for, and how it nests them, is the actual thing being prototyped.
 * Every field here is a literal value the model authors directly (a string,
 * an array) — never a `$state`/`$computed`/`$bindState` expression. The
 * registered components (`compose-catalog.tsx`) own all reactivity
 * themselves via ordinary React state; the model only ever picks *content*
 * and *structure* from a fixed, developer-approved set, the same trust
 * boundary the plan describes for every widget this app has ever generated.
 *
 * `composedElement` is one flat object shape shared by every element, not a
 * `z.discriminatedUnion` of five differently-shaped objects — a first version
 * used a discriminated union nested inside an array and it reliably failed
 * structured-output generation: the model fell back to prose with a
 * markdown-fenced JSON block instead of enforced structured output, and even
 * that JSON didn't match the declared shape. Every other schema this app
 * generates against (`pathwayPlan.steps`, `widgetSpec` per-kind) is a flat
 * object array too — this follows that same proven shape instead of
 * reaching for a union again.
 */
const composedElementType = z.enum(['Stack', 'Card', 'Heading', 'Text', 'ChoiceGroup']);

export const composedElement = z.object({
  id: z.string(),
  type: composedElementType,
  children: z
    .array(z.string())
    .nullable()
    .describe("Child element ids, in order. Only for 'Stack' and 'Card' — null for the other three types."),
  direction: z.enum(['row', 'column']).nullable().describe("Only for 'Stack': row for side-by-side, column for stacked."),
  gap: z.enum(['sm', 'md', 'lg']).nullable().describe("Only for 'Stack': spacing between children."),
  title: z.string().nullable().describe("Only for 'Card': a short heading, or null for none."),
  headingText: z.string().nullable().describe("Only for 'Heading'."),
  headingLevel: z
    .enum(['lg', 'md'])
    .nullable()
    .describe("Only for 'Heading': 'lg' for the composition's main heading, 'md' for a secondary one."),
  text: z.string().nullable().describe("Only for 'Text': a sentence or two of plain prose, no markdown."),
  question: z.string().nullable().describe("Only for 'ChoiceGroup'."),
  options: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .nullable()
    .describe(
      "Only for 'ChoiceGroup': 2-5 options, including at least one genuine distractor — never all-obviously-wrong.",
    ),
  correctOptionId: z.string().nullable().describe("Only for 'ChoiceGroup': must exactly match one of `options`' ids."),
});

export type ComposedElement = z.infer<typeof composedElement>;

export const composedWidget = z.object({
  root: z.string().describe('The id of the single top-level element — must exist in `elements`.'),
  elements: z.array(composedElement).min(1).max(16).describe('Every element the composition uses, flat, id-keyed.'),
});

export type ComposedWidget = z.infer<typeof composedWidget>;

const PRIMITIVE_GUIDE = [
  'You compose a small interactive mini-lesson from exactly five element types — never invent a sixth.',
  'Every element shares the same flat shape; only the fields relevant to its own `type` are non-null — set',
  'every field that does not apply to null, do not omit fields.',
  "'Stack' arranges children in a row or column (uses: children, direction, gap); use it to lay out a Card",
  'next to another Card, or to stack a Heading above a Text above a ChoiceGroup inside one Card.',
  "'Card' is a bordered surface with an optional title (uses: children, title) — the usual outer container",
  'for a section.',
  "'Heading' (uses: headingText, headingLevel) and 'Text' (uses: text) carry the actual teaching: a short",
  "hook or explanation in the topic's own terms, not generic filler.",
  "'ChoiceGroup' (uses: question, options, correctOptionId) is the one check-for-understanding moment: a",
  'question, 2-5 options, and which one is correct. Every composition needs exactly one.',
  'Default to small — one root Card holding a Heading, a sentence or two of Text, and one ChoiceGroup — but',
  'reach for a row Stack of two side-by-side Cards when the topic genuinely calls for a comparison (two',
  'processes, two categories, before/after). Every child id referenced anywhere must exist as its own',
  'element in `elements`.',
].join(' ');

export function composePrompt(topic: string): { system: string; prompt: string } {
  return {
    system: PRIMITIVE_GUIDE,
    prompt: `Topic: ${topic}`,
  };
}

/**
 * The model can hallucinate a dangling child id or an id/correctOptionId
 * mismatch — structured output only guarantees shape, not referential
 * integrity. Checked once, here, rather than trusted at render time.
 */
export function validateComposedWidget(widget: ComposedWidget): string | null {
  const ids = new Set(widget.elements.map((element) => element.id));
  if (!ids.has(widget.root)) return `root "${widget.root}" is not one of the composed elements.`;

  for (const element of widget.elements) {
    if (element.type === 'Stack' || element.type === 'Card') {
      for (const childId of element.children ?? []) {
        if (!ids.has(childId)) return `"${element.id}" references missing child "${childId}".`;
      }
    }
    if (element.type === 'ChoiceGroup') {
      if (!element.question || !element.options || !element.correctOptionId) {
        return `"${element.id}" is a ChoiceGroup missing question/options/correctOptionId.`;
      }
      const optionIds = new Set(element.options.map((option) => option.id));
      if (!optionIds.has(element.correctOptionId)) {
        return `"${element.id}"'s correctOptionId "${element.correctOptionId}" matches none of its options.`;
      }
    }
    if (element.type === 'Heading' && (!element.headingText || !element.headingLevel)) {
      return `"${element.id}" is a Heading missing headingText/headingLevel.`;
    }
    if (element.type === 'Text' && !element.text) {
      return `"${element.id}" is a Text missing text.`;
    }
    if (element.type === 'Stack' && (!element.direction || !element.gap)) {
      return `"${element.id}" is a Stack missing direction/gap.`;
    }
  }

  return null;
}
