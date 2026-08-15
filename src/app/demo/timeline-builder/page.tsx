'use client';

import Link from 'next/link';

import { TimelineBuilder } from '@/components/widgets/TimelineBuilder';
import type { TimelineBuilderSpec } from '@/lib/pathway/schema';

const spec: TimelineBuilderSpec = {
  kind: 'timeline-builder',
  learningComponentId: null,
  prompt: 'Place each event in the correct period of ancient history.',
  zones: [
    { id: 'prehistoric', label: 'Prehistoric', sublabel: 'before 3000 BCE' },
    { id: 'ancient', label: 'Ancient World', sublabel: '3000–500 BCE' },
    { id: 'classical', label: 'Classical Era', sublabel: '500 BCE–500 CE' },
    { id: 'medieval', label: 'Middle Ages', sublabel: '500–1500 CE' },
  ],
  events: [
    { id: 'stonehenge', label: 'Stonehenge built', zoneId: 'prehistoric' },
    { id: 'cave-painting', label: 'Cave paintings at Lascaux', zoneId: 'prehistoric' },
    { id: 'pyramids', label: 'Egyptian pyramids built', zoneId: 'ancient' },
    { id: 'hammurabi', label: "Hammurabi's Code written", zoneId: 'ancient' },
    { id: 'olympics', label: 'First Olympic Games', zoneId: 'classical' },
    { id: 'rome-founded', label: 'Rome founded', zoneId: 'classical' },
    { id: 'magna-carta', label: 'Magna Carta signed', zoneId: 'medieval' },
    { id: 'black-death', label: 'Black Death reaches Europe', zoneId: 'medieval' },
  ],
  successMessage: 'Well done! You correctly placed all events across four major periods of history.',
  hint: 'Think about which civilisations came first — prehistoric humans had no writing or cities yet, while the classical era is when Greece and Rome flourished.',
};

export default function TimelineBuilderDemo() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Timeline Builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag events from the bank into the correct period on the timeline.
        </p>
      </div>

      <TimelineBuilder spec={spec} onComplete={() => alert('Complete!')} />
    </main>
  );
}
