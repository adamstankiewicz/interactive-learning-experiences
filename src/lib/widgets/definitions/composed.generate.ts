import { z } from 'zod';

import { composedSpec, compositionProblems, type ComposedSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

/**
 * The model authors only what is genuinely its to author: a title and the
 * component tree. The envelope (kind, learning component binding) is the
 * generator's job, and field-name drift gets one deterministic
 * canonicalization pass — models reliably produce the right *structure* here
 * while wobbling on names (`body` for `text`, flat policy fields). What
 * canonicalization never does is invent content or repair references: a tree
 * the model cannot structure is a tree the student should not receive, so
 * the strict schema and `compositionProblems` gate after the rename pass.
 */
/**
 * One permissive node shape advertising the superset of every component's
 * fields — the serialized schema is what the model actually obeys (a loose
 * object serializes as bare {id, type} and the model dutifully emits exactly
 * that), so every field a node might need must be visible here. The strict
 * discriminated union in `composedSpec` is enforced after canonicalization.
 */
const authoringNode = z.object({
  id: z.string().describe('Short lowercase slug, unique in the list.'),
  type: z.string().describe('One of: Text, Callout, Group, Reveal, Sequence.'),
  text: z.string().nullable().describe('Text and Callout: the markdown content.'),
  variant: z.string().nullable().describe('Text only: "caption" or null.'),
  intent: z.string().nullable().describe('Callout only: "why", "tip", or "note".'),
  label: z.string().nullable().describe('Callout only: short bold lead-in like "Why?".'),
  children: z.array(z.string()).nullable().describe('Group and Sequence: ids of the children, in order.'),
  faces: z
    .array(z.object({ title: z.string(), child: z.string() }))
    .nullable()
    .describe('Reveal only: exactly two faces, front then back.'),
  policy: z
    .object({
      order: z.string().describe('"linear" or "free"'),
      disclosure: z.string().describe('"gated" or "all"'),
      revealed: z.string().describe('"accumulate" or "replace"'),
    })
    .nullable()
    .describe('Sequence only: how the children are traversed.'),
});

const composedAuthoring = z.object({
  title: z.string().nullable().describe('Short student-facing activity title.'),
  components: z
    .array(authoringNode)
    .describe('Flat component list. Exactly one component must have id "root". 3–20 components. Set fields that do not apply to a node type to null.'),
});

type LooseNode = { id: string; type: string } & Partial<z.infer<typeof authoringNode>> &
  Record<string, unknown>;

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** One node, canonical field names — synonyms mapped, nothing invented. */
export function canonicalizeNode(node: LooseNode): Record<string, unknown> {
  const text = str(node.text) ?? str(node.body) ?? str(node.content) ?? str(node.markdown);

  switch (node.type) {
    case 'Text':
      return {
        type: 'Text',
        id: node.id,
        text: text ?? '',
        variant: node.variant === 'caption' ? 'caption' : null,
      };
    case 'Callout': {
      const intent = ['why', 'tip', 'note'].includes(str(node.intent) ?? '') ? node.intent : 'note';
      return { type: 'Callout', id: node.id, intent, label: str(node.label) ?? '', text: text ?? '' };
    }
    case 'Group':
      return { type: 'Group', id: node.id, children: Array.isArray(node.children) ? node.children : [] };
    case 'Reveal': {
      // Accept the {front, back} shorthand models reach for.
      const faces =
        Array.isArray(node.faces) && node.faces.length > 0
          ? node.faces
          : str(node.front) && str(node.back)
            ? [
                { title: 'Front', child: node.front },
                { title: 'Back', child: node.back },
              ]
            : [];
      return { type: 'Reveal', id: node.id, faces };
    }
    case 'Sequence': {
      const source = (node.policy && typeof node.policy === 'object' ? node.policy : node) as Record<
        string,
        unknown
      >;
      return {
        type: 'Sequence',
        id: node.id,
        policy: { order: source.order, disclosure: source.disclosure, revealed: source.revealed },
        children: Array.isArray(node.children) ? node.children : [],
      };
    }
    default:
      // Unknown types pass through untouched; the strict parse rejects them.
      return node;
  }
}

registerWidgetGenerator({
  kind: 'composed',
  async generate(ctx) {
    const authored = await generateStructured({
      schema: composedAuthoring,
      system: [
        'You compose a short learning activity from pedagogical building blocks.',
        'Output a single JSON object with exactly two top-level keys: "title" (short student-facing activity title) and "components". No markdown fences, no commentary.',
        'Component types, each an object with "type" and "id" fields, referenced by id in a flat list:',
        'Text {text: markdown, variant: "caption" or null}; Callout {intent: "why"|"tip"|"note", label, text} — an emphasized box: "why" for the reasoning behind an idea, "tip" for strategy;',
        'Group {children: 2–6 ids, stacked top to bottom}; Reveal {faces: exactly two of {title, child} — front then back; the student taps to turn it over: prompt on the front, payoff on the back};',
        'Sequence {policy: {order: "linear"|"free", disclosure: "gated"|"all", revealed: "accumulate"|"replace"}, children: 2–8 ids in teaching order}.',
        'Pedagogy: Sequence(linear, gated, accumulate) for walkthroughs where steps build on each other; Sequence(free, all, replace) for browsable card decks;',
        'Reveal to provoke a prediction before showing an answer; a "why" Callout wherever reasoning deserves emphasis — asking why is how ideas stick.',
        'Structure rules: exactly one component has id "root" (usually a Group or Sequence); every referenced id exists in the list;',
        'ids are short lowercase slugs; 3–20 components total. Compose for the topic and audience you are given — do not imitate a quiz; nothing here measures.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const parsed = composedSpec.safeParse({
      kind: 'composed',
      learningComponentId: ctx.plan.outcomes[ctx.step.outcomeIndex]?.learningComponentId ?? null,
      // The plan step's own title is the honest fallback when the model
      // fixates on the tree and forgets to name the activity.
      title: authored.title?.trim() || ctx.step.title,
      components: authored.components.map(canonicalizeNode),
    });

    const widget = parsed.success ? normalize(parsed.data) : null;
    if (widget) return { widget, note: null };

    return {
      widget: null,
      note: 'The composed activity had structural problems — built a fallback activity for this step instead.',
    };
  },
});

function normalize(spec: ComposedSpec): ComposedSpec | null {
  // Drop components with blank ids, then require a sound tree — no repair
  // beyond that: a composition the model cannot structure is a composition
  // the student should not receive.
  const components = spec.components.filter((c) => c.id.trim());
  const cleaned = { ...spec, components };
  return compositionProblems(cleaned).length === 0 ? cleaned : null;
}
