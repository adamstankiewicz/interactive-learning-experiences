import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { WidgetThumb } from '@/components/demo/WidgetThumb';

const WIDGETS = [
  {
    slug: 'fraction-area-model',
    name: 'Fraction Area Model',
    description:
      'Partition a whole into equal parts and select segments to build a target fraction. Supports bar and circle representations with equivalent-fraction detection.',
    tags: ['fractions', 'visual', 'manipulative'],
  },
  {
    slug: 'swiper-flashcard',
    name: 'Swiper Flashcard',
    description:
      'Swipe a card up or down to answer a question or sort a statement into a category. Supports drag gestures and emits a completion event with per-card results.',
    tags: ['flashcards', 'true/false', 'sorting'],
  },
  {
    slug: 'draft-meter',
    name: 'Draft Meter',
    description:
      'Write a short response and one line scores how strong the argument is, from a live model call on a debounce. Optionally supplies a source passage, so "evidence" means citing the text.',
    tags: ['writing', 'argument', 'live scoring'],
  },
  {
    slug: 'draw-the-curve',
    name: 'Draw the Curve',
    description:
      'Shape a line by dragging its points to predict how something changes, then see the real curve drawn over your guess. Checked on shape rather than numbers, so a story arc works the same way a motion graph does.',
    tags: ['predict-then-reveal', 'any subject', 'chart'],
  },
  {
    slug: 'find-the-flaw',
    name: 'Find the Flaw',
    description:
      'A worked example with one deliberate mistake — a solution, an experiment, an argument, an explanation. The student finds the step where it goes wrong, then diagnoses why. Checked locally, so there is no wait.',
    tags: ['error analysis', 'any subject', 'metacognition'],
  },
  {
    slug: 'defend-claim',
    name: 'Defend a Claim',
    description:
      'Take a side on a contestable historical claim, defend it from two conflicting sources, then request feedback and revise. Every reading answers with a counterargument. Typed or dictated. History, grade 7+.',
    tags: ['history', 'argument', 'voice', 'revision'],
  },
  {
    slug: 'timeline-builder',
    name: 'Timeline Builder',
    description:
      'Drag historical events from a bank into labeled period zones on a horizontal timeline. Supports 3–5 zones with per-event correctness feedback.',
    tags: ['history', 'sequencing', 'timeline'],
  },
  {
    slug: 'drag-sort',
    name: 'Drag & Sort',
    description:
      'Drag items into the correct order — timelines, rankings, sequences, and more. Emits a completion event when the student confirms a correct arrangement.',
    tags: ['ordering', 'timeline', 'ranking'],
  },
  {
    slug: 'drag-categorize',
    name: 'Drag & Categorize',
    description:
      'Drag items from a bank into labeled category columns. Supports 2–4 categories with all-or-nothing submission and per-item correctness feedback.',
    tags: ['sorting', 'categorization', 'classification'],
  },
  {
    slug: 'flashcard',
    name: 'Flashcard',
    description:
      'Tap to flip a card and reveal its back. Each side supports any combination of text, markdown, and images. Navigate through a deck and continue when done.',
    tags: ['vocabulary', 'study', 'flip'],
  },
  {
    slug: 'narrated-card',
    name: 'Narrated Card',
    description:
      'Reads content aloud using the browser\'s text-to-speech engine, revealing each sentence as it is spoken. Steps stack up as they complete.',
    tags: ['audio', 'narration', 'accessibility'],
  },
  {
    slug: 'step-reveal',
    name: 'Step Reveal',
    description: 'Walk through a concept or worked example one step at a time. Each step stacks up so students can follow the full chain of reasoning.',
    tags: ['worked example', 'step-by-step', 'reasoning'],
  },
  {
    slug: 'markdown-card',
    name: 'Markdown Card',
    description:
      'Renders LLM-generated markdown as a clean reading card — headings, bold, bullets, blockquotes, and an optional tip callout. Used to re-teach a concept a student is struggling with.',
    tags: ['reading', 'remediation', 'markdown'],
  },
  {
    slug: 'crossword',
    name: 'Crossword',
    description:
      'Solve a vocabulary crossword built from a standard and its prerequisites. The spec carries only terms and clues — the grid is interlocked in code — and each clue names the standard it came from.',
    tags: ['vocabulary', 'any subject', 'keyboard'],
  },
];

export default function DemoIndex() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Pathway builder
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Widget gallery</h1>
        <p className="mt-2 text-muted-foreground">
          {WIDGETS.length} interactive widget{WIDGETS.length !== 1 ? 's' : ''} — click any card to open its demo page.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {WIDGETS.map((w) => (
          <li key={w.slug}>
            <Link href={`/demo/${w.slug}`} className="group block h-full">
              <Card className="h-full transition-shadow group-hover:ring-2 group-hover:ring-ring">
                <CardHeader>
                  <WidgetThumb slug={w.slug} />
                  <CardTitle>{w.name}</CardTitle>
                  <CardDescription>{w.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {w.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
