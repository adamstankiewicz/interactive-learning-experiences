/**
 * Learning Commons returns standard descriptions with LaTeX math inline —
 * e.g. "Understand a fraction $\frac{1}{b}$ as the quantity...". Rendering that
 * raw puts backslashes in front of teachers, and pulling in a full math
 * renderer is far more than these few constructs justify.
 *
 * This handles the notation the graph actually uses and leaves anything else
 * alone rather than mangling it.
 */
export function plainMath(text: string): string {
  return (
    text
      // \frac{a}{b} and \dfrac{a}{b} -> a/b
      .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
      // \times, \div, \cdot -> readable operators
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\cdot/g, '·')
      // \leq, \geq, \neq
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      // Drop the $ math delimiters once their contents are plain.
      .replace(/\$/g, '')
      // \text{...} wrappers contribute only their contents.
      .replace(/\\text\s*\{([^{}]*)\}/g, '$1')
      // Collapse whitespace the substitutions may have left behind.
      .replace(/\s+/g, ' ')
      .trim()
  );
}
