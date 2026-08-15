import { lazy } from 'react';
import { defendClaimSpec, type DefendClaimSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

/**
 * Grade 7 is where this stops being a stretch and starts being the work.
 *
 * Higher than draft-meter's floor of 3, and for a different reason than
 * reading level: what this asks for is not writing an argument but holding one
 * against a counterargument, from documents that disagree. That is the sourcing
 * move history standards start expecting around middle school, and below it the
 * honest version of this activity is a comprehension question wearing a debate
 * costume.
 */
const MIN_GRADE = 7;

registerWidgetCatalog<DefendClaimSpec>({
  kind: 'defend-claim',
  schema: defendClaimSpec,
  assesses: true,
  component: lazy(() =>
    import('@/components/widgets/DefendClaim').then((m) => ({ default: m.DefendClaim })),
  ),
  /**
   * Both conditions, and neither is redundant. The content tag alone would let
   * this land on a 4th-grade social studies standard; the grade alone would let
   * it land on 8th-grade algebra, where there is no contestable claim to defend
   * and the model would have to invent one.
   */
  coverageRule: (standard) =>
    standard.tags.includes('history') && reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    'A contestable historical claim, two conflicting sources, and a defense the student revises against feedback they ask for. Only for history and social-studies standards at grade 7 and above — it needs a claim historians genuinely disagree about. Prefer it over draft-meter when the standard is about historical argument or sourcing. The heaviest interaction in the set, so use it for at most one step in a pathway.',
});
