'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WritingWorkshop } from '@/components/widgets/WritingWorkshop';
import type { WritingWorkshopSpec } from '@/lib/pathway/schema';

/**
 * Four genres, one component. The genre is not decoration — it is carried into
 * the review prompt, because the same sentence is a strength in a short story
 * and a problem in a lab report, and a reviewer that does not know which it is
 * reading marks everything as an essay.
 */
const SPECS: { label: string; standard: string; spec: WritingWorkshopSpec }[] = [
  {
    label: 'Argument essay',
    standard: 'W.8.1 · argument with evidence',
    spec: {
      kind: 'writing-workshop',
      learningComponentId: null,
      prompt: 'Write your essay. Ask for a read whenever you want one — nothing is watching while you write.',
      brief: {
        title: 'Should our school start at 8:45?',
        task: 'Write an argument essay for your school\'s governing board arguing for or against a later start time. Take a clear position, support it with reasons and evidence, and deal fairly with the strongest objection to your side.',
      },
      genre: 'argument essay',
      placeholder: 'Start anywhere — you can move it around later…',
      targetWords: 350,
      lookFor: [
        { id: 'claim', label: 'Claim', lookFor: 'A clear position stated early and held throughout, rather than a survey of both sides.' },
        { id: 'evidence', label: 'Evidence', lookFor: 'Specific, verifiable support — facts, numbers, named sources — rather than assertion or personal feeling alone.' },
        { id: 'counter', label: 'Counterargument', lookFor: 'The strongest objection stated fairly and answered, rather than a weak version knocked down.' },
        { id: 'structure', label: 'Structure', lookFor: 'Paragraphs that each do one job and connect, rather than a list of points in any order.' },
      ],
    },
  },
  {
    label: 'Lab report',
    standard: 'WHST.6-8.2 · scientific write-up',
    spec: {
      kind: 'writing-workshop',
      learningComponentId: null,
      prompt: 'Write up your investigation. Ask for a read when you want one.',
      brief: {
        title: 'Investigation: what affects how fast an ice cube melts?',
        task: 'Write up an investigation into one factor that affects how quickly an ice cube melts. Include what you changed, what you measured, what you kept the same, what you found, and what you can and cannot conclude from it. Write it for another student who might repeat your experiment.',
      },
      genre: 'lab report',
      placeholder: 'Aim: to find out whether…',
      targetWords: 300,
      lookFor: [
        { id: 'variables', label: 'Variables', lookFor: 'The changed, measured and controlled variables are each identified and are genuinely the right ones.' },
        { id: 'method', label: 'Method', lookFor: 'Enough detail that another student could actually repeat it — quantities, times, how the measurement was taken.' },
        { id: 'conclusion', label: 'Conclusion', lookFor: 'A conclusion the data actually supports, with its limits acknowledged rather than overclaimed.' },
        { id: 'precision', label: 'Precision', lookFor: 'Careful language about what was observed — "faster" tied to a measurement rather than an impression.' },
      ],
    },
  },
  {
    label: 'Research proposal',
    standard: 'WHST.6-8.7 · research question and plan',
    spec: {
      kind: 'writing-workshop',
      learningComponentId: null,
      prompt: 'Draft your proposal. Ask for a read when you want one.',
      brief: {
        title: 'Proposal: a question worth investigating',
        task: 'Propose a research question you could actually answer in two weeks, and the plan for answering it. Say why the question matters, what evidence would count as an answer, and where you would get it. Write it for your teacher to approve or send back.',
      },
      genre: 'research proposal',
      placeholder: 'The question I want to investigate is…',
      targetWords: 250,
      lookFor: [
        { id: 'question', label: 'The question', lookFor: 'Narrow enough to answer in the time available, and phrased as a question rather than a topic.' },
        { id: 'answerable', label: 'Answerability', lookFor: 'It is clear what evidence would count as an answer, and what would count against it.' },
        { id: 'sources', label: 'Sources', lookFor: 'Named, plausible, reachable sources — not "the internet" or "books about it".' },
        { id: 'significance', label: 'Why it matters', lookFor: 'A reason someone other than the writer should care, stated rather than assumed.' },
      ],
    },
  },
  {
    label: 'Short story',
    standard: 'W.7.3 · narrative writing',
    spec: {
      kind: 'writing-workshop',
      learningComponentId: null,
      prompt: 'Write your story. Ask for a read whenever you want one.',
      brief: {
        title: 'A story that turns on one decision',
        task: 'Write a short story in which a character makes one decision that changes everything. Show us enough of them beforehand that the decision means something. You do not need a twist — you need us to believe the choice.',
      },
      genre: 'short story',
      placeholder: 'Open in the middle of something…',
      targetWords: 500,
      lookFor: [
        { id: 'character', label: 'Character', lookFor: 'We learn who they are through what they do and say, rather than being told about them.' },
        { id: 'turn', label: 'The turn', lookFor: 'The decision is set up, earned, and genuinely changes the story rather than being announced.' },
        { id: 'detail', label: 'Detail', lookFor: 'Specific, chosen detail that does work — not decoration, and not generic scene-setting.' },
        { id: 'ending', label: 'Ending', lookFor: 'It lands rather than stops, and does not explain its own meaning to the reader.' },
      ],
    },
  },
];

export default function WritingWorkshopDemo() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Writing workshop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Long-form writing, marked up when <em>you</em> ask. Nothing watches while you draft — then
          the read comes back on the sentences themselves, underlined where they work and where they
          don&apos;t.
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
          {/* Keyed so switching briefs starts a new piece rather than carrying
              one genre's draft and marks into another's. */}
          <WritingWorkshop key={active.label} spec={active.spec} />
        </CardContent>
      </Card>
    </main>
  );
}
