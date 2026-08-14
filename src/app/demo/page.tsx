import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
      'Swipe a card left or right to answer a question or sort a statement into a category. Supports drag gestures and emits a completion event with per-card results.',
    tags: ['flashcards', 'true/false', 'sorting'],
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
