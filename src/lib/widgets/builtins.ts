/**
 * Client-safe widget catalog registration — schema, component, coverageRule,
 * plannerDescription. No AI SDK import anywhere in this graph; safe for a
 * client component (`components/widgets/registry.tsx`) to import.
 *
 * To add a widget kind: add its catalog registration here (and its generator
 * in `builtins.generate.ts` — see that file). Nothing else needs editing.
 */
import '@/lib/widgets/definitions/fraction-area-model';
import '@/lib/widgets/definitions/swiper-flashcard';
import '@/lib/widgets/definitions/draft-meter';
import '@/lib/widgets/definitions/drag-sort';
import '@/lib/widgets/definitions/drag-categorize';
import '@/lib/widgets/definitions/crossword';
import '@/lib/widgets/definitions/markdown-card';
import '@/lib/widgets/definitions/flashcard';
import '@/lib/widgets/definitions/step-reveal';
import '@/lib/widgets/definitions/narrated-card';
import '@/lib/widgets/definitions/timeline-builder';
