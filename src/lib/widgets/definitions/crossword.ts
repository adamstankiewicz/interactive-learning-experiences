import { Crossword } from '@/components/widgets/Crossword';
import { crosswordSpec, type CrosswordSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

const MIN_GRADE = 1;

registerWidgetCatalog<CrosswordSpec>({
  kind: 'crossword',
  schema: crosswordSpec,
  component: Crossword,
  // Every standard carries vocabulary in principle, but solving a crossword needs
  // baseline independent reading — gated at grade 1, not kindergarten.
  coverageRule: (standard) => reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    "A vocabulary puzzle built from the standard's own terms — fits any subject. Best for a \"check\" step that consolidates the words the lesson taught.",
});
