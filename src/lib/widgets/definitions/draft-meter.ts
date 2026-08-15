import { DraftMeter } from '@/components/widgets/DraftMeter';
import { draftMeterSpec, type DraftMeterSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

const MIN_GRADE = 3;

registerWidgetCatalog<DraftMeterSpec>({
  kind: 'draft-meter',
  schema: draftMeterSpec,
  component: DraftMeter,
  // `written-response` rather than the old argument-only pair: the meter now
  // carries the checks its own standard asks for, so it is no longer limited to
  // standards about argument. Content tag alone still isn't enough — writing a
  // few analytical sentences isn't a K-2 task whichever standard it serves — so
  // this gates on grade too.
  coverageRule: (standard) =>
    standard.tags.includes('written-response') && reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    'A short written response, live-scored as the student types against the three things this standard actually asks for — a claim and evidence, an interpretation and textual support, whatever fits. Good for reading comprehension, literary analysis, history sources and argument alike. Needs a standard where a few sentences of student writing is the natural evidence, and it is the heaviest interaction, so use it for at most one step in a pathway.',
});
