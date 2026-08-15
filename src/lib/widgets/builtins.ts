/**
 * Client-safe widget catalog registration — schema, component, coverageRule,
 * plannerDescription. No AI SDK import anywhere in this graph; safe for a
 * client component (`components/widgets/registry.tsx`) to import.
 *
 * To add a widget kind: add its catalog registration here, and its generator in
 * `builtins.generate.ts`. The `widgetSpec` union and `widgetKind` enum in
 * `pathway/schema.ts` still need it too — see CONTRIBUTING.md for the full list.
 */
import '@/lib/widgets/definitions/fraction-area-model';
import '@/lib/widgets/definitions/swiper-flashcard';
import '@/lib/widgets/definitions/draft-meter';
import '@/lib/widgets/definitions/defend-claim';
import '@/lib/widgets/definitions/drag-sort';
import '@/lib/widgets/definitions/drag-categorize';
import '@/lib/widgets/definitions/crossword';
import '@/lib/widgets/definitions/markdown-card';
import '@/lib/widgets/definitions/flashcard';
import '@/lib/widgets/definitions/step-reveal';
import '@/lib/widgets/definitions/narrated-card';
import '@/lib/widgets/definitions/timeline-builder';
import '@/lib/widgets/definitions/find-the-flaw';
import '@/lib/widgets/definitions/draw-the-curve';
import '@/lib/widgets/definitions/debate-ai';
import '@/lib/widgets/definitions/writing-workshop';
