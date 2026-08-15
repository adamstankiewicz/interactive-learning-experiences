import { SwiperFlashcard } from '@/components/widgets/SwiperFlashcard';
import { swiperFlashcardSpec, type SwiperFlashcardSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<SwiperFlashcardSpec>({
  kind: 'swiper-flashcard',
  schema: swiperFlashcardSpec,
  component: SwiperFlashcard,
  plannerDescription:
    'A binary sort of statements (true/false, example/non-example, prime/composite) that suits almost any subject.',
  // No coverageRule — fits every standard, which is what makes it a safe fallback.
});
