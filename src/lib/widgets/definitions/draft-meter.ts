import { DraftMeter } from '@/components/widgets/DraftMeter';
import { draftMeterSpec, type DraftMeterSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

const MIN_GRADE = 3;

registerWidgetCatalog<DraftMeterSpec>({
  kind: 'draft-meter',
  schema: draftMeterSpec,
  component: DraftMeter,
  // Content tag alone isn't enough: abstract argumentative writing with citation
  // isn't a K-2 task regardless of which writing/reading-evidence standard it's
  // serving, so this also gates on grade — not just `coverage.ts`'s old regex-only check.
  coverageRule: (standard) =>
    (standard.tags.includes('writing-argument') || standard.tags.includes('reading-evidence')) &&
    reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    'A short written-argument prompt, live-scored as the student types. Only for standards about writing an argument or citing textual evidence — meaningless for any other standard, and the heaviest interaction, so use it for at most one step in a pathway.',
});
