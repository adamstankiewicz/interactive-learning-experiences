'use client';

import { z } from 'zod';
import { schema } from '@json-render/react/schema';
import { defineCatalog, type ComputedFunction } from '@json-render/core';
import { defineRegistry } from '@json-render/react';

import type { Band } from '@/lib/draft-meter/schema';

/**
 * The json-render half of the prototype: one catalog entry standing in for
 * `DraftMeter.tsx`'s meter (the fill bar + label, not the textarea — typing
 * stays plain React, see the page component). Proves the shape Phase 3a
 * would use for all six widgets: a Zod-schema'd component plus named
 * `$computed` functions the spec can reference by name, never inline logic
 * the model could smuggle expressions through.
 */
export const catalog = defineCatalog(schema, {
  components: {
    ScoreMeter: {
      props: z.object({
        fill: z.number(),
        label: z.string(),
        tone: z.enum(['unscored', 'developing', 'approaching', 'proficient', 'advanced']),
        checking: z.boolean(),
      }),
      description: 'The live score meter: a fill bar and a label, driven by state.',
    },
  },
  actions: {},
});

const IDLE_FILL = 5;

/**
 * Same math as the production `DraftMeter`'s inline `fill` calc — registered
 * by name instead of written inline in the component, so a generated spec
 * can reference it (`{ "$computed": "meterFill", "args": {...} }`) without
 * the model ever writing the arithmetic itself.
 */
const meterFill: ComputedFunction = (args) => {
  const checking = Boolean(args.checking);
  const score = typeof args.score === 'number' ? args.score : null;
  if (checking || score === null) return IDLE_FILL;
  return Math.max(score, IDLE_FILL);
};

/** Mirrors `meterTone` — same four-band ramp, registered instead of inlined. */
const meterTone: ComputedFunction = (args) => {
  const checking = Boolean(args.checking);
  const band = args.band as Band | null;
  if (checking || !band) return 'unscored';
  return band;
};

const meterLabel: ComputedFunction = (args) => {
  if (args.checking) return 'checking…';
  if (typeof args.label === 'string' && args.label) return args.label;
  return 'just starting';
};

export const computedFunctions: Record<string, ComputedFunction> = {
  meterFill,
  meterTone,
  meterLabel,
};

const TONE_CLASS: Record<string, { fill: string; label: string }> = {
  unscored: { fill: 'bg-muted-foreground/40', label: 'text-muted-foreground' },
  developing: { fill: 'bg-destructive', label: 'text-destructive' },
  approaching: { fill: 'bg-warning', label: 'text-warning' },
  proficient: { fill: 'bg-selected', label: 'text-selected' },
  advanced: { fill: 'bg-success', label: 'text-success' },
};

export const { registry } = defineRegistry(catalog, {
  components: {
    ScoreMeter: ({ props }) => {
      const tone = TONE_CLASS[props.tone] ?? TONE_CLASS.unscored;
      return (
        <div className="flex items-center gap-3.5">
          <div
            role="progressbar"
            aria-label="Response strength"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={props.checking ? undefined : props.fill}
            className={`relative h-2 flex-1 rounded-full bg-muted ${props.checking ? 'animate-pulse' : ''}`}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ${tone.fill}`}
              style={{ width: `${props.fill}%` }}
            />
          </div>
          <span role="status" className={`w-[104px] shrink-0 text-right text-xs font-semibold ${tone.label}`}>
            {props.label}
          </span>
        </div>
      );
    },
  },
});
