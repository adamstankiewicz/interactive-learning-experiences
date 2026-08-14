'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
<<<<<<< Updated upstream
import { DragCategorize } from '@/components/widgets/DragCategorize';
import { DragSort } from '@/components/widgets/DragSort';
=======
<<<<<<< Updated upstream
>>>>>>> Stashed changes
import { DraftMeter } from '@/components/widgets/DraftMeter';
=======
import { DragCategorize } from '@/components/widgets/DragCategorize';
import { DragSort } from '@/components/widgets/DragSort';
>>>>>>> Stashed changes
import { FractionAreaModel } from '@/components/widgets/FractionAreaModel';
import { SwiperFlashcard } from '@/components/widgets/SwiperFlashcard';
import { widgetSpec, type WidgetSpec } from '@/lib/pathway/schema';

/**
 * Spec -> component. This is the extension point: adding a widget type means
 * a schema in `pathway/schema.ts`, a generator in `pathway/generate.ts`, and
 * a case here. The exhaustive switch makes a missing case a type error.
 */
function render(spec: WidgetSpec) {
  switch (spec.kind) {
    case 'fraction-area-model':
      return <FractionAreaModel spec={spec} />;
    case 'swiper-flashcard':
      return <SwiperFlashcard spec={spec} />;
<<<<<<< Updated upstream
    case 'draft-meter':
      return <DraftMeter spec={spec} />;
<<<<<<< Updated upstream
=======
=======
>>>>>>> Stashed changes
    case 'drag-sort':
      return <DragSort spec={spec} />;
    case 'drag-categorize':
      return <DragCategorize spec={spec} />;
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes
  }
}

/**
 * Specs cross a network boundary from a model, so they are parsed rather than
 * trusted — a malformed spec degrades to a visible notice, not a crash.
 */
export function WidgetRenderer({ spec }: { spec: unknown }) {
  const parsed = widgetSpec.safeParse(spec);

  if (!parsed.success) {
    return (
      <Alert variant="warning">
        <AlertDescription>This widget spec did not match any registered schema.</AlertDescription>
      </Alert>
    );
  }

  return render(parsed.data);
}
