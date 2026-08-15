'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  getFirstCollision,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import type { DragCategorizeSpec } from '@/lib/pathway/schema';

type Item = DragCategorizeSpec['items'][number];
type Category = DragCategorizeSpec['categories'][number];
type Placement = Record<string, string | null>; // itemId -> categoryId | null

type Props = { spec: DragCategorizeSpec; onComplete?: (correct: boolean) => void };

const ARROW_CODES: string[] = [KeyboardCode.Up, KeyboardCode.Down, KeyboardCode.Left, KeyboardCode.Right];

/**
 * `@dnd-kit/sortable`'s `sortableKeyboardCoordinates` never moves anything in
 * this widget: after finding the nearest droppable in the pressed direction,
 * it looks up the *dragged chip itself* in the droppable-containers map to
 * compute a sort-insertion offset — a lookup that only succeeds when the
 * dragged element is also registered as a droppable, which is what
 * `useSortable` does for items inside a `SortableContext`. This widget isn't
 * reordering a list, it's moving a chip between distinct containers (the
 * bank, N category columns), so chips here are `useDraggable` only, that
 * lookup is always undefined, and the built-in getter silently bails out
 * every time — confirmed by watching the chip's transform stay at (0,0,0)
 * across every arrow press before this fix.
 *
 * This getter does the same "closest droppable in the pressed direction" search,
 * but skips the sort-insertion step and returns the center of that droppable
 * directly, which is what container-to-container movement actually needs.
 */
const zoneKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { active, collisionRect, droppableRects, droppableContainers, over } = context;

  if (!ARROW_CODES.includes(event.code) || !active || !collisionRect) return undefined;
  event.preventDefault();

  const candidates = droppableContainers.getEnabled().filter((entry) => {
    if (!entry || entry.disabled) return false;
    const rect = droppableRects.get(entry.id);
    if (!rect) return false;

    switch (event.code) {
      case KeyboardCode.Down:
        return collisionRect.top < rect.top;
      case KeyboardCode.Up:
        return collisionRect.top > rect.top;
      case KeyboardCode.Left:
        return collisionRect.left > rect.left;
      case KeyboardCode.Right:
        return collisionRect.left < rect.left;
      default:
        return false;
    }
  });

  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: candidates,
    pointerCoordinates: null,
  });

  let closestId = getFirstCollision(collisions, 'id');
  if (closestId === over?.id && collisions.length > 1) {
    closestId = collisions[1]?.id ?? closestId;
  }
  if (closestId == null) return undefined;

  const targetRect = droppableRects.get(closestId);
  if (!targetRect) return undefined;

  return {
    x: targetRect.left + targetRect.width / 2 - collisionRect.width / 2,
    y: targetRect.top + targetRect.height / 2 - collisionRect.height / 2,
  };
};

/**
 * Derives an easier or harder instance by showing fewer or more items per
 * category — a pure subset of what the model already grounded, never new
 * items. Every category keeps at least one item, so no column goes empty.
 * Level 0-100 maps linearly onto 1..maxPerCategory; the same level always
 * derives the same spec.
 *
 * Known caveat: `hint`/`successMessage` are free text the model wrote for
 * the *full* item set and may name specific items by label (e.g. "kelp") —
 * trimming can leave a stale reference on screen. `varyFractionAreaModel`
 * had the same class of gap for its own success text before it was caught
 * in testing; fixing this one for real would mean the generator authors
 * copy that does not depend on which items happen to survive the trim.
 */
export function varyDragCategorize(base: DragCategorizeSpec, level: number): DragCategorizeSpec {
  const byCategory = base.categories.map((cat) => base.items.filter((item) => item.categoryId === cat.id));
  const maxPerCategory = Math.max(1, ...byCategory.map((items) => items.length));
  const count = Math.max(1, Math.round((level / 100) * (maxPerCategory - 1)) + 1);

  return {
    ...base,
    items: byCategory.flatMap((items) => items.slice(0, Math.min(count, items.length))),
  };
}

function buildInitialPlacement(items: Item[]): Placement {
  return Object.fromEntries(items.map((it) => [it.id, null]));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const seed = copy.slice(0, i + 1).reduce((acc, it) => acc + JSON.stringify(it).charCodeAt(0), 0);
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ── Draggable chip ────────────────────────────────────────────────────────────

function DraggableChip({
  item,
  inZone,
  phase,
  isDragging,
  chipRef,
}: {
  item: Item;
  inZone: boolean;
  phase: 'idle' | 'correct' | 'wrong';
  isDragging: boolean;
  chipRef?: (el: HTMLDivElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    disabled: phase !== 'idle',
  });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        chipRef?.(el);
      }}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      className={`inline-flex cursor-grab select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        phase !== 'idle'
          ? 'border-border bg-card text-foreground cursor-default'
          : inZone
            ? 'border-primary/40 bg-primary/10 text-foreground hover:border-primary/70'
            : 'border-border bg-card text-foreground hover:border-muted-foreground/40'
      }`}
    >
      {item.label}
    </div>
  );
}

// ── Drop zone (bank or category column) ──────────────────────────────────────

function DropZone({
  id,
  label,
  items,
  placement,
  phase,
  activeId,
  isOver,
  chipRefs,
  children,
}: {
  id: string;
  label?: string;
  items: Item[];
  placement: Placement;
  phase: 'idle' | 'correct' | 'wrong';
  activeId: string | null;
  isOver: boolean;
  chipRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  children?: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-lg border-2 p-3 transition-colors ${
        isOver && phase === 'idle'
          ? 'border-primary bg-primary/8'
          : 'border-border'
      }`}
      style={{ minHeight: label ? '7rem' : '3.5rem' }}
    >
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const placed = placement[item.id];
          const isCorrect = phase !== 'idle' && placed === item.categoryId;
          const isWrong = phase === 'wrong' && placed !== item.categoryId;
          return (
            <div key={item.id} className="relative">
              <DraggableChip
                item={item}
                inZone={id !== 'bank'}
                phase={phase}
                isDragging={item.id === activeId}
                chipRef={(el) => { chipRefs.current[item.id] = el; }}
              />
              {phase !== 'idle' && (
                <span
                  className={`absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCorrect
                      ? 'bg-success text-white'
                      : isWrong
                        ? 'bg-destructive text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  aria-hidden="true"
                >
                  {isCorrect ? '✓' : isWrong ? '✗' : ''}
                </span>
              )}
            </div>
          );
        })}
        {children}
      </div>
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function DragCategorize({ spec, onComplete }: Props) {
  const [placement, setPlacement] = useState<Placement>(() =>
    buildInitialPlacement(spec.items),
  );
  const [phase, setPhase] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [attempts, setAttempts] = useState(0);
  const [shuffledItems] = useState(() => shuffle(spec.items));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const telemetry = useWidgetTelemetry();
  const shownRef = useRef(false);
  const completedRef = useRef(false);

  // Guarded by a ref so a remount in development does not double-count.
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    telemetry.track({
      eventType: 'widget_shown',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: null,
      payload: { items: spec.items.length, categories: spec.categories.length },
    });
  }, [telemetry, spec]);

  // Refs to every rendered chip DOM node, keyed by item id.
  const chipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: zoneKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      setOverId(null);

      const movedId = active.id as string;
      const destination = over ? String(over.id) : null;
      const placedInCategory = destination && destination !== 'bank';

      setPlacement((prev) => {
        const next = { ...prev, [movedId]: placedInCategory ? destination : null };

        // After placing into a category, focus the next unplaced bank item.
        // Use rAF twice: once to let React re-render the new placement, once more
        // to let dnd-kit finish returning focus to the dragged element — then
        // we steal it away to the next chip.
        if (placedInCategory) {
          const nextUnplaced = shuffledItems.find(
            (it) => it.id !== movedId && next[it.id] === null,
          );
          if (nextUnplaced) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                chipRefs.current[nextUnplaced.id]?.focus();
              });
            });
          }
        }

        return next;
      });
    },
    [shuffledItems],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const misplaced = spec.items.filter((it) => placement[it.id] !== it.categoryId);
    const correct = misplaced.length === 0;
    setAttempts((a) => a + 1);
    setPhase(correct ? 'correct' : 'wrong');

    telemetry.track({
      eventType: 'answer_checked',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct,
      payload: {
        attempt: attempts + 1,
        misplaced: misplaced.length,
        // Which column a wrong item was dropped into is the diagnosis, so the
        // confusion is recorded as a pair rather than as a count.
        confusions: misplaced.map((it) => `${it.categoryId}->${placement[it.id] ?? 'unplaced'}`),
        // The profile confirms a misconception only from a wrong answer carrying it.
        ...(correct ? {} : { misconception: spec.hint }),
      },
    });

    if (!correct) return;
    onComplete?.(true);

    if (completedRef.current) return;
    completedRef.current = true;

    telemetry.track({
      eventType: 'widget_completed',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: true,
      payload: { attempts: attempts + 1 },
    });
    telemetry.flush();
  }, [placement, spec, onComplete, attempts, telemetry]);

  const handleTryAgain = useCallback(() => {
    setPlacement(buildInitialPlacement(spec.items));
    setPhase('idle');
  }, [spec.items]);

  const allPlaced = Object.values(placement).every((v) => v !== null);
  const placedCount = Object.values(placement).filter((v) => v !== null).length;

  const bankItems = shuffledItems.filter((it) => placement[it.id] === null);
  const itemsInCategory = (catId: string) =>
    shuffledItems.filter((it) => placement[it.id] === catId);

  const activeItem = activeId ? spec.items.find((it) => it.id === activeId) : null;

  const gridCols =
    spec.categories.length === 2
      ? 'grid-cols-2'
      : spec.categories.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      {phase === 'idle' && (
        <p className="text-xs text-muted-foreground">
          Drag into a category, or press Tab to a chip, Space to pick it up, arrow keys to move
          between zones, and Space again to drop it.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const item = spec.items.find((it) => it.id === active.id);
              const currentCat = placement[active.id as string];
              const catLabel = currentCat
                ? spec.categories.find((c) => c.id === currentCat)?.label ?? 'a category'
                : 'the bank';
              return `Picked up ${item?.label}, currently in ${catLabel}. Use arrow keys to move between zones, space or enter to drop.`;
            },
            onDragOver: ({ active, over }) => {
              if (!over) return;
              const item = spec.items.find((it) => it.id === active.id);
              const dest =
                over.id === 'bank'
                  ? 'the bank'
                  : spec.categories.find((c) => c.id === over.id)?.label ?? 'a category';
              return `${item?.label} is over ${dest}.`;
            },
            onDragEnd: ({ active, over }) => {
              const item = spec.items.find((it) => it.id === active.id);
              if (!over) return `${item?.label} was dropped outside any zone and returned.`;
              const dest =
                over.id === 'bank'
                  ? 'the bank'
                  : spec.categories.find((c) => c.id === over.id)?.label ?? 'a category';
              return `${item?.label} was placed in ${dest}.`;
            },
            onDragCancel: ({ active }) => {
              const item = spec.items.find((it) => it.id === active.id);
              return `Drag cancelled. ${item?.label} returned to its original position.`;
            },
          },
        }}
      >
        {/* Bank */}
        <DropZone
          id="bank"
          items={bankItems}
          placement={placement}
          phase={phase}
          activeId={activeId}
          isOver={overId === 'bank'}
          chipRefs={chipRefs}
        >
          {bankItems.length === 0 && phase === 'idle' && (
            <p className="text-xs text-muted-foreground">
              All items placed — check your work below.
            </p>
          )}
        </DropZone>

        {/* Category columns */}
        <div className={`grid gap-3 ${gridCols}`}>
          {spec.categories.map((cat: Category) => (
            <DropZone
              key={cat.id}
              id={cat.id}
              label={cat.label}
              items={itemsInCategory(cat.id)}
              placement={placement}
              phase={phase}
              activeId={activeId}
              isOver={overId === cat.id}
              chipRefs={chipRefs}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="inline-flex cursor-grabbing select-none items-center rounded-full border border-primary bg-card px-3 py-1.5 text-sm font-medium shadow-lg">
              {activeItem.label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {phase === 'idle' && (
        <Button size="lg" className="w-full" disabled={!allPlaced} onClick={handleSubmit}>
          {allPlaced
            ? 'Check answers'
            : `Place all items to check (${placedCount}/${spec.items.length})`}
        </Button>
      )}

      {phase === 'wrong' && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-semibold text-destructive">
              {attempts === 1 ? 'Not quite.' : 'Keep trying!'}
            </p>
            <p className="text-sm text-foreground">{spec.hint}</p>
            <Button size="lg" variant="outline" className="w-full" onClick={handleTryAgain}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === 'correct' && (
        <Card className="border-success/30 bg-success/10">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-semibold text-success">
              {attempts === 1 ? 'Perfect!' : 'Got it!'}
            </p>
            <p className="text-sm text-foreground">{spec.successMessage}</p>
            <Button size="lg" className="w-full" onClick={() => onComplete?.(true)}>
              Continue →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
