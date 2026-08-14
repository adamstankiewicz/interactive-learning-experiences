import { z } from 'zod';

/**
 * The scoring contract.
 *
 * A deliberate split: the model returns a single `score` and the qualitative
 * signals behind it, and everything presentational is derived from that score
 * in code. Asking the model for score *and* band *and* label invites the three
 * to disagree — a 22 labelled "strong" — and there is no good way to reconcile
 * that at render time. One number is the judgement; the rest is a lookup.
 */

export const BANDS = ['developing', 'approaching', 'proficient', 'advanced'] as const;
export type Band = (typeof BANDS)[number];

/**
 * The label ladder. Warm, never punitive — and deliberately not about progress.
 *
 * The first version read "just starting" at the bottom, which describes how
 * much someone has written rather than how their argument is doing. A finished
 * four-sentence answer that never cites the source is not "just starting"; it
 * is done, and it needs work. Only the empty box is actually just starting.
 */
const BAND_LABEL: Record<Band, string> = {
  developing: 'needs work',
  approaching: 'getting closer',
  proficient: 'almost there',
  advanced: 'strong',
};

/** Thresholds are stated in the scoring prompt too, so the model aims at them. */
export function bandForScore(score: number): Band {
  if (score >= 85) return 'advanced';
  if (score >= 60) return 'proficient';
  if (score >= 35) return 'approaching';
  return 'developing';
}

export function labelForBand(band: Band): string {
  return BAND_LABEL[band];
}

/*
 * A second approach — labelling by missing criterion ("needs a side" / "needs
 * a why" / "needs a quote") rather than by band — was built and compared side
 * by side, then dropped: the band ladder plus an openable hint carries the
 * same information with less jitter, since a criterion label flips whenever a
 * single boolean does. Written up in CLAUDE_HACKATHON.md.
 */

/**
 * What the model returns. Bounds live in `.describe()` rather than `.min()`/
 * `.max()` for the reason documented in `pathway/schema.ts`: providers drop
 * numeric bounds when serialising to strict JSON Schema, so a hard bound here
 * rejects output the model was never shown the rule for.
 */
export const modelScore = z.object({
  score: z
    .number()
    .describe('0-100. 0-34 developing, 35-59 approaching, 60-84 proficient, 85-100 advanced.'),
  signals: z
    .object({
      stance: z.boolean().describe('Did they commit to a position rather than survey both sides?'),
      reasoning: z.boolean().describe('Did they say why — a because, not just a what?'),
      evidence: z
        .boolean()
        .describe('Did they point at something outside their own head — a fact, source, or example?'),
    })
    .describe('What you actually found. These drive the nudge; they are never shown as scores.'),
  nudge: z
    .string()
    .nullable()
    .describe(
      'At most 90 characters, or null when the response is already strong. One concrete next move, addressed to the student. Never praise-only, never a list.',
    ),
  confidence: z.number().describe('0-1. How sure you are, given how much they have written so far.'),
});

export type ModelScore = z.infer<typeof modelScore>;

/** What `/api/score` returns: the model's judgement plus the derived presentation. */
export type ScoreResult = ModelScore & {
  band: Band;
  /** Band ladder: needs work / getting closer / almost there / strong. */
  label: string;
  /**
   * All three signals present. The widget marks the finish line with this
   * rather than letting the hint pill silently vanish — an empty space is
   * ambiguous, and "you are done" is the whole point of having goalposts.
   */
  criteriaMet: boolean;
};

/** What the widget posts. Parsed rather than trusted — it crosses the network. */
export const scoreRequest = z.object({
  response: z.string(),
  question: z.string(),
  standardCode: z.string(),
  standardDescription: z.string(),
  criteria: z.array(z.string()).default([]),
  /** Present for reading standards; null when the argument comes from the student. */
  passage: z
    .object({ source: z.string(), text: z.string() })
    .nullable()
    .default(null),
});

export type ScoreRequest = z.infer<typeof scoreRequest>;
