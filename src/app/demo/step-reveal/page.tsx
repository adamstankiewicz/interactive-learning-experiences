'use client';

import Link from 'next/link';

import { StepReveal } from '@/components/widgets/StepReveal';
import type { StepRevealSpec } from '@/lib/pathway/schema';

const spec: StepRevealSpec = {
  kind: 'step-reveal',
  learningComponentId: null,
  prompt: "Let's solve 2x + 5 = 13 together, one step at a time.",
  steps: [
    {
      id: 'understand',
      title: 'Step 1: Understand what the equation is saying',
      body: `The equation **2x + 5 = 13** is a statement of balance.

Whatever is on the **left side** (2x + 5) equals whatever is on the **right side** (13).

Your job is to figure out what value of **x** keeps both sides equal. Think of it like a scale — anything you do to one side, you must do to the other to keep it balanced.`,
      why: 'Understanding the equation as a balanced scale makes every algebraic move feel logical, not arbitrary.',
    },
    {
      id: 'subtract',
      title: 'Step 2: Subtract 5 from both sides',
      body: `To get **x** by itself, you need to undo the **+5** first. The opposite of adding 5 is subtracting 5.

Subtract **5** from both sides:

**2x + 5 − 5 = 13 − 5**

The +5 and −5 cancel on the left, leaving:

**2x = 8**`,
      why: 'You always undo addition and subtraction before multiplication and division — this keeps the equation balanced while peeling away the outermost operation.',
    },
    {
      id: 'divide',
      title: 'Step 3: Divide both sides by 2',
      body: `Now **2x = 8**. The **2** is being multiplied by x. To undo that, divide both sides by **2**:

**2x ÷ 2 = 8 ÷ 2**

This simplifies to:

**x = 4**`,
      why: 'Dividing by the coefficient isolates x completely — one operation, and the variable is free.',
    },
    {
      id: 'check',
      title: 'Step 4: Check the answer',
      body: `Plug **x = 4** back into the original equation to verify it works:

**2(4) + 5 = 8 + 5 = 13** ✓

The left side equals **13** and the right side equals **13** — the equation balances.

The answer is **x = 4**.`,
      why: null,
    },
  ],
};

export default function StepRevealDemo() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Step reveal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Walk through a worked example one step at a time. Each step stacks up so students can follow the full chain of reasoning.
        </p>
      </div>

      <StepReveal spec={spec} onComplete={() => alert('All steps complete!')} />
    </main>
  );
}
