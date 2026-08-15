import { z } from 'zod';

/**
 * The review contract.
 *
 * The model returns *quotes*, not character offsets. Offsets are the obvious
 * design and they do not survive contact with a language model — an index off
 * by three underlines the wrong clause, and nothing in the output reveals that
 * it happened. A quote either appears in the draft or it does not, so a
 * mismatch is detectable and can be dropped instead of silently mislabelling
 * the student's sentence.
 */

export const workshopDimension = z.object({
  id: z.string(),
  label: z.string(),
  lookFor: z.string(),
});

export type WorkshopDimension = z.infer<typeof workshopDimension>;

export const modelReview = z.object({
  notes: z
    .array(
      z.object({
        quote: z
          .string()
          .describe(
            'The excerpt this note is about, copied from the draft EXACTLY — same words, same punctuation, same capitalisation. Five to twenty-five words: long enough to find, short enough to point at one thing.',
          ),
        kind: z
          .enum(['strength', 'weakness'])
          .describe('Whether this passage works or needs attention.'),
        dimensionId: z.string().describe('Which dimension this note is about, id copied from the list.'),
        comment: z
          .string()
          .describe(
            'One sentence to the student about this passage. Specific to these words — never a general rule that would fit any draft.',
          ),
      }),
    )
    .describe('Give 4-8 notes, and at least one strength. Spread them across the draft, not all in the opening.'),
  overall: z
    .string()
    .describe('Two or three sentences on the piece as a whole: what it is doing well and what is holding it back.'),
  nextStep: z
    .string()
    .nullable()
    .describe(
      'The single highest-value revision, addressed to the student. Null only when the piece genuinely needs nothing further.',
    ),
});

export type ModelReview = z.infer<typeof modelReview>;

/** What the widget posts. Parsed rather than trusted — it crosses the network. */
export const reviewRequest = z.object({
  draft: z.string(),
  brief: z.object({ title: z.string(), task: z.string() }),
  genre: z.string(),
  dimensions: z.array(workshopDimension).default([]),
  /** Which read this is, so the reviewer can acknowledge a revision. */
  round: z.number().default(1),
});

export type ReviewRequest = z.infer<typeof reviewRequest>;

/** A note the widget can actually draw: resolved to a range in the draft. */
export type Annotation = {
  start: number;
  end: number;
  kind: 'strength' | 'weakness';
  dimensionId: string;
  comment: string;
};

export type ReviewResult = {
  annotations: Annotation[];
  overall: string;
  nextStep: string | null;
  /**
   * Notes whose quote could not be found in the draft. Surfaced rather than
   * swallowed: they are still real feedback, they just have nowhere to sit, and
   * dropping them silently would lose comments the student should see.
   */
  unplaced: { kind: 'strength' | 'weakness'; dimensionId: string; comment: string }[];
};

/**
 * Find a quote in the draft.
 *
 * Exact match first. Failing that, whitespace-tolerant: models reflow line
 * breaks and collapse double spaces when they copy, which is the overwhelming
 * majority of near-misses, and refusing those would throw away good notes over
 * a newline. Anything looser than that starts matching text the note was not
 * about, which is worse than dropping it.
 */
export function locate(draft: string, quote: string): { start: number; end: number } | null {
  const trimmed = quote.trim();
  if (!trimmed) return null;

  const exact = draft.indexOf(trimmed);
  if (exact !== -1) return { start: exact, end: exact + trimmed.length };

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexible = new RegExp(escaped.replace(/\s+/g, '\\s+'));
  const match = flexible.exec(draft);
  if (!match) return null;

  return { start: match.index, end: match.index + match[0].length };
}

/**
 * Drop overlaps, keeping the earlier note.
 *
 * Two notes on the same words cannot both be drawn — the second would nest
 * inside the first and produce a mark with two colours and two comments. Rare,
 * but it renders as a visual glitch rather than as an error, so it is resolved
 * here rather than left to the component.
 */
export function withoutOverlaps(annotations: Annotation[]): Annotation[] {
  const sorted = [...annotations].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Annotation[] = [];

  for (const annotation of sorted) {
    const previous = kept[kept.length - 1];
    if (previous && annotation.start < previous.end) continue;
    kept.push(annotation);
  }

  return kept;
}
