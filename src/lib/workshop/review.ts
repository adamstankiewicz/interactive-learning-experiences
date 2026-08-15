import { scoringModel } from '@/lib/model';
import { generateStructured } from '@/lib/structured';
import { buildReviewPrompt, REVIEW_SYSTEM } from '@/lib/workshop/prompt';
import {
  locate,
  modelReview,
  withoutOverlaps,
  type Annotation,
  type ReviewRequest,
  type ReviewResult,
} from '@/lib/workshop/schema';

// Resolved once, lazily: `scoringModel()` throws when its provider env vars are
// missing, and doing that at module scope would fail the import rather than the
// request that actually needed a model.
let cachedModel: ReturnType<typeof scoringModel> | null = null;
const model = () => (cachedModel ??= scoringModel());

/**
 * Read one draft and place the notes on it.
 *
 * The model marks; this resolves each note's quote to a range in the actual
 * text. A note whose quote cannot be found is kept but reported as unplaced
 * rather than dropped — the comment is still real feedback, it just has nowhere
 * to sit, and silently discarding it would lose something the student should
 * read.
 *
 * Transport-agnostic like `scoreDraft` and `reviewDefense`: the HTTP route is
 * one call site and an MCP tool later is a second, not a second implementation.
 */
export async function reviewDraft(input: ReviewRequest): Promise<ReviewResult> {
  const raw = await generateStructured({
    schema: modelReview,
    system: REVIEW_SYSTEM,
    prompt: buildReviewPrompt(input),
    // Determinism, for the same reason the other graders use it: a student who
    // resubmits an unchanged draft and gets different marks learns the feedback
    // is weather rather than a reading of their work.
    temperature: 0,
    model: model(),
  });

  const plain = (text: string) => text.replace(/[*_`]/g, '').trim();
  const offered = new Set(input.dimensions.map((d) => d.id));

  const annotations: Annotation[] = [];
  const unplaced: ReviewResult['unplaced'] = [];

  for (const note of raw.notes) {
    // A note attributed to a dimension nobody asked about is out of scope; pin
    // it to the first real one rather than letting it colour nothing.
    const dimensionId = offered.has(note.dimensionId)
      ? note.dimensionId
      : (input.dimensions[0]?.id ?? note.dimensionId);

    const range = locate(input.draft, note.quote);
    const comment = plain(note.comment);

    if (!range) {
      unplaced.push({ kind: note.kind, dimensionId, comment });
      continue;
    }

    annotations.push({ ...range, kind: note.kind, dimensionId, comment });
  }

  return {
    annotations: withoutOverlaps(annotations),
    overall: plain(raw.overall),
    nextStep: raw.nextStep ? plain(raw.nextStep) : null,
    unplaced,
  };
}
