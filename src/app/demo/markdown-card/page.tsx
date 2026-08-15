'use client';

import Link from 'next/link';
import { useState } from 'react';

import { MarkdownCard } from '@/components/widgets/MarkdownCard';
import type { MarkdownCardSpec } from '@/lib/pathway/schema';

const EXAMPLES: { label: string; spec: MarkdownCardSpec }[] = [
  {
    label: 'Rich formatting',
    spec: {
      kind: 'markdown-card',
      learningComponentId: null,
      title: 'What does a denominator actually mean?',
      body: `When you see a fraction like **3/4**, the bottom number — the **denominator** — tells you how many **equal parts** the whole has been cut into.

Think of a pizza sliced into 4 equal pieces. The denominator is **4** because there are four pieces total. The numerator (top number) tells you how many of those pieces you're talking about.

### Why "equal" matters

If the pieces aren't equal, the fraction doesn't work. Imagine cutting a pizza so one piece is huge and three are tiny — saying "I have 1/4 of the pizza" would mean something different each time.

### Common mistake to watch for

A bigger denominator doesn't mean a bigger fraction. **1/8 is smaller than 1/4** because the whole is cut into more pieces, so each piece is smaller.`,
      tip: "The denominator divides — that's where the word comes from. It tells you how many equal parts make one whole.",
    },
  },
  {
    label: 'Bulleted list',
    spec: {
      kind: 'markdown-card',
      learningComponentId: null,
      title: 'The three domains of life',
      body: `Scientists group all living things into three broad **domains** based on cell type and genetic makeup:

- **Bacteria** — single-celled organisms with no nucleus. They live almost everywhere on Earth and include both helpful and harmful species.
- **Archaea** — also single-celled and nucleus-free, but chemically distinct from bacteria. Many thrive in extreme environments like hot springs or salt lakes.
- **Eukarya** — organisms whose cells have a nucleus. This domain includes animals, plants, fungi, and protists — including you.

The three-domain system replaced the older five-kingdom model once scientists could compare DNA directly.`,
      tip: null,
    },
  },
  {
    label: 'Numbered steps',
    spec: {
      kind: 'markdown-card',
      learningComponentId: null,
      title: 'How to solve a two-step equation',
      body: `A two-step equation has two operations hiding the value of *x*. Undo them in reverse order — last operation first.

**Example:** solve 2x + 5 = 13

1. **Subtract 5 from both sides** to undo the addition → 2x = 8
2. **Divide both sides by 2** to undo the multiplication → x = 4

Always do the same thing to *both* sides — the equation stays balanced, like a scale.

### Check your answer

Plug x = 4 back in: 2(4) + 5 = 8 + 5 = 13 ✓`,
      tip: 'Work backwards through the order of operations: undo addition/subtraction first, then multiplication/division.',
    },
  },
  {
    label: 'Quote-led',
    spec: {
      kind: 'markdown-card',
      learningComponentId: null,
      title: 'What is a theme in literature?',
      body: `> "A theme is not *what happens* in a story — it's *what the story is about* underneath."

A **theme** is the central idea or message an author wants you to walk away with. It's not a topic ("friendship") but a claim about that topic — something like *"true friendship means being honest even when it's hard."*

Themes are almost never stated directly. You infer them by asking: what does the main character learn? What does the author seem to be saying about how people should live or how the world works?

The same story can have more than one theme, and two readers can find different ones — what matters is that you can **support yours with evidence from the text**.`,
      tip: null,
    },
  },
];

export default function MarkdownCardDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = EXAMPLES[activeIdx]!;

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Markdown Card</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Renders LLM-generated markdown as a reading card for reinforcement.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex.label}
            onClick={() => setActiveIdx(i)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              i === activeIdx
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <MarkdownCard
        key={activeIdx}
        spec={active.spec}
        onComplete={() => alert(`"${active.spec.title}" marked complete`)}
      />
    </main>
  );
}
