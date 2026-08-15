'use client';

import Link from 'next/link';

import { Flashcard } from '@/components/widgets/Flashcard';
import type { FlashcardSpec } from '@/lib/pathway/schema';

const spec: FlashcardSpec = {
  kind: 'flashcard',
  learningComponentId: null,
  prompt: 'Tap each card to reveal the answer.',
  cards: [
    {
      id: 'photosynthesis',
      front: {
        text: 'Photosynthesis',
        markdown: null,
        imageUrl: null,
        imageAlt: null,
      },
      back: {
        text: null,
        markdown: `The process by which plants convert **sunlight, water, and CO₂** into glucose and oxygen.

> sunlight + water + CO₂ → glucose + O₂

Happens inside **chloroplasts**, using the green pigment *chlorophyll*.`,
        imageUrl: null,
        imageAlt: null,
      },
    },
    {
      id: 'mitosis',
      front: {
        text: 'What are the four stages of mitosis, in order?',
        markdown: null,
        imageUrl: null,
        imageAlt: null,
      },
      back: {
        text: null,
        markdown: `1. **Prophase** — chromosomes condense and become visible
2. **Metaphase** — chromosomes line up at the cell's centre
3. **Anaphase** — sister chromatids are pulled to opposite poles
4. **Telophase** — two new nuclei form; the cell pinches in two`,
        imageUrl: null,
        imageAlt: null,
      },
    },
    {
      id: 'cell-membrane',
      front: {
        text: null,
        markdown: null,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Cell_membrane_detailed_diagram_en.svg/500px-Cell_membrane_detailed_diagram_en.svg.png',
        imageAlt: 'Diagram of a phospholipid bilayer cell membrane',
      },
      back: {
        text: 'The cell membrane',
        markdown: `A **phospholipid bilayer** that controls what enters and leaves the cell.

- Hydrophilic (water-loving) heads face outward
- Hydrophobic (water-fearing) tails face inward
- Protein channels allow selective transport`,
        imageUrl: null,
        imageAlt: null,
      },
    },
    {
      id: 'atp',
      front: {
        text: 'ATP',
        markdown: '*What does it stand for, and what does it do?*',
        imageUrl: null,
        imageAlt: null,
      },
      back: {
        text: 'Adenosine Triphosphate — the cell\'s energy currency',
        markdown: `Energy is stored in the bonds between the three phosphate groups. When a bond breaks, energy is released for the cell to use.`,
        imageUrl: null,
        imageAlt: null,
      },
    },
  ],
  successMessage: 'You\'ve reviewed all four cards. These concepts form the foundation of cell biology.',
};

export default function FlashcardDemo() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Flashcard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Flip cards to reveal definitions, explanations, or images. Supports any mix of text, markdown, and images on either side.
        </p>
      </div>

      <Flashcard spec={spec} onComplete={() => alert('Deck complete!')} />
    </main>
  );
}
