/**
 * Which standards each widget generator can serve.
 *
 * The gates live here rather than inline in `generate.ts` because two places
 * need them: the generator itself, and `streamPathway`, which reports a skip
 * before doing any work. One source keeps those from drifting apart.
 */

/** CCSS-M fractions, grades 3-5. */
export const FRACTION_CODE = /^(3|4|5)\.NF\./;

/** CCSS ELA writing (W.8.1) and literacy-in-content writing (WHST.6-8.1). */
export const WRITING_CODE = /^W(HST)?\./;

/**
 * Reading standards the Draft Meter can honestly score — and only these.
 *
 * Strand 1 is "cite textual evidence" and strand 8 is "evaluate the argument
 * and specific claims"; both are measured by stance, reasoning and evidence,
 * which is exactly what the meter measures. Deliberately excluded: strand 2
 * (summary / central idea) and strand 4 (word meaning, tone), where a student
 * is judged on interpretive accuracy rather than on taking a defensible
 * position. Pointing this meter at a poem would produce a confident score of
 * the wrong thing.
 *
 * Matches RL.8.1, RI.8.8, RH.6-8.1, RST.6-8.8 and friends.
 */
export const READING_EVIDENCE_CODE = /^(RL|RI|RH|RST)\.[0-9-]+\.(1|8)$/;

/** True when some generator can serve this standard. */
export function hasGeneratorFor(statementCode: string): boolean {
  return (
    FRACTION_CODE.test(statementCode) ||
    WRITING_CODE.test(statementCode) ||
    READING_EVIDENCE_CODE.test(statementCode)
  );
}

/** Prose list of what is registered, for the note when nothing matches. */
export const COVERAGE_SENTENCE =
  'fraction area models (3–5.NF) and short written argument (W, WHST, and RL/RI/RH/RST strands 1 and 8)';
