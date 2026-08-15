import { DragSort } from '@/components/widgets/DragSort';
import { dragSortSpec, type DragSortSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<DragSortSpec>({
  kind: 'drag-sort',
  schema: dragSortSpec,
  component: DragSort,
  plannerDescription: 'Orders items along one dimension — chronology, magnitude, steps in a process.',
});
