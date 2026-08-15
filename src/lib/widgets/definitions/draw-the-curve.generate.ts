import { drawTheCurveSpec, type DrawTheCurveSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_POINTS = 4;
const MAX_POINTS = 7;
/** Matches the widget's own threshold — see `FLAT` in DrawTheCurve.tsx. */
const FLAT = 8;

/**
 * A flat line is the one shape this widget cannot ask for: every student starts
 * flat, so a curve with no direction changes is solved by doing nothing. It has
 * to have at least one real move in it to be a question at all.
 */
function normalize(spec: DrawTheCurveSpec): DrawTheCurveSpec | null {
  const points = spec.xAxis.points
    .filter((p, i, all) => p.id.trim() && all.findIndex((x) => x.id === p.id) === i)
    .slice(0, MAX_POINTS);

  if (points.length < MIN_POINTS) return null;

  // One value per point, in point order, clamped into the chart.
  const byId = new Map(spec.actual.map((a) => [a.pointId, a.value]));
  if (!points.every((p) => byId.has(p.id))) return null;

  const actual = points.map((p) => ({
    pointId: p.id,
    value: Math.min(100, Math.max(0, Math.round(byId.get(p.id)!))),
  }));

  const hasMovement = actual
    .slice(0, -1)
    .some((a, i) => Math.abs(actual[i + 1]!.value - a.value) >= FLAT);
  if (!hasMovement) return null;

  return { ...spec, xAxis: { ...spec.xAxis, points }, actual };
}

registerWidgetGenerator({
  kind: 'draw-the-curve',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: drawTheCurveSpec,
      system: [
        'You configure a chart the student shapes by dragging points, to predict how something',
        'changes, before the real curve is drawn over their guess.',
        '',
        'Pick a quantity from this standard that genuinely rises and falls, or rises and levels off,',
        'across some ordered run of positions. Time is the commonest axis but far from the only one:',
        'stages of a story, steps in a process, distance from a source, eras. If the standard has no',
        'quantity that changes across anything, this is the wrong widget — say so by producing a flat',
        'curve and it will be replaced.',
        '',
        'THE SETUP IS THE QUESTION. The student can only predict a shape they have been given the',
        'facts for. Every event that changes the line has to appear in the setup: a pause, a sudden',
        'change, a levelling off. "Show how far Ana is from home during her walk" is unanswerable —',
        '"Ana walks to the shop, spends five minutes inside, then walks on to her friend\'s house and',
        'stays" can be predicted. Describe the situation and never the line: say what happened, not',
        'that it rises and then flattens, or you have given away the answer.',
        '',
        'The values are 0-100 and no numbers are ever shown to the student, so do not choose a',
        'quantity whose real units matter. What is being taught is the SHAPE: where it climbs, where',
        'it peaks, where it flattens. Scale the real values across the range so the shape is clearly',
        'visible — a curve that only moves between 48 and 55 reads as flat.',
        '',
        'The shape must have at least one direction change or a clear sustained climb. A line that',
        'only goes one way with no inflection is a weak question, and a flat line is not a question',
        'at all: every student starts flat, so they would be right by doing nothing.',
        '',
        'Axis labels are short — they sit under the chart. The y axis is described in words, not',
        'units: give the low and high ends names a student understands ("calm" to "intense",',
        '"close to home" to "far away").',
        '',
        'The reveal explains why the true shape goes the way it does, in two or three sentences —',
        'it is the payoff, and it should teach the causal story, not just describe the line.',
        'The hint points at what to reconsider without describing the curve.',
      ].join('\n'),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    return {
      widget: null,
      note: "This standard didn't yield a quantity with a shape worth predicting — built a fallback activity for this step instead.",
    };
  },
});
