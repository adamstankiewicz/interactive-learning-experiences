import { DragCategorize } from '@/components/widgets/DragCategorize';
import { dragCategorizeSpec, type DragCategorizeSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<DragCategorizeSpec>({
  kind: 'drag-categorize',
  schema: dragCategorizeSpec,
  component: DragCategorize,
  plannerDescription:
    'Sorts items into 2-4 named buckets — use this over swiper-flashcard when there are more than two groups.',
});
