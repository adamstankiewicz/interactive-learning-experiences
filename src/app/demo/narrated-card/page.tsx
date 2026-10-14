'use client';

import Link from 'next/link';

import { NarratedCard } from '@/components/widgets/NarratedCard';
import type { NarratedCardSpec } from '@/lib/pathway/schema';

const spec: NarratedCardSpec = {
  kind: 'narrated-card',
  learningComponentId: null,
  prompt: 'Listen along as we walk through solving this equation together.',
  steps: [
    {
      id: 'understand',
      title: 'Step 1: Understand what the equation is saying',
      body: 'We have the equation 2x + 5 = 13. This means: some number, multiplied by 2, then increased by 5, gives us 13. Our job is to find that number.',
      why: 'Reading the equation in plain language before solving it helps you keep track of what each operation is doing.',
    },
    {
      id: 'subtract',
      title: 'Step 2: Subtract 5 from both sides',
      body: 'We want to get 2x by itself. Right now, 5 is being added to it, so we undo that by subtracting 5 from both sides. 2x + 5 − 5 = 13 − 5. This gives us 2x = 8.',
      why: 'Whatever you do to one side of an equation, you must do to the other — that keeps the equation balanced.',
    },
    {
      id: 'divide',
      title: 'Step 3: Divide both sides by 2',
      body: 'Now 2x = 8. The 2 is multiplying x, so we undo that by dividing both sides by 2. 2x ÷ 2 = 8 ÷ 2. That gives us x = 4.',
      why: 'Division is the inverse of multiplication — it undoes the 2 and leaves x on its own.',
    },
    {
      id: 'check',
      title: 'Step 4: Check the answer',
      body: 'Substitute x = 4 back into the original equation. 2 times 4 plus 5 equals 8 plus 5, which equals 13. That matches the right-hand side, so x = 4 is correct.',
      why: null,
    },
  ],
};

export default function NarratedCardDemo() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Narrated card</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reads content aloud sentence by sentence, highlighting each sentence as it is spoken.
        </p>
      </div>

      <NarratedCard spec={spec} onComplete={() => alert('Complete!')} />
    </main>
  );
}
