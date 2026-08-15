'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DraftMeter } from '@/components/widgets/DraftMeter';
import type { DraftMeterSpec } from '@/lib/pathway/schema';

/**
 * Four fixed specs, one per subject the meter now covers.
 *
 * They exist to show the thing that is easy to miss about this widget: it is
 * the same component and the same scoring call every time. What changes is the
 * three checks each one carries, and those come from the standard. Standard
 * wording is verbatim from the Learning Commons graph.
 *
 * The pipeline produces these same shapes from a topic, but takes ~30s and two
 * model calls to do it — fine once per lesson, useless when tuning the prompt.
 */
const DEMO_SPECS: DraftMeterSpec[] = [
  {
    kind: 'draft-meter',
    learningComponentId: null,
    question: 'Should our school start at 8:45? Say what you think — and why.',
    placeholder: 'Write a few sentences…',
    standardCode: 'W.8.1',
    standardDescription: 'Write arguments to support claims with clear reasons and relevant evidence.',
    standardForStudents:
      'You’re being asked for three things: pick a side, say why you picked it, and back it up with something real — a fact, an example, a number. Once you have all three, you’ve done what this asks.',
    passage: null,
    checks: [
      { id: 'claim', label: 'a side', lookFor: 'Commits to a position instead of surveying both.', essential: false },
      { id: 'reason', label: 'a reason', lookFor: 'Says why — a because that holds up, not a restatement.', essential: false },
      {
        id: 'evidence',
        label: 'evidence',
        lookFor: 'Points at something verifiable outside their own opinion.',
        essential: false,
      },
    ],
  },
  {
    kind: 'draft-meter',
    learningComponentId: null,
    question: 'What does May value most in marriage, and what in the passage reveals it?',
    placeholder: 'I think May believes… and the passage shows this when…',
    standardCode: 'RL.9-10.1',
    standardDescription:
      'Cite strong and thorough textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.',
    standardForStudents:
      'Say what you think the passage shows about her, point at the exact words that made you think it, and make sure your reading actually fits the whole passage — not just one line.',
    passage: {
      source: 'Adapted from Edith Wharton, The Age of Innocence, 1920',
      text: 'May Welland rose from her chair with a slight tremor. "I\'ve always thought that people who talk about being unhappy in their marriages are simply selfish," she said. "Marriage is a duty, not a game to be played by one\'s own rules. My mother always said that the first duty of a married woman is to keep up appearances, no matter what she feels." She paused, smoothing her dress carefully. "Of course, some people think honesty matters more than duty." Her voice was steady, but her hands gripped the chair-back tightly.',
    },
    checks: [
      {
        id: 'interpretation',
        label: 'an interpretation',
        lookFor: 'States what the passage shows about the character, beyond restating events.',
        essential: false,
      },
      {
        id: 'support',
        label: 'support from the text',
        lookFor: 'Quotes or points at a specific part of the passage.',
        essential: false,
      },
      {
        id: 'accuracy',
        label: 'a reading that fits',
        lookFor: 'The interpretation is genuinely supported by the passage. A defensible alternative reading counts.',
        essential: true,
      },
    ],
  },
  {
    kind: 'draft-meter',
    learningComponentId: null,
    question: 'What does this notice tell you about who held power in this town — and what in it shows that?',
    placeholder: 'The notice suggests… because it says…',
    standardCode: 'RH.6-8.1',
    standardDescription:
      'Cite specific textual evidence to support analysis of primary and secondary sources.',
    standardForStudents:
      'Say what the source tells you, quote the bit that shows it, and explain what was going on at the time that makes it make sense. Three things and you’re done.',
    passage: {
      source: 'Town notice, Massachusetts, 1773',
      text: 'By order of the Selectmen, no person shall keep a public house, sell strong drink, or hold an assembly of more than ten persons after the ringing of the nine o\'clock bell, save by written leave of the Committee. Any freeholder observing a violation shall report it to the Constable, who shall levy a fine of forty shillings. Servants and apprentices found abroad after the bell shall be returned to their masters, and the fine laid upon the master.',
    },
    checks: [
      {
        id: 'claim',
        label: 'a claim',
        lookFor: 'Says something about who held power, not just what the notice says.',
        essential: false,
      },
      {
        id: 'source',
        label: 'evidence from the source',
        lookFor: 'Quotes or names a specific provision of the notice.',
        essential: false,
      },
      {
        id: 'context',
        label: 'context',
        lookFor: 'Connects it to something about the period — who counted as a freeholder, what a master was.',
        essential: false,
      },
    ],
  },
  {
    kind: 'draft-meter',
    learningComponentId: null,
    question: 'What is this article mostly about? Say the main idea and the details that show it.',
    placeholder: 'The article is mostly about…',
    standardCode: 'RI.4.2',
    standardDescription:
      'Determine the main idea of a text and explain how it is supported by key details; summarize the text.',
    standardForStudents:
      'Say what the whole article is mostly about — not just the topic, a whole thought. Then name the details that show it. Getting the main idea right matters most here.',
    passage: {
      source: 'Science Weekly for Kids',
      text: 'Honeybees do far more than make honey. When a bee lands on a flower to drink nectar, yellow pollen sticks to the tiny hairs on its body. At the next flower, some of that pollen rubs off, which is exactly what the plant needs to make seeds. Roughly one out of every three bites of food you eat depends on this accidental delivery service. Without bees moving pollen from flower to flower, many of the fruits and vegetables in your kitchen simply would not grow.',
    },
    checks: [
      {
        id: 'mainidea',
        label: 'the main idea',
        lookFor: 'A complete thought about what the whole article says, not a one-word topic.',
        essential: true,
      },
      {
        id: 'details',
        label: 'key details',
        lookFor: 'Names two or more details from the article that support it.',
        essential: false,
      },
      {
        id: 'focus',
        label: 'nothing extra',
        lookFor: 'Sticks to what matters instead of retelling every sentence.',
        essential: false,
      },
    ],
  },
];

const MODES = [
  { label: 'Argument', note: 'No source — the position comes from the student. Nothing is essential: an opinion can’t be factually wrong.' },
  { label: 'Literature', note: 'Interpretation, textual support, and a reading that actually fits. The last one is essential.' },
  { label: 'History', note: 'A claim, evidence from the primary source, and the context that makes it make sense.' },
  { label: 'Comprehension', note: 'Main idea, key details, nothing extra. Getting the main idea right is essential.' },
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
          Question, textbox, one line. Same component and same scoring call in all four of these —
          what changes is the three things each one is looking for, and those come from the standard.
          Scoring runs about 1.5s after you stop typing.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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

      <p className="mb-2 text-sm text-muted-foreground">{MODES[index].note}</p>
      <p className="mb-6 font-mono text-xs text-muted-foreground">
        {spec.standardCode} · looking for {spec.checks.map((c) => c.label).join(' · ')}
      </p>

      {/* Keyed so switching subjects resets the widget rather than carrying a
          score from one standard over to the next. */}
      <DraftMeter key={spec.standardCode} spec={spec} />
    </main>
  );
}
