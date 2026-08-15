import { lazy } from 'react';
import { markdownCardSpec, type MarkdownCardSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<MarkdownCardSpec>({
  kind: 'markdown-card',
  schema: markdownCardSpec,
  assesses: false,
  component: lazy(() =>
    import('@/components/widgets/MarkdownCard').then((m) => ({ default: m.MarkdownCard })),
  ),
  plannerDescription: 'Presents a short LLM-authored markdown explanation — headings, bold, lists, blockquotes — used to re-teach a concept a student is struggling with.',
});
