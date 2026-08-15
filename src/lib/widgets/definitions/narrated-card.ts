import { lazy } from 'react';
import { narratedCardSpec, type NarratedCardSpec } from '@/lib/pathway/schema';
import { registerWidgetCatalog } from '@/lib/widgets/types';

registerWidgetCatalog<NarratedCardSpec>({
  kind: 'narrated-card',
  schema: narratedCardSpec,
  assesses: false,
  component: lazy(() =>
    import('@/components/widgets/NarratedCard').then((m) => ({ default: m.NarratedCard })),
  ),
  plannerDescription: 'Reads content aloud using browser TTS, revealing each sentence as it is spoken. Steps stack up as they complete. Good for accessibility and audio-first learners.',
});
