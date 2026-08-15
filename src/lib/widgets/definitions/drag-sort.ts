import { lazy } from 'react';
import { dragSortSpec, type DragSortSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<DragSortSpec>({
  kind: 'drag-sort',
  schema: dragSortSpec,
  assesses: true,
  component: lazy(() =>
    import('@/components/widgets/DragSort').then((m) => ({ default: m.DragSort })),
  ),
  plannerDescription: 'Orders items along one dimension — chronology, magnitude, steps in a process.',
});
