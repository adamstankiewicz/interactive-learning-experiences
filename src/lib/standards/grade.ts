/**
 * Grade-level gating for `coverageRule`s that need a floor, not just a
 * content tag — e.g. draft-meter's abstract argumentative writing isn't a
 * K-2 task regardless of which writing standard it's serving.
 */

function gradeNumber(label: string): number | null {
  if (label.trim().toUpperCase() === 'K') return 0;
  const n = Number(label);
  return Number.isFinite(n) ? n : null;
}

/**
 * True when the standard's grade range reaches at least `min` — the most
 * permissive read (any parseable grade in range clears the bar), not the
 * strictest. Standards with no parseable grade info (empty array, or an
 * unverified Discovery-mode standard) are never gated — there's nothing to
 * gate on, so the widget stays eligible rather than being excluded by
 * missing data.
 */
export function reachesGrade(gradeLevels: string[], min: number): boolean {
  const numbers = gradeLevels.map(gradeNumber).filter((n): n is number => n !== null);
  if (numbers.length === 0) return true;
  return Math.max(...numbers) >= min;
}
