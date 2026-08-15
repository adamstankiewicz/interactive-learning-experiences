'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
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

/** Everyone starts flat down the middle, so any shape is a deliberate move. */
const START_VALUE = 50;

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

export function DrawTheCurve({ spec, onComplete }: Props) {
  const points = spec.xAxis.points;

  /** Correct values in point order, tolerant of a generator that reorders them. */
  const actual = useMemo(
    () =>
      points.map((p) => {
        const match = spec.actual.find((a) => a.pointId === p.id);
        return Math.min(100, Math.max(0, match?.value ?? START_VALUE));
      }),
    [points, spec.actual],
  );

  const [values, setValues] = useState<number[]>(() => points.map(() => START_VALUE));
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
      setValues((prev) => {
        const next = [...prev];
        next[index] = Math.min(100, Math.max(0, Math.round(value)));
        return next;
      });
    },
    [revealed],
  );

  /** Pointer y -> chart value, in viewBox space rather than screen pixels. */
  const valueFromClientY = useCallback((clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return START_VALUE;
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
  const allRight = wrongSegments === 0;

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
  }, [points]);

  const line = (vals: number[]) => vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const untouched = values.every((v) => v === START_VALUE);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

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
            {revealed && (
              <polyline
                points={line(actual)}
                fill="none"
                className="stroke-success"
                strokeWidth={3}
                strokeDasharray="7 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            <polyline
              points={line(values)}
              fill="none"
              className={revealed && !allRight ? 'stroke-destructive' : 'stroke-primary'}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point, i) => (
              <g key={point.id}>
                <circle
                  cx={xOf(i)}
                  cy={yOf(values[i]!)}
                  r={dragging === i ? 11 : 8}
                  className={`fill-card ${
                    revealed && !allRight ? 'stroke-destructive' : 'stroke-primary'
                  } ${revealed ? '' : 'cursor-grab'}`}
                  strokeWidth={3}
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
                  r={14}
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

      {!revealed && (
        <p className="text-xs text-muted-foreground">
          Drag each point up or down — or tab to one and use the arrow keys.
        </p>
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
            spec.reveal
          ) : (
            <>
              <span className="font-medium">
                {wrongSegments === 1
                  ? 'One stretch goes the wrong way.'
                  : `${wrongSegments} stretches go the wrong way.`}
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
