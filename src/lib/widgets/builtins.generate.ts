/**
 * Server-only widget generators — the actual model calls. Imports the AI SDK
 * transitively; only ever imported by `pathway/generate.ts`, never by a
 * client component. Import `./builtins` (not this file) for rendering.
 */
import '@/lib/widgets/definitions/composed.generate';
import '@/lib/widgets/definitions/fraction-area-model.generate';
import '@/lib/widgets/definitions/swiper-flashcard.generate';
import '@/lib/widgets/definitions/draft-meter.generate';
import '@/lib/widgets/definitions/defend-claim.generate';
import '@/lib/widgets/definitions/drag-sort.generate';
import '@/lib/widgets/definitions/drag-categorize.generate';
import '@/lib/widgets/definitions/crossword.generate';
import '@/lib/widgets/definitions/markdown-card.generate';
import '@/lib/widgets/definitions/flashcard.generate';
import '@/lib/widgets/definitions/step-reveal.generate';
import '@/lib/widgets/definitions/narrated-card.generate';
import '@/lib/widgets/definitions/timeline-builder.generate';
import '@/lib/widgets/definitions/find-the-flaw.generate';
import '@/lib/widgets/definitions/draw-the-curve.generate';
import '@/lib/widgets/definitions/debate-ai.generate';
import '@/lib/widgets/definitions/writing-workshop.generate';
