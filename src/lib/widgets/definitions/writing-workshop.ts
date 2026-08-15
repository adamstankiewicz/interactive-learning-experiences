import { lazy } from 'react';

import { writingWorkshopSpec, type WritingWorkshopSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

/**
 * Grade 5 and a writing standard, and the pair is doing different work.
 *
 * The tag keeps this off reading standards, which draft-meter already serves
 * with a short response — asking a student to produce several hundred words
 * about a passage is not what "cite textual evidence" is asking for. The grade
 * keeps it off the early years, where an extended piece is a handwriting
 * exercise and a marked-up page is discouraging rather than useful.
 */
const MIN_GRADE = 5;

registerWidgetCatalog<WritingWorkshopSpec>({
  kind: 'writing-workshop',
  schema: writingWorkshopSpec,
  component: lazy(() =>
    import('@/components/widgets/WritingWorkshop').then((m) => ({ default: m.WritingWorkshop })),
  ),
  coverageRule: (standard) =>
    standard.tags.includes('writing-argument') && reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    'Long-form writing — an essay, a lab report, a research proposal, a short story — that the student asks to have read when they are ready, and gets back marked up: passages underlined where they work and where they do not, each with a note. Use it when the standard asks for an extended piece rather than a few sentences, which is draft-meter. The longest activity in the set, so give it a practice or check step of its own and never pair it with another writing task.',
});
