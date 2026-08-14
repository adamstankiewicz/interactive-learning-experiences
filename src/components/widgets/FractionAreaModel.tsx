'use client';

import { useMemo, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { FractionAreaModelSpec } from '@/lib/pathway/schema';

/**
 * Partition a whole into equal parts, then select parts to build a target
 * fraction. Choosing the denominator is part of the work: getting 3/4 by
 * selecting 6 of 8 parts is a different (and revealing) answer than 3 of 4.
 */
export function FractionAreaModel({ spec }: { spec: FractionAreaModelSpec }) {
  const [denominator, setDenominator] = useState(spec.denominatorChoices[0] ?? spec.denominator);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);

  const target = spec.numerator / spec.denominator;
  const current = selected.size / denominator;
  const isCorrect = Math.abs(current - target) < 1e-9;

  // An equivalent-but-not-identical answer is pedagogically interesting, so it
  // gets its own message rather than being lumped in with "wrong".
  const isEquivalentForm = isCorrect && denominator !== spec.denominator;

  const parts = useMemo(() => Array.from({ length: denominator }, (_, i) => i), [denominator]);

  function toggle(index: number) {
    setChecked(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function repartition(value: number) {
    setDenominator(value);
    setSelected(new Set());
    setChecked(false);
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
          <Button size="lg" onClick={() => setChecked(true)} disabled={selected.size === 0}>
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
