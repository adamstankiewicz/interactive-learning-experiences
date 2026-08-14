'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { SwiperFlashcard } from '@/components/widgets/SwiperFlashcard';
import type { SwiperFlashcardSpec } from '@/lib/pathway/schema';

const DEMO_SPEC: SwiperFlashcardSpec = {
  kind: 'swiper-flashcard',
  learningComponentId: null,
  cards: [
    {
      question: 'What landform is created when two continental plates collide head-on?',
      upLabel: 'Mountain range',
      downLabel: 'Ocean trench',
      correctDirection: 'up',
      explanation: 'When two continental plates converge, neither can subduct easily — the crust buckles and folds upward into mountain ranges. The Himalayas formed this way when India collided with Asia.',
    },
    {
      question: 'What process creates new oceanic crust at a divergent boundary?',
      upLabel: 'Subduction',
      downLabel: 'Seafloor spreading',
      correctDirection: 'down',
      explanation: 'At divergent boundaries, magma wells up through the gap as plates pull apart and hardens into new oceanic crust — a process called seafloor spreading. The Mid-Atlantic Ridge is the most studied example.',
    },
    {
      question: 'What happens to the denser plate at a subduction zone?',
      upLabel: 'It melts into the mantle',
      downLabel: 'It rises to form mountains',
      correctDirection: 'up',
      explanation: 'The denser oceanic plate is forced beneath the lighter plate and sinks into the hot mantle, where it melts. This recycling of crust is why oceanic plates are much younger than continental ones.',
    },
    {
      question: 'Which type of boundary is most associated with rift valleys and mid-ocean ridges?',
      upLabel: 'Convergent boundary',
      downLabel: 'Divergent boundary',
      correctDirection: 'down',
      explanation: 'Divergent boundaries are where plates pull apart. On land this creates rift valleys like the East African Rift; under the ocean it creates mid-ocean ridges like the Mid-Atlantic Ridge.',
    },
    {
      question: 'What forms in the ocean above a subducting plate as it melts back into the mantle?',
      upLabel: 'Volcanic island arc',
      downLabel: 'Rift valley',
      correctDirection: 'up',
      explanation: 'As the subducting plate melts, magma rises through the overlying plate and erupts on the seafloor, building chains of volcanic islands — called island arcs. The Aleutian Islands and Japan are examples.',
    },
    {
      question: 'The San Andreas Fault is neither convergent nor divergent. What type of boundary is it?',
      upLabel: 'Transform boundary',
      downLabel: 'Subduction zone',
      correctDirection: 'up',
      explanation: 'Transform boundaries occur where plates slide horizontally past each other. No crust is created or destroyed — instead, enormous friction builds up and releases as earthquakes. The San Andreas is one of the most studied transform faults on Earth.',
    },
  ],
};

type CardResult = {
  cardIndex: number;
  direction: 'up' | 'down';
  correct: boolean;
};

export default function SwiperFlashcardDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const [key, setKey] = useState(0);

  function handleComplete(results: CardResult[]) {
    const correct = results.filter((r) => r.correct).length;
    setEvents((prev) => [
      `onComplete fired — ${correct}/${results.length} correct`,
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
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Swiper Flashcard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sort each clue into the correct plate boundary type. Drag the card up or down — or use the buttons. An{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">onComplete</code>{' '}
          event fires when all cards are answered.
        </p>
      </div>

      <SwiperFlashcard key={key} spec={DEMO_SPEC} onComplete={handleComplete} />

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
