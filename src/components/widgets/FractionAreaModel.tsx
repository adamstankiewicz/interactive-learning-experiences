'use client';

import { useMemo, useState } from 'react';

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
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-base font-medium text-slate-900 dark:text-slate-100">{spec.prompt}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">Partition into</span>
        {spec.denominatorChoices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => repartition(choice)}
            aria-pressed={denominator === choice}
            className={`h-8 w-8 rounded-md border text-sm font-medium transition ${
              denominator === choice
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {choice}
          </button>
        ))}
        <span className="text-sm text-slate-600 dark:text-slate-400">equal parts</span>
      </div>

      {spec.representation === 'circle' ? (
        <CircleModel parts={parts} selected={selected} onToggle={toggle} />
      ) : (
        <BarModel parts={parts} selected={selected} onToggle={toggle} />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Selected{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{selected.size}</span> of size{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">1/{denominator}</span>
          {selected.size > 0 && (
            <>
              {' '}
              &rarr;{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selected.size}/{denominator}
              </span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setChecked(true)}
          disabled={selected.size === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Check
        </button>
      </div>

      {checked && (
        <p
          role="status"
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            isCorrect
              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
          }`}
        >
          {isCorrect
            ? isEquivalentForm
              ? `${selected.size}/${denominator} is equivalent to ${spec.numerator}/${spec.denominator} — the same amount of the whole. Can you also build it with ${spec.denominator} parts?`
              : spec.successMessage
            : spec.hint}
        </p>
      )}
    </div>
  );
}

type ModelProps = {
  parts: number[];
  selected: Set<number>;
  onToggle: (index: number) => void;
};

function BarModel({ parts, selected, onToggle }: ModelProps) {
  return (
    <div className="mt-4 flex h-24 w-full overflow-hidden rounded-lg border-2 border-slate-900 dark:border-slate-100">
      {parts.map((index) => (
        <button
          key={index}
          type="button"
          onClick={() => onToggle(index)}
          aria-label={`Part ${index + 1}`}
          aria-pressed={selected.has(index)}
          className={`flex-1 border-r-2 border-slate-900 transition last:border-r-0 dark:border-slate-100 ${
            selected.has(index)
              ? 'bg-sky-500 hover:bg-sky-600'
              : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700'
          }`}
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
    <div className="mt-4 flex justify-center">
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
              className={`cursor-pointer transition ${
                selected.has(index) ? 'fill-sky-500' : 'fill-white dark:fill-slate-800'
              }`}
              stroke="currentColor"
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
}
