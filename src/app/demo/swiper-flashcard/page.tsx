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
      question: 'Is 7 a prime number?',
      leftLabel: 'False',
      rightLabel: 'True',
      correctDirection: 'right',
      explanation: 'Correct! 7 is prime — its only factors are 1 and 7.',
    },
    {
      question: 'Is 9 a prime number?',
      leftLabel: 'False',
      rightLabel: 'True',
      correctDirection: 'left',
      explanation: '9 is not prime. It equals 3 × 3, so it has a factor besides 1 and itself.',
    },
    {
      question: 'Is 2 a prime number?',
      leftLabel: 'False',
      rightLabel: 'True',
      correctDirection: 'right',
      explanation: 'Yes! 2 is the only even prime number. Its only factors are 1 and 2.',
    },
    {
      question: 'Is 1 a prime number?',
      leftLabel: 'False',
      rightLabel: 'True',
      correctDirection: 'left',
      explanation:
        '1 is not prime. By definition, a prime must have exactly two distinct factors. 1 only has one factor: itself.',
    },
    {
      question: 'Is 15 a prime number?',
      leftLabel: 'False',
      rightLabel: 'True',
      correctDirection: 'left',
      explanation: '15 = 3 × 5, so it has factors besides 1 and itself. Not prime.',
    },
    {
      question: 'Is 11 a prime number?',
      leftLabel: 'False',
      rightLabel: 'True',
      correctDirection: 'right',
      explanation: 'Yes — 11 is prime. No whole number between 2 and 10 divides it evenly.',
    },
  ],
};

type CardResult = {
  cardIndex: number;
  direction: 'left' | 'right';
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
          Drag a card left or right — or use the buttons — to answer. An{' '}
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
