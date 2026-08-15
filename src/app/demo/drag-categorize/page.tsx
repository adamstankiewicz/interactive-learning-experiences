'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { DragCategorize, varyDragCategorize } from '@/components/widgets/DragCategorize';
import type { DragCategorizeSpec } from '@/lib/pathway/schema';

const DEMO_SPEC: DragCategorizeSpec = {
  kind: 'drag-categorize',
  learningComponentId: null,
  prompt: 'Sort each organism into the correct kingdom.',
  categories: [
    { id: 'animal', label: 'Animalia' },
    { id: 'plant', label: 'Plantae' },
    { id: 'fungi', label: 'Fungi' },
    { id: 'protist', label: 'Protista' },
  ],
  items: [
    { id: 'eagle', label: 'Bald eagle', categoryId: 'animal' },
    { id: 'octopus', label: 'Octopus', categoryId: 'animal' },
    { id: 'fern', label: 'Fern', categoryId: 'plant' },
    { id: 'moss', label: 'Moss', categoryId: 'plant' },
    { id: 'mushroom', label: 'Mushroom', categoryId: 'fungi' },
    { id: 'yeast', label: 'Yeast', categoryId: 'fungi' },
    { id: 'kelp', label: 'Giant kelp', categoryId: 'protist' },
    { id: 'amoeba', label: 'Amoeba', categoryId: 'protist' },
  ],
  successMessage:
    'Correct! Animals are multicellular heterotrophs. Plants are multicellular autotrophs. Fungi decompose organic matter and absorb nutrients. Protists are a diverse group of mostly unicellular eukaryotes that don\'t fit the other kingdoms.',
  hint: 'Remember: fungi are not plants — they can\'t photosynthesize. And kelp, despite looking plant-like, is classified as a protist because it lacks true roots, stems, and leaves.',
};

export default function DragCategorizeDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const [key, setKey] = useState(0);
  const [variation, setVariation] = useState(100);
  const spec = useMemo(() => varyDragCategorize(DEMO_SPEC, variation), [variation]);

  function handleComplete(correct: boolean) {
    setEvents((prev) => [
      `onComplete fired — ${correct ? 'all items correct' : 'incorrect placement'}`,
      ...prev,
    ]);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Drag &amp; Categorize</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag items from the bank into the correct category column, then submit. An{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">onComplete</code>{' '}
          event fires when all items are placed correctly.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Fewer items</span>
        <Slider
          value={[variation]}
          onValueChange={(next) => {
            setVariation(Array.isArray(next) ? next[0] : next);
            setKey((k) => k + 1);
            setEvents([]);
          }}
          min={0}
          max={100}
          step={1}
          className="flex-1"
          aria-label="Variation"
        />
        <span className="text-xs font-medium text-muted-foreground">More items</span>
      </div>

      {/* Keyed on item count too: dragging the slider mid-attempt should reset the
          board rather than leave stale placements pointing at trimmed items. */}
      <DragCategorize key={`${key}-${spec.items.length}`} spec={spec} onComplete={handleComplete} />

      {events.length > 0 && (
        <div className="mt-8 flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Events emitted
          </p>
          {events.map((e, i) => (
            <Alert key={i} variant="default">
              <AlertDescription className="font-mono text-xs">{e}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => {
            setKey((k) => k + 1);
            setEvents([]);
          }}
        >
          Reset demo
        </button>
      </div>
    </main>
  );
}
