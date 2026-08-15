/**
 * Server-only widget generators — the actual model calls. Imports the AI SDK
 * transitively; only ever imported by `pathway/generate.ts`, never by a
 * client component. Import `./builtins` (not this file) for rendering.
 */
import '@/lib/widgets/definitions/fraction-area-model.generate';
import '@/lib/widgets/definitions/swiper-flashcard.generate';
import '@/lib/widgets/definitions/draft-meter.generate';
import '@/lib/widgets/definitions/drag-sort.generate';
import '@/lib/widgets/definitions/drag-categorize.generate';
import '@/lib/widgets/definitions/crossword.generate';
