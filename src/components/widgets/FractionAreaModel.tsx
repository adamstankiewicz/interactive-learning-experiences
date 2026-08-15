'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import { cn } from '@/lib/utils';
import type { FractionAreaModelSpec } from '@/lib/pathway/schema';

/**
 * Derives a harder or easier instance of the same widget from a slider
 * position — a pure remap of the spec, no model call, and no invented
 * content. It only ever selects a denominator from `denominatorChoices`
 * the model already grounded for this standard; level 0-100 maps linearly
 * onto that list, ascending. `numerator` is always `denominator - 1`
 * ("build all but one part") — a fixed formula, not a per-tier hand-picked
 * number — so larger denominators stay hard to eyeball rather than needing
 * their own authored target. The same level always derives the same spec,
 * so dragging back to a position is a stable, revisitable state.
 *
 * This is the "variation" half of a difficulty knob: it changes how hard
 * the same skill is, never which standard is being taught, so it never
 * needs re-grounding against the graph the way a structural change would.
 */
export function varyFractionAreaModel(base: FractionAreaModelSpec, level: number): FractionAreaModelSpec {
  const choices = [...base.denominatorChoices].sort((a, b) => a - b);
  const index = Math.min(choices.length - 1, Math.floor((level / 100) * choices.length));
  const denominator = choices[index];
  const numerator = Math.max(1, denominator - 1);

  return {
    ...base,
    denominator,
    numerator,
    prompt: `Build ${numerator}/${denominator} using the ${base.representation} model.`,
    // successMessage/hint reference the old numerator/denominator by name, so they need
    // re-templating too — leaving them as `...base` would announce a correct 7/8 answer
    // as "you selected 3 out of 4 equal parts."
    successMessage: `Exactly right — you selected ${numerator} out of ${denominator} equal parts.`,
    hint: `Try selecting ${numerator} parts once you have split the bar into ${denominator} equal sections.`,
  };
}

/**
 * Partition a whole into equal parts, then select parts to build a target
 * fraction. Choosing the denominator is part of the work: getting 3/4 by
 * selecting 6 of 8 parts is a different (and revealing) answer than 3 of 4.
 */
export function FractionAreaModel({ spec }: { spec: FractionAreaModelSpec }) {
  const [denominator, setDenominator] = useState(spec.denominatorChoices[0] ?? spec.denominator);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);

  const telemetry = useWidgetTelemetry();
  const shownRef = useRef(false);
  const completedRef = useRef(false);

  const target = spec.numerator / spec.denominator;
  const current = selected.size / denominator;
  const isCorrect = Math.abs(current - target) < 1e-9;

  // An equivalent-but-not-identical answer is pedagogically interesting, so it
  // gets its own message rather than being lumped in with "wrong".
  const isEquivalentForm = isCorrect && denominator !== spec.denominator;

  const parts = useMemo(() => Array.from({ length: denominator }, (_, i) => i), [denominator]);

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
      payload: { target: `${spec.numerator}/${spec.denominator}`, choices: spec.denominatorChoices },
    });
  }, [telemetry, spec]);

  function toggle(index: number) {
    setChecked(false);

    const deselecting = selected.has(index);
    telemetry.track({
      eventType: 'part_selected',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: null,
      payload: {
        index,
        action: deselecting ? 'deselect' : 'select',
        selected: selected.size + (deselecting ? -1 : 1),
        denominator,
      },
    });

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function repartition(value: number) {
    // Which denominator the student reaches for is the partitioning skill
    // itself, so the change is worth recording even though nothing is answered.
    telemetry.track({
      eventType: 'partition_changed',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: null,
      payload: { from: denominator, to: value, matchesTarget: value === spec.denominator },
    });

    setDenominator(value);
    setSelected(new Set());
    setChecked(false);
  }

  function check() {
    if (checked) return;
    setChecked(true);

    telemetry.track({
      eventType: 'answer_checked',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: isCorrect,
      payload: {
        built: `${selected.size}/${denominator}`,
        target: `${spec.numerator}/${spec.denominator}`,
        equivalentForm: isEquivalentForm,
        // The hint names the misconception a wrong build reveals, and the
        // profile confirms a misconception only from a wrong answer carrying it.
        ...(isCorrect ? {} : { misconception: spec.hint }),
      },
    });

    if (!isCorrect || completedRef.current) return;
    completedRef.current = true;

    telemetry.track({
      eventType: 'widget_completed',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: true,
      payload: { equivalentForm: isEquivalentForm },
    });
    telemetry.flush();
  }

  return (
    <Card>
      <CardContent>
        <p className="text-base font-medium">{spec.prompt}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Partition into</span>
          <ToggleGroup
            variant="outline"
            value={[String(denominator)]}
            onValueChange={(value) => {
              // Base UI lets the pressed item be toggled back off, which would
              // leave the whole unpartitioned. Ignore that and keep the current
              // denominator; only a different choice repartitions.
              const next = value[0];
              if (next) repartition(Number(next));
            }}
          >
            {spec.denominatorChoices.map((choice) => (
              <ToggleGroupItem
                key={choice}
                value={String(choice)}
                aria-label={`${choice} equal parts`}
              >
                {choice}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="text-sm text-muted-foreground">equal parts</span>
        </div>

        {spec.representation === 'circle' ? (
          <CircleModel parts={parts} selected={selected} onToggle={toggle} />
        ) : (
          <BarModel parts={parts} selected={selected} onToggle={toggle} />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Selected <span className="font-semibold text-foreground">{selected.size}</span> of size{' '}
            <span className="font-semibold text-foreground">1/{denominator}</span>
            {selected.size > 0 && (
              <>
                {' '}
                &rarr;{' '}
                <span className="font-semibold text-foreground">
                  {selected.size}/{denominator}
                </span>
              </>
            )}
          </p>
          <Button size="lg" onClick={check} disabled={selected.size === 0}>
            Check
          </Button>
        </div>

        {checked && (
          <Alert
            role="status"
            variant={isCorrect ? 'success' : 'warning'}
            className="mt-3"
          >
            <AlertDescription>
              {isCorrect
                ? isEquivalentForm
                  ? `${selected.size}/${denominator} is equivalent to ${spec.numerator}/${spec.denominator} — the same amount of the whole. Can you also build it with ${spec.denominator} parts?`
                  : spec.successMessage
                : spec.hint}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

type ModelProps = {
  parts: number[];
  selected: Set<number>;
  onToggle: (index: number) => void;
};

function BarModel({ parts, selected, onToggle }: ModelProps) {
  return (
    <div className="mt-4 flex h-24 w-full overflow-hidden rounded-lg border-2 border-foreground">
      {parts.map((index) => (
        <button
          key={index}
          type="button"
          onClick={() => onToggle(index)}
          aria-label={`Part ${index + 1}`}
          aria-pressed={selected.has(index)}
          className={cn(
            'flex-1 border-r-2 border-foreground transition last:border-r-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            selected.has(index) ? 'bg-selected hover:bg-selected/80' : 'bg-card hover:bg-muted',
          )}
        />
      ))}
    </div>
  );
}

function CircleModel({ parts, selected, onToggle }: ModelProps) {
  const n = parts.length;
  const radius = 90;
  const center = 100;

  return (
    <div className="mt-4 flex justify-center text-foreground">
      <svg viewBox="0 0 200 200" className="h-52 w-52" role="group" aria-label="Fraction circle">
        {parts.map((index) => {
          const start = (index / n) * 2 * Math.PI - Math.PI / 2;
          const end = ((index + 1) / n) * 2 * Math.PI - Math.PI / 2;
          const x1 = center + radius * Math.cos(start);
          const y1 = center + radius * Math.sin(start);
          const x2 = center + radius * Math.cos(end);
          const y2 = center + radius * Math.sin(end);
          const largeArc = end - start > Math.PI ? 1 : 0;

          // A single-part "wedge" is the whole circle; draw it as one rather
          // than an arc with coincident endpoints.
          const d =
            n === 1
              ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
              : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

          return (
            <path
              key={index}
              d={d}
              onClick={() => onToggle(index)}
              role="button"
              aria-label={`Part ${index + 1}`}
              aria-pressed={selected.has(index)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggle(index);
                }
              }}
              className={cn(
                'cursor-pointer transition focus-visible:outline-2 focus-visible:outline-ring',
                selected.has(index) ? 'fill-selected' : 'fill-card',
              )}
              stroke="currentColor"
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
}
