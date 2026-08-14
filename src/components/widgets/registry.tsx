'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { DragCategorize } from '@/components/widgets/DragCategorize';
import { DragSort } from '@/components/widgets/DragSort';
import { DraftMeter } from '@/components/widgets/DraftMeter';
import { FractionAreaModel } from '@/components/widgets/FractionAreaModel';
import { SwiperFlashcard } from '@/components/widgets/SwiperFlashcard';
import { widgetSpec, type WidgetSpec } from '@/lib/pathway/schema';

/**
 * Spec -> component. This is the extension point: adding a widget type means
 * a schema in `pathway/schema.ts`, a generator in `pathway/generate.ts`, and
 * a case here. The exhaustive switch makes a missing case a type error.
 *
 * `onComplete` is deliberately payload-free — each widget's internal result
 * shape (swipe results, sort correctness) is that widget's own business. A
 * caller that walks a student through several widgets in sequence only ever
 * needs to know "this one is done," never what was in it. Fraction area model
 * and Draft Meter have no notion of "done" (an area model is checked
 * repeatedly; a meter just keeps scoring) and so never call it.
 */
function render(spec: WidgetSpec, onComplete?: () => void) {
  switch (spec.kind) {
    case 'fraction-area-model':
      return <FractionAreaModel spec={spec} />;
    case 'swiper-flashcard':
      return <SwiperFlashcard spec={spec} onComplete={onComplete} />;
    case 'draft-meter':
      return <DraftMeter spec={spec} />;
    case 'drag-sort':
      return <DragSort spec={spec} onComplete={onComplete} />;
    case 'drag-categorize':
      return <DragCategorize spec={spec} onComplete={onComplete} />;
  }
}

/**
 * Specs cross a network boundary from a model, so they are parsed rather than
 * trusted — a malformed spec degrades to a visible notice, not a crash.
 */
export function WidgetRenderer({ spec, onComplete }: { spec: unknown; onComplete?: () => void }) {
  const parsed = widgetSpec.safeParse(spec);

  if (!parsed.success) {
    return (
      <Alert variant="warning">
        <AlertDescription>This widget spec did not match any registered schema.</AlertDescription>
      </Alert>
    );
  }

  return render(parsed.data, onComplete);
}
