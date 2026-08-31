'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Composed } from '@/components/widgets/Composed';
import type { ComposedSpec } from '@/lib/pathway/schema';

/**
 * The composed kind, demonstrated with hand-written compositions — the same
 * primitive alphabet the generator authors with (issue #100). What the
 * pipeline generates live varies; these two pin the shapes a reviewer
 * should recognize: a gated walkthrough and a browsable reveal deck.
 */

const EXAMPLES: { label: string; spec: ComposedSpec }[] = [
  {
    label: 'Gated walkthrough',
    spec: {
      kind: 'composed',
      learningComponentId: null,
      title: 'Comparing fractions, one step at a time',
      components: [
        {
          type: 'Sequence',
          id: 'root',
          policy: { order: 'linear', disclosure: 'gated', revealed: 'accumulate' },
          children: ['s1', 's2', 's3', 's4'],
        },
        { type: 'Group', id: 's1', children: ['s1-text', 's1-why'] },
        {
          type: 'Text',
          id: 's1-text',
          text: 'Both fractions have the same denominator, **6**. That means both wholes are cut into six equal parts.',
          variant: null,
        },
        {
          type: 'Callout',
          id: 's1-why',
          intent: 'why',
          label: 'Why?',
          text: 'Comparing only works when the pieces are the same size.',
        },
        {
          type: 'Text',
          id: 's2',
          text: 'Now compare the numerators: **2** and **5**. Every piece is the same size, so five pieces is more than two.',
          variant: null,
        },
        {
          type: 'Text',
          id: 's3',
          text: 'So **5/6 > 2/6** — same-size pieces, more of them.',
          variant: null,
        },
        {
          type: 'Check',
          id: 's4',
          prompt: 'Your turn: which is bigger, **3/8 or 5/8**?',
          options: [
            { text: '3/8', feedback: 'same-size eighths — three of them is fewer.' },
            { text: '5/8', feedback: 'same-size pieces, more of them.' },
            { text: "Can't tell", feedback: 'you can — the denominators match, so compare numerators.' },
          ],
          answer: 1,
        },
      ],
    },
  },
  {
    label: 'Reveal deck',
    spec: {
      kind: 'composed',
      learningComponentId: null,
      title: 'Predict, then check',
      components: [
        {
          type: 'Sequence',
          id: 'root',
          policy: { order: 'free', disclosure: 'all', revealed: 'replace' },
          children: ['c1', 'c2'],
        },
        { type: 'Reveal', id: 'c1', faces: [{ title: 'Front', child: 'c1-q' }, { title: 'Back', child: 'c1-a' }] },
        { type: 'Text', id: 'c1-q', text: 'Which is bigger: 1/3 or 1/4?', variant: null },
        { type: 'Text', id: 'c1-a', text: '**1/3** — fewer pieces means bigger pieces.', variant: null },
        { type: 'Reveal', id: 'c2', faces: [{ title: 'Front', child: 'c2-q' }, { title: 'Back', child: 'c2-a' }] },
        { type: 'Text', id: 'c2-q', text: 'Is 2/4 the same as 1/2?', variant: null },
        { type: 'Text', id: 'c2-a', text: 'Yes — **equivalent fractions** name the same amount.', variant: null },
      ],
    },
  },
  {
    label: 'Mini games',
    spec: {
      kind: 'composed',
      learningComponentId: null,
      title: 'Fraction games',
      components: [
        { type: 'Group', id: 'root', children: ['m1', 'h1'] },
        {
          type: 'Match',
          id: 'm1',
          prompt: 'Match each fraction to its equivalent.',
          pairs: [
            { left: '1/2', right: '4/8' },
            { left: '1/3', right: '2/6' },
            { left: '3/4', right: '6/8' },
          ],
        },
        {
          type: 'Hunt',
          id: 'h1',
          prompt: 'Tap every fraction equivalent to one half.',
          items: [
            { text: '2/4', target: true, feedback: 'two of four equal parts is half.' },
            { text: '3/5', target: false, feedback: 'three fifths is more than half.' },
            { text: '5/10', target: true, feedback: 'five of ten equal parts is half.' },
            { text: '2/3', target: false, feedback: 'two thirds is more than half.' },
            { text: '4/8', target: true, feedback: 'four of eight equal parts is half.' },
            { text: '1/3', target: false, feedback: 'one third is less than half.' },
          ],
        },
      ],
    },
  },
];

export default function ComposedDemoPage() {
  const [example, setExample] = useState(0);
  const [completions, setCompletions] = useState(0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="mb-2 text-sm text-muted-foreground">
        <Link href="/demo" className="underline">
          ← all demos
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-semibold">Composed</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        An activity assembled from pedagogical primitives — the model authors the composition tree,
        human-written renderers draw it, and the structural gate refuses unsound trees. Nothing in
        the v1 alphabet measures, so completion is the only signal (completions this session:{' '}
        {completions}).
      </p>
      <div className="mb-6 flex gap-2">
        {EXAMPLES.map((entry, i) => (
          <button
            key={entry.label}
            type="button"
            onClick={() => setExample(i)}
            className={
              i === example
                ? 'rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground'
                : 'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground'
            }
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Composed
        key={example}
        spec={EXAMPLES[example].spec}
        onComplete={() => setCompletions((n) => n + 1)}
      />
    </main>
  );
}
