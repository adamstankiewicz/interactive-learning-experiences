'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { TimelineBuilderSpec } from '@/lib/pathway/schema';

type Event = TimelineBuilderSpec['events'][number];
type Zone = TimelineBuilderSpec['zones'][number];
type Placement = Record<string, string | null>;
type Feedback = Record<string, 'correct' | 'wrong' | null>;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const seed = copy.slice(0, i + 1).reduce((acc, it) => acc + JSON.stringify(it).charCodeAt(0), 0);
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ── Draggable event chip ──────────────────────────────────────────────────────

function DraggableEvent({
  event,
  isDragging,
  inZone,
  feedback,
  isSelected,
  isPlacementMode,
  onSelect,
  onAfterSelect,
  chipRef,
}: {
  event: Event;
  isDragging: boolean;
  inZone: boolean;
  feedback: 'correct' | 'wrong' | null;
  isSelected: boolean;
  isPlacementMode: boolean;
  onSelect: (id: string, source: 'keyboard') => void;
  onAfterSelect?: () => void;
  chipRef?: (el: HTMLDivElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: event.id });

  return (
    <div
      ref={(el) => { setNodeRef(el); chipRef?.(el); }}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${event.label}${inZone ? ', placed' : ', in bank'}. ${isSelected ? 'Selected — tab to a zone and press Enter to place it.' : 'Press Enter to select.'}`}
      tabIndex={inZone && isPlacementMode ? -1 : 0}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event.id, 'keyboard');
          if (!isSelected) onAfterSelect?.();
        }
      }}
      className={`inline-flex cursor-grab select-none items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isSelected
          ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
          : feedback === 'correct'
            ? 'border-success/50 bg-success/10 text-foreground'
            : feedback === 'wrong'
              ? 'border-destructive/50 bg-destructive/5 text-foreground'
              : inZone
                ? 'border-primary/40 bg-primary/10 text-foreground hover:border-primary/60'
                : 'border-border bg-card text-foreground hover:border-muted-foreground/40'
      }`}
    >
      {event.label}
      {feedback && !isSelected && (
        <span
          className={`text-[10px] font-bold ${feedback === 'correct' ? 'text-success' : 'text-destructive'}`}
          aria-hidden="true"
        >
          {feedback === 'correct' ? '✓' : '✗'}
        </span>
      )}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function TimelineZone({
  zone,
  isOver,
  isLast,
  isKeyboardTarget,
  onKeyboardDrop,
  dropTargetRef,
  children,
}: {
  zone: Zone;
  isOver: boolean;
  isLast: boolean;
  isKeyboardTarget: boolean;
  onKeyboardDrop: (zoneId: string) => void;
  dropTargetRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: zone.id });

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* Timeline dot */}
      <div className="relative flex w-full items-center justify-center">
        <div className="h-0.5 flex-1 bg-border" />
        <div className={`relative z-10 h-3 w-3 shrink-0 rounded-full border-2 transition-colors ${
          isOver ? 'border-primary bg-primary' : 'border-border bg-background'
        }`} />
        {!isLast ? <div className="h-0.5 flex-1 bg-border" /> : <div className="flex-1" />}
      </div>

      {/* Zone label */}
      <div className="mt-2 text-center">
        <p className="text-xs font-semibold text-foreground">{zone.label}</p>
        {zone.sublabel && <p className="text-[10px] text-muted-foreground">{zone.sublabel}</p>}
      </div>

      {/* Drop target */}
      <div
        ref={(el) => {
          setNodeRef(el);
          if (dropTargetRef) (dropTargetRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        role={isKeyboardTarget ? 'button' : undefined}
        tabIndex={isKeyboardTarget ? 0 : undefined}
        data-zone-target={isKeyboardTarget ? '' : undefined}
        aria-label={isKeyboardTarget ? `Place in ${zone.label}` : undefined}
        onClick={() => isKeyboardTarget && onKeyboardDrop(zone.id)}
        onKeyDown={(e) => {
          if (!isKeyboardTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onKeyboardDrop(zone.id);
          }
        }}
        className={`mt-3 flex min-h-16 w-full flex-wrap gap-1.5 rounded-lg border-2 p-2 transition-colors ${
          isOver
            ? 'border-primary bg-primary/8'
            : isKeyboardTarget
              ? 'border-primary/50 bg-primary/5 cursor-pointer outline-none focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1'
              : 'border-dashed border-border'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function TimelineBuilder({ spec, onComplete }: { spec: TimelineBuilderSpec; onComplete?: (correct: boolean) => void }) {
  const [shuffledEvents] = useState(() => shuffle(spec.events));
  const [placement, setPlacement] = useState<Placement>(() =>
    Object.fromEntries(spec.events.map((e) => [e.id, null])),
  );
  const [feedback, setFeedback] = useState<Feedback>(() =>
    Object.fromEntries(spec.events.map((e) => [e.id, null])),
  );
  const [correct, setCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectionByKeyboard = useRef(false);
  const announcerRef = useRef<HTMLDivElement>(null);
  const firstZoneRef = useRef<HTMLDivElement>(null);
  const chipRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const zonesRowRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((msg: string) => {
    if (announcerRef.current) announcerRef.current.textContent = msg;
  }, []);

const sensors = useSensors(useSensor(PointerSensor));

  const clearEventFeedback = useCallback((id: string) => {
    setFeedback((prev) => ({ ...prev, [id]: null }));
    setCorrect(false);
  }, []);

  // ── Mouse drag ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const id = active.id as string;
    setActiveId(id);
    setSelectedEventId(null);
    selectionByKeyboard.current = false;
    clearEventFeedback(id);
  }, [clearEventFeedback]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    const movedId = active.id as string;
    const destination = over ? String(over.id) : null;
    const validZone = destination && spec.zones.some((z) => z.id === destination);
    setPlacement((prev) => ({ ...prev, [movedId]: validZone ? destination : null }));
  }, [spec.zones]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  // ── Keyboard select-then-place ────────────────────────────────────────────

  const handleSelectEvent = useCallback((id: string, source: 'keyboard') => {
    selectionByKeyboard.current = true;
    setSelectedEventId((prev) => {
      if (prev === id) {
        announce('Deselected.');
        selectionByKeyboard.current = false;
        return null;
      }
      const event = spec.events.find((e) => e.id === id);
      announce(`${event?.label} selected. Tab to a zone and press Enter to place it, or press Enter again to deselect.`);
      return id;
    });
    clearEventFeedback(id);
  }, [spec.events, announce, clearEventFeedback]);

  const handleKeyboardDrop = useCallback((zoneId: string) => {
    if (!selectedEventId || !selectionByKeyboard.current) return;
    const event = spec.events.find((e) => e.id === selectedEventId);
    const zone = spec.zones.find((z) => z.id === zoneId);
    setPlacement((prev) => {
      const next = { ...prev, [selectedEventId]: zoneId };
      // Focus the next unplaced chip after React re-renders
      setTimeout(() => {
        const nextUnplaced = shuffledEvents.find((e) => e.id !== selectedEventId && next[e.id] === null);
        if (nextUnplaced) chipRefsMap.current.get(nextUnplaced.id)?.focus();
      }, 0);
      return next;
    });
    setSelectedEventId(null);
    selectionByKeyboard.current = false;
    announce(`${event?.label} placed in ${zone?.label}.`);
  }, [selectedEventId, shuffledEvents, spec.events, spec.zones, announce]);

  const cancelSelection = useCallback(() => {
    if (selectedEventId) {
      setSelectedEventId(null);
      selectionByKeyboard.current = false;
      announce('Selection cancelled.');
    }
  }, [selectedEventId, announce]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const newFeedback: Feedback = Object.fromEntries(
      spec.events.map((e) => [e.id, placement[e.id] === e.zoneId ? 'correct' : 'wrong']),
    );
    const allCorrect = spec.events.every((e) => placement[e.id] === e.zoneId);
    setFeedback(newFeedback);
    setAttempts((a) => a + 1);
    setCorrect(allCorrect);
    if (allCorrect) onComplete?.(true);
  }, [placement, spec.events, onComplete]);

  const bankEvents = shuffledEvents.filter((e) => placement[e.id] === null);
  const allPlaced = bankEvents.length === 0;
  const activeEvent = activeId ? spec.events.find((e) => e.id === activeId) : null;
  const hasWrongFeedback = spec.events.some((e) => feedback[e.id] === 'wrong');
  const isKeyboardMode = selectedEventId !== null;

  const handleRootKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelSelection();
      return;
    }
    if (!isKeyboardMode || (e.key !== 'Tab')) return;
    const targets = Array.from(
      zonesRowRef.current?.querySelectorAll<HTMLElement>('[data-zone-target]') ?? [],
    );
    if (targets.length === 0) return;
    e.preventDefault();
    const current = targets.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? (current - 1 + targets.length) % targets.length
      : (current + 1) % targets.length;
    targets[next]?.focus();
  }, [isKeyboardMode, cancelSelection]);

  return (
    <div
      className="flex flex-col gap-5"
      onKeyDown={handleRootKeyDown}
    >
      {/* Screen reader announcer */}
      <div ref={announcerRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      {isKeyboardMode && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary font-medium" aria-hidden="true">
          "{spec.events.find((e) => e.id === selectedEventId)?.label}" selected — click a zone below to place it, or press Escape to cancel.
        </p>
      )}

      <DndContext
        id="timeline-builder"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const event = spec.events.find((e) => e.id === active.id);
              const zone = placement[active.id as string];
              const where = zone ? spec.zones.find((z) => z.id === zone)?.label ?? 'a zone' : 'the event bank';
              return `Picked up "${event?.label}", currently in ${where}.`;
            },
            onDragOver: ({ active, over }) => {
              if (!over) return;
              const event = spec.events.find((e) => e.id === active.id);
              const zone = spec.zones.find((z) => z.id === over.id);
              return `"${event?.label}" is over ${zone?.label ?? 'the bank'}.`;
            },
            onDragEnd: ({ active, over }) => {
              const event = spec.events.find((e) => e.id === active.id);
              if (!over) return `"${event?.label}" returned to the bank.`;
              const zone = spec.zones.find((z) => z.id === over.id);
              return `"${event?.label}" placed in ${zone?.label ?? 'the bank'}.`;
            },
            onDragCancel: ({ active }) => {
              const event = spec.events.find((e) => e.id === active.id);
              return `Cancelled. "${event?.label}" returned to its original position.`;
            },
          },
        }}
      >
        {/* Event bank */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Events to place
          </p>
          <div className="flex min-h-10 flex-wrap gap-2">
            {bankEvents.map((event) => (
              <DraggableEvent
                key={event.id}
                event={event}
                isDragging={event.id === activeId}
                inZone={false}
                feedback={null}
                isSelected={selectedEventId === event.id}
                isPlacementMode={isKeyboardMode}
                onSelect={handleSelectEvent}
                onAfterSelect={() => setTimeout(() => firstZoneRef.current?.focus(), 0)}
                chipRef={(el) => {
                  if (el) chipRefsMap.current.set(event.id, el);
                  else chipRefsMap.current.delete(event.id);
                }}
              />
            ))}
            {bankEvents.length === 0 && !correct && (
              <p className="text-xs text-muted-foreground">All events placed — check your answers.</p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div ref={zonesRowRef} className="flex gap-0 overflow-x-auto pb-2">
          {spec.zones.map((zone, i) => {
            const zoneEvents = shuffledEvents.filter((e) => placement[e.id] === zone.id);
            return (
              <TimelineZone
                key={zone.id}
                zone={zone}
                isOver={overId === zone.id}
                isLast={i === spec.zones.length - 1}
                isKeyboardTarget={isKeyboardMode}
                onKeyboardDrop={handleKeyboardDrop}
                dropTargetRef={i === 0 ? firstZoneRef : undefined}
              >
                {zoneEvents.map((event) => (
                  <DraggableEvent
                    key={event.id}
                    event={event}
                    isDragging={event.id === activeId}
                    inZone={true}
                    feedback={feedback[event.id] ?? null}
                    isSelected={selectedEventId === event.id}
                    isPlacementMode={isKeyboardMode}
                    onSelect={handleSelectEvent}
                    onAfterSelect={() => setTimeout(() => firstZoneRef.current?.focus(), 0)}
                  />
                ))}
              </TimelineZone>
            );
          })}
        </div>

        <DragOverlay>
          {activeEvent && (
            <div className="inline-flex cursor-grabbing select-none items-center rounded-full border border-primary bg-card px-3 py-1.5 text-xs font-medium shadow-lg">
              {activeEvent.label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {correct ? (
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
      ) : (
        <>
          {hasWrongFeedback && (
            <p className="text-sm text-muted-foreground">{spec.hint}</p>
          )}
          <Button size="lg" className="w-full" disabled={!allPlaced} onClick={handleSubmit}>
            {allPlaced
              ? 'Check answers'
              : `Place all events to check (${spec.events.length - bankEvents.length}/${spec.events.length})`}
          </Button>
        </>
      )}
    </div>
  );
}
