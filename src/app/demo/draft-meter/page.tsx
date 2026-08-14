'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DraftMeter } from '@/components/widgets/DraftMeter';
import type { DraftMeterSpec } from '@/lib/pathway/schema';

/**
 * Two fixed specs covering the widget's two modes.
 *
 * The pipeline produces these same shapes from a topic, but takes ~30s and two
 * model calls to do it — fine once per lesson, useless when tuning the scoring
 * prompt. Standard wording is verbatim from the Learning Commons graph.
 */
const DEMO_SPECS: DraftMeterSpec[] = [
  {
    kind: 'draft-meter',
    learningComponentId: null,
    question: 'Should our school start at 8:45? Say what you think — and why.',
    placeholder: 'Write a few sentences…',
    standardCode: 'W.8.1',
    standardDescription:
      'Write arguments to support claims with clear reasons and relevant evidence.',
    standardForStudents:
      'You’re being asked for three things: pick a side, say why you picked it, and back it up with something real — a fact, an example, a number. Once you have all three, you’ve done what this asks.',
    passage: null,
    criteria: [
      'takes a clear position on the question asked',
      'gives a reason that actually supports the position',
      'points to evidence outside the writer’s own opinion',
      'stays on the question rather than drifting to a related one',
    ],
  },
  {
    kind: 'draft-meter',
    learningComponentId: null,
    question:
      'Does this argument hold up? Say what you think — and point to what in the editorial makes you say so.',
    placeholder: 'The editorial says…',
    standardCode: 'RI.8.8',
    standardDescription:
      'Delineate and evaluate the argument and specific claims in a text, assessing whether the reasoning is sound and the evidence is relevant and sufficient; recognize when irrelevant evidence is introduced.',
    standardForStudents:
      'You’re judging someone else’s argument. Three things: say whether it holds up, point at a specific bit of the editorial, and explain why that bit does or doesn’t prove their point. Watch for evidence that sounds convincing but doesn’t actually fit. Three things is the whole job — you don’t have to catch everything.',
    passage: {
      source: 'School newspaper editorial',
      text: 'Phones should be banned from every classroom in this school. Last year, test scores in Ms. Alvarez’s class dropped by six points, and everyone knows students are on their phones constantly. A study of one thousand adults found that most people check their phones over eighty times a day. Besides, when I walk down the hallway between classes, at least half the students I see are staring at a screen instead of talking to each other. Clearly, phones are the reason our school is struggling.',
    },
    criteria: [
      'takes a position on whether the argument is sound',
      'points to a specific claim or piece of evidence in the passage',
      'explains why that evidence is or is not relevant and sufficient',
      'notices evidence that does not actually support the claim',
    ],
  },
];

const MODES = [
  { label: 'Writing (W.8.1)', note: 'No source — the argument comes from the student.' },
  { label: 'Reading (RI.8.8)', note: 'A source passage, so "evidence" means citing the text.' },
];

export default function DraftMeterDemo() {
  const [index, setIndex] = useState(0);
  const spec = DEMO_SPECS[index];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Draft Meter</h1>
        <p className="mt-2 text-muted-foreground">
          Question, textbox, one line. The meter is scored by a live model call against the standard
          — not a word count. Scoring runs about 1.5s after you stop typing.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {MODES.map((mode, i) => (
          <Button
            key={mode.label}
            variant={i === index ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIndex(i)}
          >
            {mode.label}
          </Button>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{MODES[index].note}</p>

      {/* Keyed so switching modes resets the widget rather than carrying a
          score from one standard over to the other. */}
      <DraftMeter key={spec.standardCode} spec={spec} />
    </main>
  );
}
