'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crossword } from '@/components/widgets/Crossword';
import { DragCategorize } from '@/components/widgets/DragCategorize';
import { Flashcard } from '@/components/widgets/Flashcard';
import { DragSort } from '@/components/widgets/DragSort';
import { DraftMeter } from '@/components/widgets/DraftMeter';
import { MarkdownCard } from '@/components/widgets/MarkdownCard';
import { FractionAreaModel } from '@/components/widgets/FractionAreaModel';
import { SwiperFlashcard } from '@/components/widgets/SwiperFlashcard';
import { NarratedCard } from '@/components/widgets/NarratedCard';
import { StepReveal } from '@/components/widgets/StepReveal';
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
    case 'draft-meter':
      return <DraftMeter spec={spec} />;
    case 'drag-sort':
      return <DragSort spec={spec} />;
    case 'drag-categorize':
      return <DragCategorize spec={spec} />;
    case 'markdown-card':
      return <MarkdownCard spec={spec} />;
    case 'flashcard':
      return <Flashcard spec={spec} />;
    case 'step-reveal':
      return <StepReveal spec={spec} />;
    case 'narrated-card':
      return <NarratedCard spec={spec} />;
    case 'crossword':
      return <Crossword spec={spec} />;
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
