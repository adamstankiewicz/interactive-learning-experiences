'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import type { DragSortSpec } from '@/lib/pathway/schema';
import { seededShuffle } from '@/lib/widgets/shuffle';

type Item = DragSortSpec['items'][number];
type Props = { spec: DragSortSpec; onComplete?: (correct: boolean) => void };

// ── Single sortable row ───────────────────────────────────────────────────────

function SortableItem({
  item,
  index,
  phase,
  correctId,
  isDragging,
}: {
  item: Item;
  index: number;
  phase: 'idle' | 'correct' | 'wrong';
  correctId: string;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
    disabled: phase !== 'idle',
  });

  const isCorrectPosition = phase !== 'idle' && correctId === item.id;
  const isWrongPosition = phase === 'wrong' && correctId !== item.id;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 select-none transition-colors ${
        phase === 'idle'
          ? 'cursor-grab border-border bg-card hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          : isCorrectPosition
            ? 'border-success bg-success/10 cursor-default'
            : isWrongPosition
              ? 'border-destructive/60 bg-destructive/5 cursor-default'
              : 'border-border bg-card cursor-default'
      }`}
    >
      {phase === 'idle' && (
        <svg
          className="size-4 shrink-0 text-muted-foreground/50"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="11" cy="4" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>
      )}
      <span
        className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${
          isCorrectPosition
            ? 'text-success'
            : isWrongPosition
              ? 'text-destructive'
              : 'text-muted-foreground'
        }`}
      >
        {index + 1}
      </span>
      <span className="text-sm font-medium">{item.label}</span>
      {phase !== 'idle' && (
        <span className="ml-auto text-base" aria-hidden="true">
          {isCorrectPosition ? '✓' : isWrongPosition ? '✗' : ''}
        </span>
      )}
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function DragSort({ spec, onComplete }: Props) {
  const [items, setItems] = useState<Item[]>(() =>
    seededShuffle(spec.items, (it) => it.id, spec.correctOrder),
  );
  const [phase, setPhase] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [attempts, setAttempts] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

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
      payload: { items: spec.items.length },
    });
  }, [telemetry, spec]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over || active.id === over.id) return;
      setItems((prev) => {
        const from = prev.findIndex((it) => it.id === active.id);
        const to = prev.findIndex((it) => it.id === over.id);
        return arrayMove(prev, from, to);
      });
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const submitted = items.map((it) => it.id);
    const correct = submitted.join(',') === spec.correctOrder.join(',');
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
        // Position-level detail so a near-miss reads differently from a scramble.
        misplaced: submitted.filter((id, i) => id !== spec.correctOrder[i]).length,
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
  }, [items, spec, onComplete, attempts, telemetry]);

  const handleTryAgain = useCallback(() => setPhase('idle'), []);

  const activeItem = activeId ? items.find((it) => it.id === activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      {phase === 'idle' && (
        <p className="text-xs text-muted-foreground">
          Drag to reorder, or press Tab to a step, Space to pick it up, arrow keys to move it, and
          Space again to drop it.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const item = items.find((it) => it.id === active.id);
              const idx = items.findIndex((it) => it.id === active.id);
              return `Picked up ${item?.label}, currently at position ${idx + 1} of ${items.length}.`;
            },
            onDragOver: ({ active, over }) => {
              if (!over) return;
              const toIdx = items.findIndex((it) => it.id === over.id);
              return `${items.find((it) => it.id === active.id)?.label} will move to position ${toIdx + 1}.`;
            },
            onDragEnd: ({ active, over }) => {
              if (!over) return `${items.find((it) => it.id === active.id)?.label} was dropped.`;
              const toIdx = items.findIndex((it) => it.id === over.id);
              return `${items.find((it) => it.id === active.id)?.label} was placed at position ${toIdx + 1}.`;
            },
            onDragCancel: ({ active }) =>
              `Drag cancelled. ${items.find((it) => it.id === active.id)?.label} returned to its original position.`,
          },
        }}
      >
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                phase={phase}
                correctId={spec.correctOrder[index] ?? ''}
                isDragging={item.id === activeId}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem && (
            <div className="flex items-center gap-3 rounded-lg border-2 border-primary bg-card px-4 py-3 shadow-lg">
              <svg
                className="size-4 shrink-0 text-muted-foreground/50"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="5" cy="4" r="1.2" />
                <circle cx="11" cy="4" r="1.2" />
                <circle cx="5" cy="8" r="1.2" />
                <circle cx="11" cy="8" r="1.2" />
                <circle cx="5" cy="12" r="1.2" />
                <circle cx="11" cy="12" r="1.2" />
              </svg>
              <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                {items.findIndex((it) => it.id === activeItem.id) + 1}
              </span>
              <span className="text-sm font-medium">{activeItem.label}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {phase === 'idle' && (
        <Button size="lg" className="w-full" onClick={handleSubmit}>
          Check order
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
              {attempts === 1 ? 'Perfect order!' : 'Got it!'}
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
