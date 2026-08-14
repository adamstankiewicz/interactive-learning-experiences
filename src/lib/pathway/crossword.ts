import type { CrosswordEntrySpec } from '@/lib/pathway/schema';

/**
 * Crossword layout, done in code rather than asked of the model.
 *
 * Models are good at vocabulary and clues and bad at two-dimensional bookkeeping:
 * ask one for a grid and you get overlapping words, phantom crossings, and clue
 * numbers that reference nothing. So the model authors term/clue pairs and this
 * module interlocks them — greedy placement, longest word first, every candidate
 * position validated against real crossword rules.
 *
 * The function is pure and deterministic, which is what lets the generator prune
 * unplaceable terms server-side and the component re-derive the identical grid at
 * render time from the pruned list (see `normalizeCrossword` in `generate.ts`).
 */

export type Direction = 'across' | 'down';

/** A term that earned a place in the grid, with its coordinates and clue number. */
export type PlacedEntry = Omit<CrosswordEntrySpec, 'answer'> & {
  /** Sanitized: uppercase A–Z only. */
  answer: string;
  number: number;
  direction: Direction;
  row: number;
  col: number;
};

export type CrosswordLayout = {
  rows: number;
  cols: number;
  /** Row-major letters; `null` is a blocked square. */
  grid: (string | null)[][];
  /** Placed terms, in clue-number order. */
  entries: PlacedEntry[];
  /** Sanitized answers that could not be interlocked, in the order they were tried. */
  unplaced: string[];
};

/** Below 3 letters a term crosses everything and clues nothing; above 12 it dominates the grid. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 12;

const cellKey = (row: number, col: number) => `${row},${col}`;

/** Fold a model-authored answer to grid letters: "least common denominator" is not a crossword entry. */
export function sanitizeAnswer(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '');
}

/** The cell `offset` steps along `direction` from a start cell. */
function step(direction: Direction, row: number, col: number, offset: number) {
  return direction === 'across' ? { row, col: col + offset } : { row: row + offset, col };
}

type Cell = { letter: string; directions: Set<Direction> };

/**
 * Can `answer` sit at (row, col) running `direction`? Returns the number of
 * crossings if so, `null` if the placement breaks a crossword rule.
 */
function crossingsFor(
  cells: Map<string, Cell>,
  answer: string,
  row: number,
  col: number,
  direction: Direction,
): number | null {
  // A word must not butt up against another word end-to-end, which would read
  // as one longer, unclued word.
  const before = step(direction, row, col, -1);
  const after = step(direction, row, col, answer.length);
  if (cells.has(cellKey(before.row, before.col))) return null;
  if (cells.has(cellKey(after.row, after.col))) return null;

  let crossings = 0;

  for (let index = 0; index < answer.length; index += 1) {
    const { row: r, col: c } = step(direction, row, col, index);
    const existing = cells.get(cellKey(r, c));

    if (existing) {
      if (existing.letter !== answer[index]) return null;
      // Sharing a cell with a word running the same way means overlapping it,
      // not crossing it.
      if (existing.directions.has(direction)) return null;
      crossings += 1;
      continue;
    }

    // An empty cell may not sit alongside a parallel word, or the two together
    // spell a second word down the side that nobody wrote a clue for.
    const sideA = direction === 'across' ? cellKey(r - 1, c) : cellKey(r, c - 1);
    const sideB = direction === 'across' ? cellKey(r + 1, c) : cellKey(r, c + 1);
    if (cells.has(sideA) || cells.has(sideB)) return null;
  }

  return crossings;
}

function write(
  cells: Map<string, Cell>,
  answer: string,
  row: number,
  col: number,
  direction: Direction,
) {
  for (let index = 0; index < answer.length; index += 1) {
    const { row: r, col: c } = step(direction, row, col, index);
    const key = cellKey(r, c);
    const existing = cells.get(key);

    if (existing) existing.directions.add(direction);
    else cells.set(key, { letter: answer[index], directions: new Set([direction]) });
  }
}

type Bounds = { minRow: number; maxRow: number; minCol: number; maxCol: number };

function extend(bounds: Bounds, answer: string, row: number, col: number, direction: Direction): Bounds {
  const end = step(direction, row, col, answer.length - 1);

  return {
    minRow: Math.min(bounds.minRow, row),
    maxRow: Math.max(bounds.maxRow, end.row),
    minCol: Math.min(bounds.minCol, col),
    maxCol: Math.max(bounds.maxCol, end.col),
  };
}

type Placement = { row: number; col: number; direction: Direction };

/**
 * Score a candidate: crossings first — they are what makes a crossword a
 * crossword — then compactness, so the grid stays square rather than sprawling
 * into a diagonal ladder.
 */
function score(crossings: number, bounds: Bounds): number {
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;

  return crossings * 100 - (width + height) * 2 - Math.abs(width - height);
}

function bestPlacement(
  cells: Map<string, Cell>,
  placed: Array<{ answer: string } & Placement>,
  bounds: Bounds,
  answer: string,
): Placement | null {
  let best: Placement | null = null;
  let bestScore = -Infinity;

  for (const anchor of placed) {
    const direction: Direction = anchor.direction === 'across' ? 'down' : 'across';

    for (let anchorIndex = 0; anchorIndex < anchor.answer.length; anchorIndex += 1) {
      for (let index = 0; index < answer.length; index += 1) {
        if (answer[index] !== anchor.answer[anchorIndex]) continue;

        const shared = step(anchor.direction, anchor.row, anchor.col, anchorIndex);
        const start = step(direction, shared.row, shared.col, -index);

        const crossings = crossingsFor(cells, answer, start.row, start.col, direction);
        if (crossings === null || crossings === 0) continue;

        const candidateScore = score(crossings, extend(bounds, answer, start.row, start.col, direction));
        // Strictly greater keeps the first candidate on ties, so the result is
        // a function of the input order alone.
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          best = { row: start.row, col: start.col, direction };
        }
      }
    }
  }

  return best;
}

/** Standard crossword numbering: a cell is numbered when a word starts there. */
function numberCells(grid: (string | null)[][]): Map<string, number> {
  const numbers = new Map<string, number>();
  let next = 1;

  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (!grid[row][col]) continue;

      const startsAcross = !grid[row][col - 1] && Boolean(grid[row][col + 1]);
      const startsDown = !grid[row - 1]?.[col] && Boolean(grid[row + 1]?.[col]);

      if (startsAcross || startsDown) numbers.set(cellKey(row, col), next++);
    }
  }

  return numbers;
}

/**
 * Interlock as many entries as possible. Terms that cannot cross anything
 * already on the grid are reported in `unplaced` rather than floated loose.
 */
export function layoutCrossword(entries: CrosswordEntrySpec[]): CrosswordLayout {
  const unplaced: string[] = [];
  const seen = new Set<string>();
  const candidates: Array<CrosswordEntrySpec & { answer: string }> = [];

  for (const entry of entries) {
    const answer = sanitizeAnswer(entry.answer);

    if (answer.length < MIN_LENGTH || answer.length > MAX_LENGTH || seen.has(answer)) {
      unplaced.push(answer || entry.answer);
      continue;
    }

    seen.add(answer);
    candidates.push({ ...entry, answer });
  }

  // Longest first: a long word offers the most crossing points to everything
  // placed after it. `sort` is stable, so equal lengths keep authored order —
  // which is what makes this function's output depend only on its input.
  candidates.sort((a, b) => b.answer.length - a.answer.length);

  const cells = new Map<string, Cell>();
  const placed: Array<(typeof candidates)[number] & Placement> = [];
  let bounds: Bounds = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };

  for (const candidate of candidates) {
    if (placed.length === 0) {
      write(cells, candidate.answer, 0, 0, 'across');
      placed.push({ ...candidate, row: 0, col: 0, direction: 'across' });
      bounds = extend(bounds, candidate.answer, 0, 0, 'across');
      continue;
    }

    const placement = bestPlacement(cells, placed, bounds, candidate.answer);
    if (!placement) {
      unplaced.push(candidate.answer);
      continue;
    }

    write(cells, candidate.answer, placement.row, placement.col, placement.direction);
    placed.push({ ...candidate, ...placement });
    bounds = extend(bounds, candidate.answer, placement.row, placement.col, placement.direction);
  }

  if (placed.length === 0) {
    return { rows: 0, cols: 0, grid: [], entries: [], unplaced };
  }

  const rows = bounds.maxRow - bounds.minRow + 1;
  const cols = bounds.maxCol - bounds.minCol + 1;
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));

  for (const [key, cell] of cells) {
    const [row, col] = key.split(',').map(Number);
    grid[row - bounds.minRow][col - bounds.minCol] = cell.letter;
  }

  const numbers = numberCells(grid);

  const numbered: PlacedEntry[] = placed.map((entry) => {
    const row = entry.row - bounds.minRow;
    const col = entry.col - bounds.minCol;

    return { ...entry, row, col, number: numbers.get(cellKey(row, col)) ?? 0 };
  });

  numbered.sort((a, b) => a.number - b.number);

  return { rows, cols, grid, entries: numbered, unplaced };
}
