import { lazy } from 'react';
import { drawTheCurveSpec, type DrawTheCurveSpec } from '@/lib/pathway/schema';
import { reachesGrade } from '@/lib/standards/grade';
import { registerWidgetCatalog } from '@/lib/widgets/types';

/**
 * Reading a shape off two axes is a taught skill, not an innate one, and below
 * about grade 3 a line going up is not yet reliably "more". No content gate
 * though: because the check is on shape rather than value, "how does this
 * change over time" is a question maths, science, history and literature all
 * ask, and they ask it the same way.
 */
const MIN_GRADE = 3;

registerWidgetCatalog<DrawTheCurveSpec>({
  kind: 'draw-the-curve',
  schema: drawTheCurveSpec,
  component: lazy(() =>
    import('@/components/widgets/DrawTheCurve').then((m) => ({ default: m.DrawTheCurve })),
  ),
  coverageRule: (standard) => reachesGrade(standard.gradeLevels, MIN_GRADE),
  plannerDescription:
    "Labelled positions along an axis, where the student drags each point's height to predict a shape and then sees the real curve drawn over their guess. Checked on shape rather than numbers, so it is not only for maths: tension across a story, distance over time, population across decades, a trend across eras. Use it when the standard is about how something changes, and prefer practice or check — the reveal lands hardest once the student has a real prediction to be wrong about.",
});
