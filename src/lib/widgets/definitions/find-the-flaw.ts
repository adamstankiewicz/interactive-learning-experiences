import { lazy } from 'react';
import { findTheFlawSpec, type FindTheFlawSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

/**
 * Error analysis needs something to analyse against. A student who has not yet
 * built a reliable sense of the correct procedure cannot tell a wrong step from
 * an unfamiliar one, and guessing at it teaches the mistake instead of the fix.
 * Grade 4 is where that generally holds.
 *
 * Unlike the fraction model or the draft meter, there is no content gate: the
 * verb — judge finished work — is subject-independent. A flawed solution, a
 * flawed experiment, a flawed argument and a flawed causal claim are the same
 * interaction.
 */
const MIN_GRADE = 4;

registerWidgetCatalog<FindTheFlawSpec>({
  kind: 'find-the-flaw',
  schema: findTheFlawSpec,
  assesses: true,
  component: lazy(() =>
    import('@/components/widgets/FindTheFlaw').then((m) => ({ default: m.FindTheFlaw })),
  ),
  coverageRule: (standard) => reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    'A worked example containing one deliberate mistake — a solution, an experiment, an argument, a historical explanation. The student finds the step where it goes wrong, then says why. The only interaction that asks a student to judge finished work rather than produce or arrange it, so it fits any subject, but it requires them to already know the correct procedure: use it for "practice" or "check", never "activate", and never before a "model" step has shown the concept done right.',
});
