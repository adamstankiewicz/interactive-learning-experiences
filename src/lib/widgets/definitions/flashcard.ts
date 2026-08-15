import { Flashcard } from '@/components/widgets/Flashcard';
import { flashcardSpec, type FlashcardSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<FlashcardSpec>({
  kind: 'flashcard',
  schema: flashcardSpec,
  component: Flashcard,
  plannerDescription: 'A flip-card deck — tap to reveal the back, navigate with arrows. Each side supports text, markdown, and images. Good for vocabulary, definitions, and worked examples.',
});
