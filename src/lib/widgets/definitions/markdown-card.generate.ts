import { markdownCardSpec, type MarkdownCardSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

function normalize(spec: MarkdownCardSpec): MarkdownCardSpec | null {
  if (!spec.title.trim() || !spec.body.trim()) return null;
  return spec;
}

registerWidgetGenerator({
  kind: 'markdown-card',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: markdownCardSpec,
      system: [
        'You write a short re-teaching card for a student who is struggling with this concept.',
        'The title is a plain noun phrase naming the concept (e.g. "Why fractions need equal parts").',
        'The body is 80–200 words of clear markdown — use bold, bullet lists, and blockquotes freely,',
        'but avoid headings. Address the student directly ("you", "your"). Explain the concept from',
        'first principles without assuming the student remembers prior instruction.',
        'The optional tip is a single callout sentence that names the one thing to remember.',
        'Null to omit it.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    return {
      widget: null,
      note: 'The markdown card did not produce usable content.',
    };
  },
});
