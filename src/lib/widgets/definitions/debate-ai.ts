import { lazy } from 'react';

import { debateAiSpec, type DebateAiSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

/**
 * Grade 6, a notch below defend-claim's 7 and well above draft-meter's 3.
 *
 * Lower than defend-claim because nothing has to be written and sourced — the
 * student is reacting to an argument in front of them rather than constructing
 * one from documents. Higher than draft-meter because judging someone else's
 * reasoning while they push back is Bloom's evaluate, and below middle school
 * the honest version of this is contradiction rather than evaluation.
 */
const MIN_GRADE = 6;

registerWidgetCatalog<DebateAiSpec>({
  kind: 'debate-ai',
  schema: debateAiSpec,
  assesses: true,
  component: lazy(() => import('@/components/widgets/DebateAI').then((m) => ({ default: m.DebateAI }))),
  /**
   * Both halves matter. The tags keep it off procedural standards, where there
   * is no contestable claim and the model would have to invent one; the grade
   * keeps it off the early years, where an opponent that does not fold reads as
   * an adult refusing to agree rather than as an argument to be tested.
   */
  coverageRule: (standard) =>
    (standard.tags.includes('writing-argument') ||
      standard.tags.includes('reading-evidence') ||
      standard.tags.includes('history')) &&
    reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    "A short debate against an opponent that argues a position and does not fold. It credits evaluative moves — challenging evidence, catching an unsupported leap, conceding a fair point — rather than winning, so it is the one interaction that reaches Bloom's evaluate. Needs a claim with a genuine second side: argument, history and evidence-evaluation standards, never procedural ones. Heavy, so at most one step, normally practice or check.",
});
