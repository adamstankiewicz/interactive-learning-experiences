/**
 * Deterministic shuffle for widget item banks.
 *
 * Deterministic so a re-mount never reorders the board mid-activity, but a
 * real permutation — which the three hand-rolled copies this replaces were
 * not. They summed `charCodeAt(0)` of each item into the seed; for objects
 * that character is always `{` (123) from `JSON.stringify`, so `seed % (i+1)`
 * was always 0 and the loop degenerated to a rotate-by-one. That left
 * category-grouped and chronologically-authored banks readable in order,
 * which is the entire difficulty of those widgets.
 */

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permute<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * `avoid` is the id order the result must not equal — the correct answer for
 * an ordering task, or (by default) the order the spec authored the items in.
 */
export function seededShuffle<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  avoid?: readonly string[],
): T[] {
  if (items.length < 2) return [...items];

  const keys = items.map(keyOf);
  const forbidden = (avoid ?? keys).join('\u0000');
  const base = hashSeed(keys.join('|'));

  // An honest Fisher-Yates can legitimately land on the order we need to
  // avoid, so reseed and draw again rather than nudging the result — a nudge
  // is what made the previous implementation predictable.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = permute(items, mulberry32(base + attempt * 0x9e3779b9));
    if (candidate.map(keyOf).join('\u0000') !== forbidden) return candidate;
  }

  return permute(items, mulberry32(base + 1));
}
