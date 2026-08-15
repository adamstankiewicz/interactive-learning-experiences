import { lazy } from 'react';
import { flashcardSpec, type FlashcardSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<FlashcardSpec>({
  kind: 'flashcard',
  schema: flashcardSpec,
  // Reaching the last card reports success, so there is no answer to record.
  assesses: false,
  component: lazy(() =>
    import('@/components/widgets/Flashcard').then((m) => ({ default: m.Flashcard })),
  ),
  plannerDescription: 'A flip-card deck — tap to reveal the back, navigate with arrows. Each side supports text, markdown, and images. Good for vocabulary, definitions, and worked examples.',
});
