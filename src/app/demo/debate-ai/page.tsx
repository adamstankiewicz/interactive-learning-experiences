'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DebateAI } from '@/components/widgets/DebateAI';
import type { DebateAiSpec } from '@/lib/pathway/schema';

/**
 * Two things to look at in these specs.
 *
 * Both sides get a `summary` that puts the *strongest* version of the case,
 * because the student reads them before choosing. A side written as a straw man
 * is not a choice, and nobody would take it.
 *
 * And the persona names a *findable* weakness — a study stretched to a
 * population it doesn't cover, one anecdote standing in for a pattern, a word
 * that shifts meaning halfway through. It applies to whichever side the
 * assistant draws, which is why it describes how it argues rather than what.
 */
const SPECS: { label: string; standard: string; spec: DebateAiSpec }[] = [
  {
    label: 'Argument',
    standard: 'W.8.1 · argument from evidence',
    spec: {
      kind: 'debate-ai',
      learningComponentId: null,
      prompt: "Pick a side. I'll argue the other one — and I won't make it easy.",
      motion: 'Schools should abolish homework entirely.',
      sides: [
        {
          id: 'abolish',
          label: 'Abolish homework',
          summary:
            'Evenings belong to students. The evidence for homework improving learning is weak, especially for younger students, and the cost in stress and lost family time is real.',
          opening:
            "Homework should go. Study after study shows almost no link between homework and achievement in primary school, and students who do less of it report being happier and less stressed. My cousin was up until midnight every night last year and it nearly broke her — why are we doing this to kids?",
        },
        {
          id: 'keep',
          label: 'Keep homework',
          summary:
            'Practice outside class is where difficult material actually sticks, and independent work is a skill in itself. The problem is bad homework, not homework.',
          opening:
            "Homework earns its place. You cannot get fluent at anything in forty minutes a week — the practice has to happen somewhere, and everyone who has ever learned an instrument knows it. Scrapping it entirely punishes the students who do not have a tutor at home to fall back on.",
        },
      ],
      aiPersona:
        'Confident and friendly, never rude. Cites real research but stretches it — reaches for a study of primary-age children to argue about teenagers, and treats "students who do less homework report being happier" as proof that homework causes unhappiness. Falls back on one vivid personal story as though it settled the question.',
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
      prompt: "Pick a side. I'll take the other and defend it properly.",
      motion: 'The printing press was the most important invention of the last thousand years.',
      sides: [
        {
          id: 'press',
          label: 'The printing press',
          summary:
            'Print made ideas survivable. Within seventy years it carried the Reformation across Europe and made the Scientific Revolution possible — nothing else changed how knowledge moves.',
          opening:
            "It has to be the printing press. Gutenberg prints in 1450, and within seventy years Luther's ideas are all over Europe and the Reformation is unstoppable. Before print, an idea died in the town it was born in. Nothing else in a thousand years changed that.",
        },
        {
          id: 'other',
          label: 'Something else mattered more',
          summary:
            'Vaccination, sanitation, the transistor, the internal combustion engine — one of these changed more lives more directly, and print only mattered once enough people could read.',
          opening:
            "The printing press is the romantic answer, but I would take vaccination. Smallpox alone killed around 300 million people in the twentieth century before it was eradicated — no invention has saved lives on that scale. Print is only powerful once people can read, and mass literacy took another three hundred years.",
        },
      ],
      aiPersona:
        'Enthusiastic, a little grand. Reaches for sweeping causal claims — says one thing "caused" another without acknowledging what else was happening. Uses "important" loosely, sliding between "changed the most lives" and "was hardest to invent" depending on which is convenient. Cites real dates accurately, which makes the reasoning sound sturdier than it is.',
      moves: [
        {
          id: 'cause',
          label: 'Questioned the cause',
          lookFor: 'Points out that something else could explain the change, or that one invention alone did not cause it.',
        },
        {
          id: 'definition',
          label: 'Pinned down a word',
          lookFor: 'Notices "important" or a similar term being used two different ways, and asks which is meant.',
        },
        {
          id: 'evidence',
          label: 'Challenged the evidence',
          lookFor: 'Names why a date, figure or example does not support the claim it is being used for.',
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
      prompt: "Pick a side. I'll argue the other, and I'll argue it seriously.",
      motion: 'Modern zoos do more good than harm.',
      sides: [
        {
          id: 'good',
          label: 'More good than harm',
          summary:
            'Captive breeding has pulled species back from extinction that would otherwise be gone, and hundreds of millions of visitors a year encounter animals they would never otherwise care about.',
          opening:
            "On balance, zoos earn their place. The California condor was down to twenty-two birds and captive breeding brought it back — that simply does not happen without zoos. And over 700 million people visit zoos every year; that is a scale of conservation education nothing else comes close to.",
        },
        {
          id: 'harm',
          label: 'More harm than good',
          summary:
            'A handful of conservation successes do not cover the cost to the individual animals living in enclosures, and most zoo species are not endangered at all — the education claim is mostly unmeasured.',
          opening:
            "The successes are real but they are the exception, not the argument. Most animals in most zoos are not endangered and are never going back to the wild — they are there because people like looking at them. And the claim that visiting a zoo changes what anyone does about conservation has almost no evidence behind it.",
        },
      ],
      aiPersona:
        'Warm and reasonable-sounding. Leans on one genuine example as though it were typical of the whole. Quotes attendance or population numbers as evidence of impact, without any evidence that it changed what people do. Treats "some are excellent" as though it answered "many are not".',
      moves: [
        {
          id: 'representative',
          label: 'Questioned the example',
          lookFor: 'Points out that a single case may not represent the whole, in either direction.',
        },
        {
          id: 'measure',
          label: 'Challenged the measure',
          lookFor: 'Notices that a number measures one thing (attendance) and is being used for another (learning).',
        },
        {
          id: 'cost',
          label: 'Weighed both sides',
          lookFor: 'Puts the cost and the benefit on the same scale rather than only disputing one of them.',
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
          Two sides, both arguable. You pick one, the assistant takes the other and holds it. Nobody
          wins — what gets tracked is whether you argued like someone <em>evaluating</em>: challenged
          the evidence, caught a leap, granted a fair point.
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
          {/* Keyed so switching motions starts a fresh debate — including the
              side choice — rather than carrying one opponent's transcript over. */}
          <DebateAI key={active.label} spec={active.spec} />
        </CardContent>
      </Card>
    </main>
  );
}
