'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import { reportToConversation } from '@/lib/mcp/report';
import type { DrawTheCurveSpec } from '@/lib/pathway/schema';

type Props = { spec: DrawTheCurveSpec; onComplete?: (correct: boolean) => void };

/**
 * Shape a line by dragging its points, then see the real one drawn over it.
 *
 * Two decisions carry this widget out of maths and into everything else:
 *
 * The x positions are fixed and labelled, so the student only ever sets
 * heights. That makes the interaction a shape, not a plot, and it makes every
 * point a slider — which is what lets the whole thing work from the keyboard.
 *
 * And the answer is checked segment by segment on *direction*, never on value.
 * A student whose line has the right shape but sits low is right. For a story's
 * tension curve there is no correct number, only a correct shape, and the same
 * check does honest work for distance-time or population.
 */

/** Viewbox units. The chart scales to its container; these are just geometry. */
const W = 620;
const H = 330;
/**
 * Left and bottom padding hold the axis labels, which live inside the SVG
 * rather than beside it. Laying them out as neighbouring HTML looked fine until
 * the columns stretched to different heights and the "low" label slid below the
 * x-axis captions; in here they are positioned against the same coordinates as
 * the plot and cannot drift from it at any width.
 */
const PAD = { top: 24, right: 24, bottom: 52, left: 76 };

/**
 * Everyone starts flat along the bottom.
 *
 * Starting mid-chart was meant to leave room to drag either way, but it reads
 * as a line that already means something — a first look sees a drawn curve
 * rather than an empty chart waiting to be filled. On the floor it is
 * unmistakably nothing yet, and any shape at all is a deliberate move.
 */
const START_VALUE = 0;

/**
 * Mid-chart, used only where a value is genuinely unknown — a spec missing a
 * point, or a pointer event arriving before the svg ref is set. Distinct from
 * START_VALUE now that the student's floor is 0: falling back to the floor
 * would silently drag a point down rather than leave it be.
 */
const NEUTRAL_VALUE = 50;

/**
 * Below this, a segment counts as flat rather than rising or falling. Without
 * it every stray pixel of drag reads as a direction and a deliberately level
 * stretch is impossible to draw.
 */
const FLAT = 8;

type Direction = 'up' | 'flat' | 'down';

function directionOf(from: number, to: number): Direction {
  const delta = to - from;
  if (Math.abs(delta) < FLAT) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/**
 * A smooth path through the points that is guaranteed never to overshoot them.
 *
 * The obvious spline (Catmull-Rom) bulges past a point when its neighbours pull
 * on it, and here that bulge would be a lie: on a distance graph a flat stretch
 * means standing still, and a curve that dips below its own flat segment says
 * she walked back. Monotone cubic interpolation (Fritsch–Carlson) keeps every
 * segment within the values it connects — flat stays flat, rising never dips —
 * so the line can be curvy without asserting motion that isn't in the data.
 */
function curveSegments(pts: { x: number; y: number }[]): string[] {
  if (pts.length < 2) return [];

  const n = pts.length;
  const h: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(pts[i + 1]!.x - pts[i]!.x);
    delta.push((pts[i + 1]!.y - pts[i]!.y) / (pts[i + 1]!.x - pts[i]!.x));
  }

  // Tangents: average of neighbouring slopes, flattened at every local extreme.
  const m: number[] = [delta[0]!];
  for (let i = 1; i < n - 1; i++) {
    m.push(delta[i - 1]! * delta[i]! <= 0 ? 0 : (delta[i - 1]! + delta[i]!) / 2);
  }
  m.push(delta[n - 2]!);

  // Fritsch–Carlson: rein in any tangent that would carry the curve past the
  // segment's own endpoints.
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / delta[i]!;
    const b = m[i + 1]! / delta[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * delta[i]!;
      m[i + 1] = tau * b * delta[i]!;
    }
  }

  /*
   * Emitted one segment at a time rather than as a single path, so each leg can
   * be coloured on its own. Turning the whole line red said only "no"; colouring
   * the two stretches that went the wrong way says *where*, which is the part a
   * student can act on.
   */
  const out: string[] = [];
  for (let i = 0; i < n - 1; i++) {
    const third = h[i]! / 3;
    out.push(
      `M ${pts[i]!.x},${pts[i]!.y} C ${pts[i]!.x + third},${pts[i]!.y + m[i]! * third} ${
        pts[i + 1]!.x - third
      },${pts[i + 1]!.y - m[i + 1]! * third} ${pts[i + 1]!.x},${pts[i + 1]!.y}`,
    );
  }
  return out;
}

/** The shape, said out loud — see the live readout below the chart. */
const DIRECTION_WORD: Record<Direction, string> = {
  up: 'rises',
  flat: 'levels off',
  down: 'falls',
};

/**
 * Live correctness feedback, on trial.
 *
 * Deliberately an experiment: it scores the shape as the student drags,
 * exactly as the Draft Meter scores prose as they type. The argument against
 * is that a curve has one right answer where a paragraph has none, so a live
 * verdict can be brute-forced — wiggle a point, watch the number, stop when it
 * stops rising — which is the opposite of predicting. Flip this to false to
 * get the commit-then-reveal version back and compare them directly.
 */
const LIVE_FEEDBACK = true;

/** Aggregate only, like the Draft Meter's one line — never which leg is wrong. */
function matchLabel(matched: number, total: number): string {
  if (matched === total) return "that's it";
  // Before the total-1 check: with a single segment, nothing matched is also
  // one short of everything, and "almost there" for a wholly wrong answer lies.
  if (matched === 0) return 'not yet';
  if (matched === total - 1) return 'almost there';
  return 'getting closer';
}

function describeShape(directions: Direction[], untouched: boolean): string {
  if (untouched) return 'Nothing drawn yet.';
  if (directions.every((d) => d === 'flat')) return 'Your line is flat all the way across.';

  // Collapse runs, so four rising segments read as one climb rather than four.
  const runs: Direction[] = [];
  for (const d of directions) if (d !== runs[runs.length - 1]) runs.push(d);

  const words = runs.map((d) => DIRECTION_WORD[d]);
  return `Your line ${words.join(', then ')}.`;
}

export function DrawTheCurve({ spec, onComplete }: Props) {
  const points = spec.xAxis.points;

  /** Correct values in point order, tolerant of a generator that reorders them. */
  const actual = useMemo(
    () =>
      points.map((p) => {
        const match = spec.actual.find((a) => a.pointId === p.id);
        return Math.min(100, Math.max(0, match?.value ?? NEUTRAL_VALUE));
      }),
    [points, spec.actual],
  );

  const [values, setValues] = useState<number[]>(() => points.map(() => START_VALUE));
  // Tracked rather than inferred from `values`: the floor is a legitimate
  // answer, so a student who drags a point back down to it has still drawn.
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const telemetry = useWidgetTelemetry();
  const shownRef = useRef(false);
  const completedRef = useRef(false);

  // Guarded by a ref so a remount in development does not double-count.
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    telemetry.track({
      eventType: 'widget_shown',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: null,
      payload: { points: points.length },
    });
  }, [telemetry, spec, points.length]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const xOf = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const yOf = (v: number) => PAD.top + plotH - (v / 100) * plotH;

  const setValue = useCallback(
    (index: number, value: number) => {
      if (revealed) return;
      setTouched(true);
      setValues((prev) => {
        const clamped = Math.min(100, Math.max(0, Math.round(value)));
        // pointermove fires far faster than the value changes - while clamped
        // at either edge, or moving horizontally, every event would otherwise
        // allocate a new array and re-render the whole chart to no effect.
        if (prev[index] === clamped) return prev;
        const next = [...prev];
        next[index] = clamped;
        return next;
      });
    },
    [revealed],
  );

  /** Pointer y -> chart value, in viewBox space rather than screen pixels. */
  const valueFromClientY = useCallback((clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return NEUTRAL_VALUE;
    const rect = svg.getBoundingClientRect();
    const yInView = ((clientY - rect.top) / rect.height) * H;
    return ((PAD.top + plotH - yInView) / plotH) * 100;
  }, [plotH]);

  useEffect(() => {
    if (dragging === null) return;

    const move = (event: PointerEvent) => setValue(dragging, valueFromClientY(event.clientY));
    const up = () => setDragging(null);

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, setValue, valueFromClientY]);

  /**
   * Segment-by-segment direction match — the whole verdict. Heights are never
   * compared, only whether each leg goes the same way as the real curve.
   */
  const segments = useMemo(
    () =>
      points.slice(0, -1).map((_, i) => ({
        mine: directionOf(values[i]!, values[i + 1]!),
        theirs: directionOf(actual[i]!, actual[i + 1]!),
      })),
    [points, values, actual],
  );
  const wrongSegments = segments.filter((s) => s.mine !== s.theirs).length;
  // A chart with no segments has nothing to get right, so it must not report
  // success — `wrongSegments === 0` alone is vacuously true there.
  const allRight = segments.length > 0 && wrongSegments === 0;

  const commit = useCallback(() => {
    setRevealed(true);
    setAttempts((a) => a + 1);

    telemetry.track({
      eventType: 'answer_checked',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: allRight,
      payload: {
        attempt: attempts + 1,
        // Which legs went the wrong way is the diagnostic part — a single
        // reversed segment is a different error from an inverted whole curve.
        wrongSegments,
        shape: segments.map((s) => s.mine).join(','),
        ...(allRight ? {} : { misconception: spec.hint }),
      },
    });

    // Reported on every commit, right or wrong — unlike the other widgets,
    // the shape a student *predicted* is the thing worth talking about, and a
    // wrong prediction says more about what they believe than a right one.
    reportToConversation(
      [
        `The student predicted a shape for "${spec.yAxis.label}" across "${spec.xAxis.label}".`,
        `Situation: ${spec.setup}`,
        `They drew a line that ${describeShape(segments.map((s) => s.mine), false).replace(/^Your line /, '')}`,
        allRight
          ? 'That matches the real curve.'
          : `The real curve ${describeShape(segments.map((s) => s.theirs), false).replace(/^Your line /, '')} ${wrongSegments} of ${segments.length} stretches went the wrong way.`,
      ].join(' '),
    );

    if (!allRight) return;
    onComplete?.(true);

    if (completedRef.current) return;
    completedRef.current = true;

    telemetry.track({
      eventType: 'widget_completed',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: true,
      payload: { attempts: attempts + 1 },
    });
    telemetry.flush();
  }, [telemetry, spec, allRight, attempts, wrongSegments, segments, onComplete]);

  const reset = useCallback(() => {
    setValues(points.map(() => START_VALUE));
    setRevealed(false);
    setTouched(false);
  }, [points]);

  const legs = (vals: number[]) => curveSegments(vals.map((v, i) => ({ x: xOf(i), y: yOf(v) })));
  const untouched = !touched;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      {/* Every fact the shape depends on lives here. Without it the task is
          unanswerable: a student cannot predict a pause they were never told
          about, and the hint would be scolding them for it. */}
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
        {spec.setup}
      </p>

      <div>
        <div className="min-w-0">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none"
            role="group"
            aria-label={`${spec.yAxis.label} against ${spec.xAxis.label}`}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <line
                key={v}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yOf(v)}
                y2={yOf(v)}
                className="stroke-border"
                strokeWidth={1}
              />
            ))}

            {/* Named ends rather than numbers: the scale is qualitative on
                purpose, so "calm → intense" tells a student more than 0 → 100. */}
            <text
              x={PAD.left - 12}
              y={yOf(100) + 5}
              textAnchor="end"
              className="fill-muted-foreground text-[15px]"
            >
              {spec.yAxis.highLabel}
            </text>
            <text
              x={PAD.left - 12}
              y={yOf(0) + 5}
              textAnchor="end"
              className="fill-muted-foreground text-[15px]"
            >
              {spec.yAxis.lowLabel}
            </text>
            <text
              transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}
              x={14}
              y={PAD.top + plotH / 2}
              textAnchor="middle"
              className="fill-foreground/70 text-[15px] font-medium"
            >
              {spec.yAxis.label}
            </text>

            {points.map((point, i) => (
              <text
                key={`x-${point.id}`}
                x={xOf(i)}
                y={H - PAD.bottom + 26}
                textAnchor="middle"
                className="fill-muted-foreground text-[15px]"
              >
                {point.label}
              </text>
            ))}
            <text
              x={PAD.left + plotW / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[14px]"
            >
              {spec.xAxis.label}
            </text>

            {/* The real curve, only after they have committed to their own. */}
            {revealed &&
              legs(actual).map((d, i) => (
                <path
                  key={`actual-${i}`}
                  d={d}
                  fill="none"
                  className="stroke-success"
                  strokeWidth={2.5}
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                />
              ))}

            {legs(values).map((d, i) => (
              <path
                key={`mine-${i}`}
                d={d}
                fill="none"
                className={
                  revealed && segments[i] && segments[i]!.mine !== segments[i]!.theirs
                    ? 'stroke-destructive'
                    : 'stroke-primary'
                }
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}

            {points.map((point, i) => (
              <g key={point.id}>
                <circle
                  cx={xOf(i)}
                  cy={yOf(values[i]!)}
                  r={dragging === i ? 7 : 5}
                  className={`fill-card stroke-primary ${revealed ? '' : 'cursor-grab'} transition-[r]`}
                  strokeWidth={2.5}
                />
                {/* The handle is a slider, so arrow keys work and a screen reader
                    reads a value — freehand drawing could never offer either. */}
                <circle
                  cx={xOf(i)}
                  cy={yOf(values[i]!)}
                  r={18}
                  fill="transparent"
                  role="slider"
                  tabIndex={revealed ? -1 : 0}
                  aria-label={`${point.label} — ${spec.yAxis.label}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={values[i]}
                  aria-valuetext={`${values[i]} out of 100, between ${spec.yAxis.lowLabel} and ${spec.yAxis.highLabel}`}
                  aria-disabled={revealed}
                  className={revealed ? '' : 'cursor-grab focus-visible:outline-none'}
                  onPointerDown={(event) => {
                    if (revealed) return;
                    event.preventDefault();
                    setDragging(i);
                  }}
                  onKeyDown={(event) => {
                    if (revealed) return;
                    const step = event.shiftKey ? 20 : 5;
                    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                      event.preventDefault();
                      setValue(i, values[i]! + step);
                    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                      event.preventDefault();
                      setValue(i, values[i]! - step);
                    }
                  }}
                />
                {/* Focus ring drawn manually — an SVG circle can't carry one. */}
                <circle
                  cx={xOf(i)}
                  cy={yOf(values[i]!)}
                  r={11}
                  fill="none"
                  className="stroke-ring opacity-0 focus-within:opacity-100"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/*
        Live, but describing rather than judging. A running verdict would let a
        student wiggle a point until it went green, which is the opposite of
        predicting — so this says what shape they have drawn, in the words a
        graph question would use, and stays silent about whether it is right.
        Naming your own curve is most of the skill being taught anyway.
      */}
      {!revealed && (
        <div className="flex flex-col gap-2">
          {/* The Draft Meter's row, transplanted: one track, one warm label, and
              no per-part breakdown. Live from the first drag. */}
          {LIVE_FEEDBACK && !untouched && segments.length > 0 && (
            <div className="flex items-center gap-3.5">
              <div className="relative h-2 flex-1 rounded-full bg-muted">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${
                    allRight ? 'bg-success' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.max(4, ((segments.length - wrongSegments) / segments.length) * 100)}%`,
                  }}
                />
              </div>
              <span
                aria-live="polite"
                className={`w-[104px] shrink-0 text-right text-xs font-semibold transition-colors ${
                  allRight ? 'text-success' : 'text-muted-foreground'
                }`}
              >
                {matchLabel(segments.length - wrongSegments, segments.length)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              aria-live={LIVE_FEEDBACK ? 'off' : 'polite'}
              className="text-sm font-medium text-foreground"
            >
              {describeShape(segments.map((s) => s.mine), untouched)}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag each point, or tab to one and use the arrow keys.
            </p>
          </div>
        </div>
      )}

      {revealed && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
            allRight
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-border bg-muted text-foreground'
          }`}
        >
          {allRight ? (
            <>
              <span className="mb-1 flex items-center gap-1.5 font-semibold">
                <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" className="fill-success" />
                  <path
                    d="M6 10.5l2.5 2.5L14 7.5"
                    fill="none"
                    className="stroke-background"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                That&apos;s the shape
              </span>
              {spec.reveal}
            </>
          ) : (
            <>
              <span className="font-medium">
                {wrongSegments === 1
                  ? "One stretch goes the wrong way — it's marked in red."
                  : `${wrongSegments} stretches go the wrong way — they're marked in red.`}
              </span>{' '}
              {spec.hint}
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!revealed ? (
          <Button size="sm" onClick={commit} disabled={untouched}>
            Show me the real one
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={reset}>
            {allRight ? 'Try it again' : 'Reshape it'}
          </Button>
        )}
      </div>
    </div>
  );
}
