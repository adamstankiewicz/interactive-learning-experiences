'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { Crossword, varyCrossword } from '@/components/widgets/Crossword';
import type { CrosswordSpec } from '@/lib/pathway/schema';

/**
 * Real output: this is what the pipeline generated for 3.NF.A.1, prerequisite
 * attributions and all. The grid is not in the spec — the widget interlocks
 * these terms itself — so a demo spec is just terms and clues.
 */
const DEMO_SPEC: CrosswordSpec = {
  kind: 'crossword',
  learningComponentId: null,
  title: 'Fraction vocabulary',
  prompt: 'Complete the crossword by filling in vocabulary terms about fractions and equal parts.',
  entries: [
    {
      answer: 'NUMERATOR',
      clue: 'The top number in a fraction that tells how many parts you have',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'DENOMINATOR',
      clue: 'The bottom number in a fraction that tells how many equal parts the whole is divided into',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'EQUAL',
      clue: 'Parts of a whole must be this same size, even if their shapes are different',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'UNIT',
      clue: 'A fraction like one-fourth or one-third that has 1 as its top number',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'WHOLE',
      clue: 'The complete object or shape that is divided into equal parts',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'THIRDS',
      clue: 'Three equal parts that make up one whole',
      source: 'prerequisite',
      sourceCode: '2.G.A.3',
    },
    {
      answer: 'FOURTHS',
      clue: 'Four equal parts that make up one whole',
      source: 'prerequisite',
      sourceCode: '2.G.A.3',
    },
    {
      answer: 'PARTITION',
      clue: 'To divide a shape into equal shares or parts',
      source: 'prerequisite',
      sourceCode: '2.G.A.3',
    },
    {
      answer: 'SHARES',
      clue: 'Equal parts of a whole that can be divided among people',
      source: 'prerequisite',
      sourceCode: '2.G.A.3',
    },
    {
      answer: 'SIZE',
      clue: 'How big each part is, which must be the same for all equal parts',
      source: 'prerequisite',
      sourceCode: '2.G.A.3',
    },
    {
      answer: 'PART',
      clue: 'One piece of a whole that has been divided up',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'QUANTITY',
      clue: 'An amount that can be measured or counted',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
    {
      answer: 'FORMED',
      clue: 'Made or created by putting pieces together',
      source: 'anchor',
      sourceCode: '3.NF.A.1',
    },
  ],
  successMessage:
    'Excellent work! You know the key vocabulary for understanding fractions as equal parts of a whole.',
};

export default function CrosswordDemo() {
  const [variation, setVariation] = useState(100);
  const spec = useMemo(() => varyCrossword(DEMO_SPEC, variation), [variation]);

  return (
    // Wider than the other demos: this widget is built for the pathway column,
    // and a grid worth solving needs most of it.
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Crossword</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Type to fill a square and move on; <kbd className="rounded bg-muted px-1 font-mono text-xs">Tab</kbd>{' '}
          moves between answers, the arrow keys move between squares, and clicking a crossing square a
          second time switches between its across and down clue. Each clue names the standard its term
          came from.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Smaller puzzle</span>
        <Slider
          value={[variation]}
          onValueChange={(next) => setVariation(Array.isArray(next) ? next[0] : next)}
          min={0}
          max={100}
          step={1}
          className="flex-1"
          aria-label="Variation"
        />
        <span className="text-xs font-medium text-muted-foreground">Larger puzzle</span>
      </div>

      <Crossword key={spec.entries.length} spec={spec} />
    </main>
  );
}
