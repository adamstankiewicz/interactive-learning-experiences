import Link from 'next/link';

import { FractionAreaModel } from '@/components/widgets/FractionAreaModel';
import type { FractionAreaModelSpec } from '@/lib/pathway/schema';

const BAR_SPEC: FractionAreaModelSpec = {
  kind: 'fraction-area-model',
  learningComponentId: null,
  prompt: 'Build 3/4 using the bar model.',
  representation: 'bar',
  denominator: 4,
  numerator: 3,
  denominatorChoices: [2, 4, 6, 8],
  successMessage: 'Exactly right — you selected 3 out of 4 equal parts.',
  hint: 'Try selecting 3 parts once you have split the bar into 4 equal sections.',
};

const CIRCLE_SPEC: FractionAreaModelSpec = {
  kind: 'fraction-area-model',
  learningComponentId: null,
  prompt: 'Build 2/3 using the circle model.',
  representation: 'circle',
  denominator: 3,
  numerator: 2,
  denominatorChoices: [3, 6, 9],
  successMessage: 'Correct — 2 out of 3 equal sectors.',
  hint: 'Divide the circle into 3 parts and shade 2 of them.',
};

export default function FractionAreaModelDemo() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Fraction Area Model</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partition a whole into equal parts and select segments to build a target fraction.
          Switch denominator choices to explore equivalent forms.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bar representation
          </p>
          <FractionAreaModel spec={BAR_SPEC} />
        </section>

        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Circle representation
          </p>
          <FractionAreaModel spec={CIRCLE_SPEC} />
        </section>
      </div>
    </main>
  );
}
