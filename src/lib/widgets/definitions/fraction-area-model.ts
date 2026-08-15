import { lazy } from 'react';
import { fractionAreaModelSpec, type FractionAreaModelSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<FractionAreaModelSpec>({
  kind: 'fraction-area-model',
  schema: fractionAreaModelSpec,
  component: lazy(() =>
    import('@/components/widgets/FractionAreaModel').then((m) => ({ default: m.FractionAreaModel })),
  ),
  coverageRule: (standard) => standard.tags.includes('fractions'),
  plannerDescription:
    'Partitions a whole into equal parts to build a target fraction — only meaningful for fractions.',
});
