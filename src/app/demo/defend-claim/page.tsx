'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DefendClaim } from '@/components/widgets/DefendClaim';
import type { DefendClaimSpec } from '@/lib/pathway/schema';

/**
 * Two fixed specs, both grade 7+ history.
 *
 * The pipeline produces these same shapes from a topic, but takes ~30s and two
 * model calls to do it — fine once per lesson, useless when tuning the feedback
 * prompt, which is the thing that actually wants iterating on here.
 *
 * The excerpts are written in period voice rather than quoted from real
 * documents, which is what the generator is instructed to do and is worth
 * seeing in the demo: attributions are honest about what they are, and no real
 * person is given invented words as their exact quotation.
 */
const DEMO_SPECS: DefendClaimSpec[] = [
  {
    kind: 'defend-claim',
    learningComponentId: null,
    era: 'Reconstruction',
    claim:
      'Reconstruction failed less because of Southern resistance than because the North lost interest in enforcing it.',
    context:
      'Federal troops enforced Black civil and voting rights in the South from 1865 until their withdrawal in 1877.',
    sources: [
      {
        attribution: 'Frederick Douglass, speech, 1875',
        text: 'The question is whether the nation has the will to finish what it began. Laws written in Washington mean nothing to a freedman in Mississippi if no one stands behind them when the ballot box is surrounded by armed men.',
      },
      {
        attribution: 'Northern newspaper editorial, 1874',
        text: 'The people of the North are tired of the Southern question. Business is slack, the banks are failing, and voters want their government thinking about wages and railroads, not about who is voting in Louisiana.',
      },
    ],
    placeholder: 'I disagree, because…',
    checklist: {
      position: 'A clear position on the claim',
      reasoning: 'A reason that supports it',
      evidence: 'A quote from Douglass or the editorial',
    },
    standardCode: 'RH.6-8.8',
    standardDescription:
      'Distinguish among fact, opinion, and reasoned judgment in a text; distinguish between primary and secondary sources.',
    standardForStudents:
      'You are being asked for three things: pick a side of the claim, say why you picked it, and back it with something one of these two sources actually says. A fact you happen to know but neither source mentions does not count here — the job is arguing from the documents in front of you.',
    criteria: [
      'takes a clear position on where responsibility for Reconstruction’s collapse lies',
      'gives a reason that connects the evidence to that position',
      'quotes or paraphrases a specific part of one of the two sources',
      'does not treat the source’s opinion as established fact',
    ],
  },
  {
    kind: 'defend-claim',
    learningComponentId: null,
    era: 'Industrial Revolution',
    claim:
      'The Industrial Revolution made life worse for the average British worker before it made it better.',
    context:
      'Between 1780 and 1850, Britain’s factory output rose sharply while most textile work moved from homes into mills.',
    sources: [
      {
        attribution: 'Factory inspector’s report, 1836',
        text: 'The children begin at six in the morning and are kept at the frames until eight at night. I found many stunted in growth and several with hands crushed in the machinery. Their fathers earn less at the loom than they did fifteen years ago.',
      },
      {
        attribution: 'Manchester manufacturer, letter, 1841',
        text: 'A labourer in my mill eats meat twice a week and wears cotton his grandfather could never have afforded. The village he left offered him hunger in a bad harvest and nothing else. He came here because the alternative was worse.',
      },
    ],
    placeholder: 'I agree, because…',
    checklist: {
      position: 'A clear position on the claim',
      reasoning: 'A reason that supports it',
      evidence: 'A quote from the inspector or the manufacturer',
    },
    standardCode: 'RH.6-8.6',
    standardDescription:
      'Identify aspects of a text that reveal an author’s point of view or purpose (e.g., loaded language, inclusion or avoidance of particular facts).',
    standardForStudents:
      'Both of these writers want you to believe something, and neither is lying. Pick a side of the claim, say why, and quote one of them — then notice what that writer had a reason to leave out.',
    criteria: [
      'takes a clear position on whether conditions worsened before improving',
      'gives a reason that connects the evidence to that position',
      'quotes or paraphrases a specific part of one of the two sources',
      'accounts for the writer’s position or interest in what they claim',
    ],
  },
];

const MODES = [
  {
    label: 'Reconstruction (RH.6-8.8)',
    note: 'Douglass and the editorial disagree about where responsibility lies, so either side is defensible.',
  },
  {
    label: 'Industrial Revolution (RH.6-8.6)',
    note: 'Both sources are self-interested — the standard is about noticing that, not about picking the honest one.',
  },
];

export default function DefendClaimDemo() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Defend a Claim</h1>
        <p className="mt-2 text-muted-foreground">
          Take a side on a claim historians argue about, defend it from the sources, then ask for
          feedback and revise. Nothing is judged until you press the button — and every reading
          comes back with an objection you have to answer, including the one that says your defense
          holds. Type it or dictate it.
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

      {/* Keyed so switching claims resets the widget rather than carrying a
          defense — and its feedback history — from one claim to the other. */}
      <DefendClaim key={spec.standardCode} spec={spec} />
    </main>
  );
}
