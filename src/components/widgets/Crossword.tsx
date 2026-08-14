'use client';

import { useMemo, useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { plainMath } from '@/lib/learning-commons/format';
import { layoutCrossword, type Direction, type PlacedEntry } from '@/lib/pathway/crossword';
import type { CrosswordSpec } from '@/lib/pathway/schema';

/**
 * A vocabulary crossword built from the standard's own language. The spec
 * carries terms and clues; the grid is interlocked at render time by the same
 * deterministic layout the generator used to prune unplaceable terms, so what
 * appears here is exactly what the API said was in the puzzle.
 */

const cellKey = (row: number, col: number) => `${row},${col}`;

/** Every cell an entry occupies, from its first letter to its last. */
function cellsOf(entry: PlacedEntry) {
  return Array.from({ length: entry.answer.length }, (_, index) =>
    entry.direction === 'across'
      ? { row: entry.row, col: entry.col + index }
      : { row: entry.row + index, col: entry.col },
  );
}

function stepWithin(entry: PlacedEntry, row: number, col: number, delta: number) {
  const index = entry.direction === 'across' ? col - entry.col : row - entry.row;
  const next = index + delta;

  if (next < 0 || next >= entry.answer.length) return null;
  return cellsOf(entry)[next];
}

type Cursor = { row: number; col: number; direction: Direction };

const ARROWS: Record<string, { direction: Direction; delta: number }> = {
  ArrowRight: { direction: 'across', delta: 1 },
  ArrowLeft: { direction: 'across', delta: -1 },
  ArrowDown: { direction: 'down', delta: 1 },
  ArrowUp: { direction: 'down', delta: -1 },
};

export function Crossword({ spec }: { spec: CrosswordSpec }) {
  const layout = useMemo(() => layoutCrossword(spec.entries), [spec.entries]);

  /** Which entries pass through each cell — a cell has an across, a down, or both. */
  const cellEntries = useMemo(() => {
    const map = new Map<string, { across?: PlacedEntry; down?: PlacedEntry }>();

    for (const entry of layout.entries) {
      for (const { row, col } of cellsOf(entry)) {
        const at = map.get(cellKey(row, col)) ?? {};
        at[entry.direction] = entry;
        map.set(cellKey(row, col), at);
      }
    }

    return map;
  }, [layout]);

  /** Tab order: all Across clues, then all Down — the order a solver reads them in. */
  const ordered = useMemo(
    () => [
      ...layout.entries.filter((entry) => entry.direction === 'across'),
      ...layout.entries.filter((entry) => entry.direction === 'down'),
    ],
    [layout],
  );

  const [letters, setLetters] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(() => {
    const first = layout.entries[0];
    return first ? { row: first.row, col: first.col, direction: first.direction } : null;
  });

  const inputs = useRef(new Map<string, HTMLInputElement | null>());

  const at = cursor ? cellEntries.get(cellKey(cursor.row, cursor.col)) : undefined;
  const activeEntry = (cursor && at ? (at[cursor.direction] ?? at.across ?? at.down) : null) ?? null;

  const activeCells = useMemo(
    () => new Set(activeEntry ? cellsOf(activeEntry).map(({ row, col }) => cellKey(row, col)) : []),
    [activeEntry],
  );

  const answerOf = (entry: PlacedEntry) =>
    cellsOf(entry)
      .map(({ row, col }) => letters[cellKey(row, col)] ?? '')
      .join('');

  const filledCount = layout.entries.filter((entry) => answerOf(entry).length === entry.answer.length).length;
  const solvedCount = layout.entries.filter((entry) => answerOf(entry) === entry.answer).length;
  const allCorrect = layout.entries.length > 0 && solvedCount === layout.entries.length;
  // Any letter at all is enough to check: a half-filled grid is exactly when a
  // student most wants to know whether they are on the right track.
  const hasLetters = Object.values(letters).some(Boolean);

  function focusCell(row: number, col: number) {
    inputs.current.get(cellKey(row, col))?.focus();
  }

  function moveTo(row: number, col: number, direction: Direction) {
    setCursor({ row, col, direction });
    focusCell(row, col);
  }

  function selectEntry(entry: PlacedEntry) {
    moveTo(entry.row, entry.col, entry.direction);
  }

  /** Clicking a cell that carries two entries a second time switches between them. */
  function handleCellClick(row: number, col: number) {
    const cell = cellEntries.get(cellKey(row, col));
    if (!cell) return;

    const onCursor = cursor?.row === row && cursor?.col === col;
    const other: Direction = cursor?.direction === 'across' ? 'down' : 'across';

    if (onCursor && cell[other]) return moveTo(row, col, other);
    if (cursor && cell[cursor.direction]) return moveTo(row, col, cursor.direction);
    moveTo(row, col, cell.across ? 'across' : 'down');
  }

  function handleChange(row: number, col: number, value: string) {
    const letter = value.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();

    setChecked(false);
    setLetters((previous) => ({ ...previous, [cellKey(row, col)]: letter }));

    if (!letter || !activeEntry) return;

    const next = stepWithin(activeEntry, row, col, 1);
    if (next) moveTo(next.row, next.col, activeEntry.direction);
  }

  /** The next filled square in a direction, skipping over blocked ones. */
  function neighbour(row: number, col: number, direction: Direction, delta: number) {
    let [r, c] = [row, col];

    for (;;) {
      if (direction === 'across') c += delta;
      else r += delta;

      if (r < 0 || c < 0 || r >= layout.rows || c >= layout.cols) return null;
      if (layout.grid[r][c]) return { row: r, col: c };
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const arrow = ARROWS[event.key];

    if (arrow) {
      event.preventDefault();
      const target = neighbour(row, col, arrow.direction, arrow.delta);
      if (target) moveTo(target.row, target.col, arrow.direction);
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleCellClick(row, col);
      return;
    }

    if (event.key === 'Tab') {
      if (!ordered.length) return;
      event.preventDefault();
      const index = activeEntry ? ordered.indexOf(activeEntry) : -1;
      const step = event.shiftKey ? -1 : 1;
      selectEntry(ordered[(index + step + ordered.length) % ordered.length]);
      return;
    }

    // Backspace clears this square, or steps back and clears that one when the
    // square is already empty — the behaviour every crossword solver expects.
    if (event.key === 'Backspace') {
      event.preventDefault();
      setChecked(false);

      if (letters[cellKey(row, col)]) {
        setLetters((previous) => ({ ...previous, [cellKey(row, col)]: '' }));
        return;
      }

      const previousCell = activeEntry ? stepWithin(activeEntry, row, col, -1) : null;
      if (!previousCell || !activeEntry) return;

      setLetters((previous) => ({ ...previous, [cellKey(previousCell.row, previousCell.col)]: '' }));
      moveTo(previousCell.row, previousCell.col, activeEntry.direction);
    }
  }

  function revealActiveEntry() {
    if (!activeEntry) return;

    setChecked(false);
    setLetters((previous) => {
      const next = { ...previous };
      cellsOf(activeEntry).forEach(({ row, col }, index) => {
        next[cellKey(row, col)] = activeEntry.answer[index];
      });
      return next;
    });
  }

  if (!layout.entries.length) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          None of this puzzle&rsquo;s terms could be interlocked into a grid.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <p className="text-base font-medium">{spec.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{spec.prompt}</p>

        {/* Grid above clues, always. The pathway column is a fixed 3xl, so a grid
            wide enough to be worth solving never leaves room for clues beside it. */}
        <div className="mt-5 flex flex-col gap-6">
          <div className="overflow-x-auto pb-1">
            <div
              role="group"
              aria-label={spec.title}
              className="grid w-max"
              style={{ gridTemplateColumns: `repeat(${layout.cols}, 2rem)` }}
            >
              {layout.grid.flatMap((cells, row) =>
                cells.map((letter, col) => {
                  if (!letter) return <div key={cellKey(row, col)} aria-hidden />;

                  const key = cellKey(row, col);
                  const cell = cellEntries.get(key);
                  const number = layout.entries.find(
                    (entry) => entry.row === row && entry.col === col,
                  )?.number;
                  const value = letters[key] ?? '';
                  const onCursor = cursor?.row === row && cursor?.col === col;

                  // Exact 1px rules: each square draws its top and left edge, and
                  // its right or bottom edge only where no open square follows.
                  const openRight = Boolean(layout.grid[row][col + 1]);
                  const openBelow = Boolean(layout.grid[row + 1]?.[col]);

                  // Tints rather than the solid tokens: these squares carry a
                  // letter, so the fill has to stay behind readable text. Same
                  // semantics as every other widget — selected, right, look again.
                  let tone = 'bg-card';
                  if (checked && value) {
                    tone = value === letter ? 'bg-success/15' : 'bg-warning/25';
                  } else if (onCursor) {
                    tone = 'bg-selected/40';
                  } else if (activeCells.has(key)) {
                    tone = 'bg-selected/15';
                  }

                  const label = [cell?.across, cell?.down]
                    .filter((entry): entry is PlacedEntry => Boolean(entry))
                    .map((entry) => `${entry.number} ${entry.direction}: ${plainMath(entry.clue)}`)
                    .join('. ');

                  return (
                    <div
                      key={key}
                      className={`relative h-8 w-8 border-t border-l border-foreground/40 ${
                        openRight ? '' : 'border-r'
                      } ${openBelow ? '' : 'border-b'} ${tone}`}
                    >
                      {number !== undefined && (
                        <span className="pointer-events-none absolute top-0 left-0.5 text-[9px] leading-tight text-muted-foreground">
                          {number}
                        </span>
                      )}
                      <input
                        ref={(element) => {
                          inputs.current.set(key, element);
                        }}
                        value={value}
                        onChange={(event) => handleChange(row, col, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(event, row, col)}
                        onClick={() => handleCellClick(row, col)}
                        onFocus={(event) => {
                          event.currentTarget.select();
                          setCursor((current) => {
                            if (current?.row === row && current?.col === col) return current;
                            const direction =
                              current && cell?.[current.direction]
                                ? current.direction
                                : cell?.across
                                  ? 'across'
                                  : 'down';
                            return { row, col, direction };
                          });
                        }}
                        aria-label={label}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={2}
                        className="h-full w-full bg-transparent pt-1 text-center text-sm font-semibold uppercase caret-transparent outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      />
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ClueList
              title="Across"
              entries={layout.entries.filter((entry) => entry.direction === 'across')}
              activeEntry={activeEntry}
              checked={checked}
              answerOf={answerOf}
              onSelect={selectEntry}
            />
            <ClueList
              title="Down"
              entries={layout.entries.filter((entry) => entry.direction === 'down')}
              activeEntry={activeEntry}
              checked={checked}
              answerOf={answerOf}
              onSelect={selectEntry}
            />
          </div>
        </div>

        {checked && (
          <Alert role="status" variant={allCorrect ? 'success' : 'warning'} className="mt-5">
            <AlertDescription>
              {allCorrect
                ? spec.successMessage
                : // Never "the squares in red": the marking is a tint, and colour
                  // alone should not be what tells a student which squares to fix.
                  `${solvedCount} of ${layout.entries.length} answers are right. The marked squares do not match — reread those clues.`}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex-wrap justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filledCount}</span> of{' '}
          <span className="font-semibold text-foreground">{layout.entries.length}</span> answers filled
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={revealActiveEntry} disabled={!activeEntry}>
            Reveal {activeEntry ? `${activeEntry.number} ${activeEntry.direction}` : 'answer'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setLetters({});
              setChecked(false);
            }}
          >
            Clear
          </Button>
          <Button size="lg" onClick={() => setChecked(true)} disabled={!hasLetters}>
            Check
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function ClueList({
  title,
  entries,
  activeEntry,
  checked,
  answerOf,
  onSelect,
}: {
  title: string;
  entries: PlacedEntry[];
  activeEntry: PlacedEntry | null;
  checked: boolean;
  answerOf: (entry: PlacedEntry) => string;
  onSelect: (entry: PlacedEntry) => void;
}) {
  if (!entries.length) return null;

  return (
    <div>
      <h3 className="font-heading text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <ul className="mt-2 space-y-1">
        {entries.map((entry) => {
          const isActive = entry === activeEntry;
          const isSolved = checked && answerOf(entry) === entry.answer;

          return (
            <li key={`${entry.number}-${entry.direction}`}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                aria-current={isActive}
                className={`w-full rounded px-2 py-1 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-ring ${
                  // Heavier than the grid's active-entry tint: a square reads as
                  // highlighted against its outlined neighbours, a line of text
                  // has nothing to be compared against.
                  isActive ? 'bg-selected/25' : 'hover:bg-muted'
                }`}
              >
                <span className="font-semibold">{entry.number}.</span>{' '}
                <span className={isSolved ? 'line-through opacity-60' : undefined}>
                  {plainMath(entry.clue)}
                </span>{' '}
                <span className="text-muted-foreground">({entry.answer.length})</span>
                {/* Where the term came from, so a teacher can see the puzzle is not invented vocabulary. */}
                {entry.sourceCode && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    {entry.source === 'prerequisite' ? 'prereq ' : ''}
                    {entry.sourceCode}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
