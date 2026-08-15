import { MarkdownCard } from '@/components/widgets/MarkdownCard';
import { markdownCardSpec, type MarkdownCardSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<MarkdownCardSpec>({
  kind: 'markdown-card',
  schema: markdownCardSpec,
  component: MarkdownCard,
  plannerDescription: 'Presents a short LLM-authored markdown explanation — headings, bold, lists, blockquotes — used to re-teach a concept a student is struggling with.',
});
