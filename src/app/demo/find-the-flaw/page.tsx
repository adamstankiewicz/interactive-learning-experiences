'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FindTheFlaw } from '@/components/widgets/FindTheFlaw';
import type { FindTheFlawSpec } from '@/lib/pathway/schema';

/**
 * Four subjects, one interaction — the claim this widget makes is that judging
 * flawed work is the same act whether the work is a calculation, an experiment,
 * an argument or a causal explanation. Switching between these is the fastest
 * way to see whether that holds.
 */
const SPECS: { label: string; standard: string; spec: FindTheFlawSpec }[] = [
  {
    label: 'Science',
    standard: 'MS-PS1 · experimental design',
    spec: {
      kind: 'find-the-flaw',
      learningComponentId: null,
      prompt: 'This experiment has one mistake. Find the step where it goes wrong.',
      scenario: {
        title: "Devon's experiment",
        setup:
          'Devon wants to find out whether adding salt to water makes it boil faster. He sets up an experiment in the school lab.',
      },
      steps: [
        { id: 's1', label: 'He fills one pot with 500 mL of cold tap water and adds two spoons of salt.' },
        { id: 's2', label: 'He fills a second pot with 500 mL of cold tap water and adds no salt.' },
        { id: 's3', label: 'He heats the salted pot on the large burner and the plain pot on the small burner.' },
        { id: 's4', label: 'He times how long each pot takes to reach a rolling boil.' },
        { id: 's5', label: 'The salted water boils first, so he concludes that salt makes water boil faster.' },
      ],
      flawedStepId: 's3',
      whyOptions: [
        { id: 'w1', label: 'Two different burners means heat is changing too, so the salt cannot be what caused the difference.', correct: true },
        { id: 'w2', label: 'He should have used hot water instead of cold water to start.', correct: false },
        { id: 'w3', label: 'Two spoons of salt is not enough salt to make any difference.', correct: false },
        { id: 'w4', label: 'He should have repeated the experiment more than once.', correct: false },
      ],
      explanation:
        'Only one thing is allowed to change between the two pots. Devon changed the salt AND the burner, so when the salted water boiled first there is no way to know which change caused it. Both pots needed the same burner.',
      hint: 'Compare the two pots line by line. What is different between them besides the salt?',
    },
  },
  {
    label: 'Math',
    standard: '6.EE · solving equations',
    spec: {
      kind: 'find-the-flaw',
      learningComponentId: null,
      prompt: 'This solution has one mistake. Find the step where it goes wrong.',
      scenario: {
        title: "Maya's solution",
        setup: 'Maya is solving the equation 3(x + 4) = 27 for x.',
      },
      steps: [
        { id: 's1', label: '3(x + 4) = 27' },
        { id: 's2', label: '3x + 4 = 27' },
        { id: 's3', label: '3x = 23' },
        { id: 's4', label: 'x = 23/3' },
      ],
      flawedStepId: 's2',
      whyOptions: [
        { id: 'w1', label: 'She multiplied 3 by x but not by 4 — distributing means multiplying both terms inside the parentheses.', correct: true },
        { id: 'w2', label: 'She subtracted 4 from the wrong side of the equation.', correct: false },
        { id: 'w3', label: 'She should have divided both sides by 3 before doing anything else.', correct: false },
        { id: 'w4', label: 'The answer should be a whole number, so she made an arithmetic error at the end.', correct: false },
      ],
      explanation:
        '3(x + 4) means 3 times everything in the parentheses: 3x + 12, not 3x + 4. Distributing correctly gives 3x + 12 = 27, then 3x = 15, so x = 5. Every step after the second one is fine — they just started from a wrong line.',
      hint: 'Look at what happens between the first and second lines. Did every part of the parentheses get multiplied?',
    },
  },
  {
    label: 'History',
    standard: 'RH.6-8 · reasoning from sources',
    spec: {
      kind: 'find-the-flaw',
      learningComponentId: null,
      prompt: 'This explanation has one mistake. Find the step where the reasoning goes wrong.',
      scenario: {
        title: "A student's explanation",
        setup:
          'A student is explaining why a medieval town grew quickly between 1150 and 1250, using records from the town archive.',
      },
      steps: [
        { id: 's1', label: 'The archive shows the town built a stone bridge across the river in 1155.' },
        { id: 's2', label: 'Tax records list 40 merchant households in 1150 and 260 by 1250.' },
        { id: 's3', label: 'A new cathedral was begun in 1180, drawing stonemasons and their families.' },
        { id: 's4', label: 'The bridge let traders cross year-round instead of waiting for low water.' },
        { id: 's5', label: 'So the bridge was the reason the town grew — the cathedral and the traders had nothing to do with it.' },
      ],
      flawedStepId: 's5',
      whyOptions: [
        { id: 'w1', label: 'The evidence shows several causes at once, so ruling the others out is not something the sources support.', correct: true },
        { id: 'w2', label: 'Tax records are not reliable enough to use as historical evidence.', correct: false },
        { id: 'w3', label: 'The dates are wrong — a bridge built in 1155 is outside the period being explained.', correct: false },
        { id: 'w4', label: 'The student should have used more sources before writing an explanation.', correct: false },
      ],
      explanation:
        'The first four steps are all supported by the archive. The last one is not: the same evidence shows a bridge, a cathedral and a growing merchant class, and nothing in it lets you dismiss two of the three. Historical change usually has several causes working together.',
      hint: 'The evidence steps are all sound. Read the final claim against what those steps actually establish.',
    },
  },
  {
    label: 'English',
    standard: 'RI.8.8 · evaluating an argument',
    spec: {
      kind: 'find-the-flaw',
      learningComponentId: null,
      prompt: 'This paragraph has one mistake in its reasoning. Find the sentence where it goes wrong.',
      scenario: {
        title: "A student's paragraph",
        setup: 'A student is arguing that their school should keep its library open after 3pm.',
      },
      steps: [
        { id: 's1', label: 'The library should stay open until 5pm on weekdays.' },
        { id: 's2', label: 'A survey of 200 students found that 61% have no quiet place to study at home.' },
        { id: 's3', label: 'Students who study in quiet places score higher on tests, according to a 2019 education study.' },
        { id: 's4', label: 'Last year the library was open late during exam week and 140 students used it.' },
        { id: 's5', label: 'Also, the school cafeteria serves food that most students say they dislike.' },
      ],
      flawedStepId: 's5',
      whyOptions: [
        { id: 'w1', label: 'It brings in evidence about something else entirely, which does nothing to support the claim about library hours.', correct: true },
        { id: 'w2', label: 'It uses an opinion instead of a statistic, and arguments need numbers.', correct: false },
        { id: 'w3', label: 'It contradicts the earlier evidence about how many students use the library.', correct: false },
        { id: 'w4', label: 'It belongs at the start of the paragraph rather than at the end.', correct: false },
      ],
      explanation:
        'Sentences 2 through 4 are all relevant: they connect quiet study space, test scores, and actual library use to the claim. Sentence 5 is about cafeteria food. It may well be true, but irrelevant evidence does not make an argument stronger — recognising that is exactly what this standard asks for.',
      hint: 'Each sentence is true. Ask a different question: does each one actually support the claim in sentence 1?',
    },
  },
];

export default function FindTheFlawDemo() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Find the Flaw</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A worked example with one mistake in it. Find where it goes wrong, then say why — the same
          interaction whether the work is a calculation, an experiment, an argument or an explanation.
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
          {/* Keyed so switching subjects resets the widget instead of carrying
              one example's ruled-out steps into the next. */}
          <FindTheFlaw key={active.label} spec={active.spec} />
        </CardContent>
      </Card>
    </main>
  );
}
