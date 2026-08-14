'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { DragSort } from '@/components/widgets/DragSort';
import type { DragSortSpec } from '@/lib/pathway/schema';

const DEMO_SPEC: DragSortSpec = {
  kind: 'drag-sort',
  learningComponentId: null,
  prompt: 'Order the planets from closest to the Sun to farthest.',
  items: [
    { id: 'mars', label: 'Mars' },
    { id: 'mercury', label: 'Mercury' },
    { id: 'neptune', label: 'Neptune' },
    { id: 'venus', label: 'Venus' },
    { id: 'saturn', label: 'Saturn' },
    { id: 'earth', label: 'Earth' },
    { id: 'uranus', label: 'Uranus' },
    { id: 'jupiter', label: 'Jupiter' },
  ],
  correctOrder: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'],
  successMessage:
    'Correct! A helpful mnemonic: "My Very Educated Mother Just Served Us Nachos." Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune — in order from the Sun.',
  hint: 'Try grouping them: the rocky inner planets (Mercury through Mars) come before the gas giants (Jupiter and Saturn) and ice giants (Uranus and Neptune).',
};

export default function DragSortDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const [key, setKey] = useState(0);

  function handleComplete(correct: boolean) {
    setEvents((prev) => [
      `onComplete fired — ${correct ? 'correct order' : 'incorrect order'}`,
      ...prev,
    ]);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Drag &amp; Sort</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag planets into order from closest to farthest from the Sun, then submit to check. An{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">onComplete</code>{' '}
          event fires when the student confirms a correct arrangement.
        </p>
      </div>

      <DragSort key={key} spec={DEMO_SPEC} onComplete={handleComplete} />

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
