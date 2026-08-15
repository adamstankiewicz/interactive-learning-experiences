'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DebateAI } from '@/components/widgets/DebateAI';
import type { DebateAiSpec } from '@/lib/pathway/schema';

/**
 * The persona field is the one to read. Each of these opponents argues with a
 * *named* weakness — a study that does not fit, an anecdote standing in for a
 * pattern, a word that changes meaning halfway through. That is what the
 * student is meant to catch, and an opponent without one would leave them with
 * nothing to evaluate.
 */
const SPECS: { label: string; standard: string; spec: DebateAiSpec }[] = [
  {
    label: 'Argument',
    standard: 'W.8.1 · argument from evidence',
    spec: {
      kind: 'debate-ai',
      learningComponentId: null,
      prompt: "I'll argue that homework should be abolished. Your job is to test my argument — not just disagree with it.",
      motion: 'Schools should abolish homework entirely.',
      aiPosition: 'Homework should be abolished: it does not improve learning and it costs students their evenings.',
      aiPersona:
        'Confident and friendly, never rude. Cites real research but stretches it — quotes a study of primary-age children to argue about teenagers, and treats "students who do less homework report being happier" as proof that homework causes unhappiness. Falls back on one vivid story about a stressed friend as though it settled the question.',
      openingMessage:
        "Homework should go. Study after study shows almost no link between homework and achievement in primary school, and students who do less of it report being happier and less stressed. My cousin was up until midnight every night last year and it nearly broke her — why are we doing this to kids?",
      moves: [
        {
          id: 'evidence',
          label: 'Challenged the evidence',
          lookFor: 'Names why a specific piece of evidence does not support the claim it is being used for.',
        },
        {
          id: 'leap',
          label: 'Spotted a leap',
          lookFor: 'Catches a jump in reasoning — correlation treated as cause, one case treated as a pattern.',
        },
        {
          id: 'distinction',
          label: 'Drew a distinction',
          lookFor: 'Separates cases the argument lumps together, e.g. primary vs secondary, or kinds of homework.',
        },
        {
          id: 'concede',
          label: 'Conceded a fair point',
          lookFor: 'Grants something true in the opposing case rather than fighting every sentence.',
        },
      ],
      turnLimit: 5,
    },
  },
  {
    label: 'History',
    standard: 'RH.6-8.8 · fact, opinion, reasoned judgment',
    spec: {
      kind: 'debate-ai',
      learningComponentId: null,
      prompt: "I'll argue the printing press mattered more than any other invention of its age. Test how I'm arguing it.",
      motion: 'The printing press was the most important invention of the last thousand years.',
      aiPosition: 'The printing press caused the Reformation, the Scientific Revolution and mass literacy, so nothing else comes close.',
      aiPersona:
        'Enthusiastic, a little grand. Reaches for sweeping causal claims — says the press "caused" the Reformation without acknowledging what else was happening. Uses "important" loosely, sliding between "changed the most lives" and "was hardest to invent" depending on which is convenient. Cites real dates accurately, which makes the reasoning sound sturdier than it is.',
      openingMessage:
        "It has to be the printing press. Gutenberg prints in 1450, and within seventy years Luther's ideas are all over Europe and the Reformation is unstoppable. Before print, an idea died in the town it was born in. Nothing else in a thousand years changed that.",
      moves: [
        {
          id: 'cause',
          label: 'Questioned the cause',
          lookFor: 'Points out that something else could explain the change, or that the press alone did not cause it.',
        },
        {
          id: 'definition',
          label: 'Pinned down a word',
          lookFor: 'Notices "important" or a similar term being used two different ways, and asks which is meant.',
        },
        {
          id: 'alternative',
          label: 'Offered a rival case',
          lookFor: 'Names another candidate and says what would make it stronger, rather than only attacking.',
        },
        {
          id: 'concede',
          label: 'Conceded a fair point',
          lookFor: 'Grants something true in the opposing case rather than fighting every sentence.',
        },
      ],
      turnLimit: 5,
    },
  },
  {
    label: 'Science & society',
    standard: 'RST.6-8.8 · evaluating claims in a text',
    spec: {
      kind: 'debate-ai',
      learningComponentId: null,
      prompt: "I'll argue that zoos do more good than harm. Test the argument, don't just take a side against it.",
      motion: 'Modern zoos do more good than harm.',
      aiPosition: 'Zoos save species from extinction and teach millions of people to care about animals, which outweighs the cost to individual animals.',
      aiPersona:
        'Warm and reasonable-sounding. Leans on one genuine success story — the California condor — as though it were typical of zoos generally. Quotes visitor numbers as evidence that zoos educate, without any evidence that visiting changes what people do. Treats "some zoos are excellent" as though it answered "many zoos are not".',
      openingMessage:
        "On balance, zoos earn their place. The California condor was down to twenty-two birds and captive breeding brought it back — that simply does not happen without zoos. And over 700 million people visit zoos every year; that is a scale of conservation education nothing else comes close to.",
      moves: [
        {
          id: 'representative',
          label: 'Questioned the example',
          lookFor: 'Points out that a single success story may not represent zoos in general.',
        },
        {
          id: 'measure',
          label: 'Challenged the measure',
          lookFor: 'Notices that visitor numbers measure attendance, not learning or changed behaviour.',
        },
        {
          id: 'cost',
          label: 'Weighed the cost',
          lookFor: 'Brings the harm side onto the scale explicitly rather than only disputing the benefits.',
        },
        {
          id: 'concede',
          label: 'Conceded a fair point',
          lookFor: 'Grants something true in the opposing case rather than fighting every sentence.',
        },
      ],
      turnLimit: 5,
    },
  },
];

export default function DebateAIDemo() {
  const [index, setIndex] = useState(0);
  const active = SPECS[index]!;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Debate an AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An opponent that argues a position and doesn&apos;t fold. What counts isn&apos;t winning —
          it&apos;s the evaluative move: catching why a piece of evidence doesn&apos;t fit, spotting a
          leap, granting a fair point. Bloom&apos;s <em>evaluate</em>, with the rubric on screen.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SPECS.map((entry, i) => (
          <Button
            key={entry.label}
            variant={i === index ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIndex(i)}
          >
            {entry.label}
          </Button>
        ))}
      </div>
      <p className="mb-6 text-xs text-muted-foreground">{active.standard}</p>

      <Card>
        <CardContent>
          {/* Keyed so switching motions starts a new debate rather than carrying
              one opponent's transcript into another's. */}
          <DebateAI key={active.label} spec={active.spec} />
        </CardContent>
      </Card>
    </main>
  );
}
