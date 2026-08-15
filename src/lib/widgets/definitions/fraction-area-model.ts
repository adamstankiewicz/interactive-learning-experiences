import { FractionAreaModel } from '@/components/widgets/FractionAreaModel';
import { fractionAreaModelSpec, type FractionAreaModelSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<FractionAreaModelSpec>({
  kind: 'fraction-area-model',
  schema: fractionAreaModelSpec,
  component: FractionAreaModel,
  coverageRule: (standard) => standard.tags.includes('fractions'),
  plannerDescription:
    'Partitions a whole into equal parts to build a target fraction — only meaningful for fractions.',
});
