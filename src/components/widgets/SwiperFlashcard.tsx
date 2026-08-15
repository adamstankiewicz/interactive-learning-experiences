'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import type { SwiperFlashcardSpec } from '@/lib/pathway/schema';
import { cn } from '@/lib/utils';

type CardData = SwiperFlashcardSpec['cards'][number];
type SwipeDirection = 'up' | 'down';
type CardResult = { cardIndex: number; direction: SwipeDirection; correct: boolean };

const CORRECT_REACTIONS = [
  'Correct!',
  'Nice work!',
  'You got it!',
  'Exactly right!',
  'Well done!',
  'That\'s the one!',
];

const INCORRECT_REACTIONS = [
  'Not quite.',
  'Not this time — here\'s why.',
  'Good try!',
  'Not quite.',
  'Close, but not quite.',
  'Let\'s look at that again.',
];

type Props = {
  spec: SwiperFlashcardSpec;
  onComplete?: (results: CardResult[]) => void;
};

// How far (px) the user must drag before we commit the swipe on release.
const SWIPE_THRESHOLD = 80;
// Max tilt angle (deg) applied during a horizontal drift while dragging vertically.
const MAX_ROTATE = 10;

export function SwiperFlashcard({ spec, onComplete }: Props) {
  const telemetry = useWidgetTelemetry();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  // Mirrors `results` so `handleNext` can read the latest value synchronously.
  // Not a stale-closure workaround via a setState updater's `prev` — calling
  // `onComplete` (which sets state in the *parent*) from inside a setState
  // updater runs it during this component's own render, which React disallows.
  const resultsRef = useRef<CardResult[]>([]);
  const [swipeState, setSwipeState] = useState<{
    direction: SwipeDirection;
    phase: 'animating' | 'revealing';
  } | null>(null);

  // Live drag offset while the pointer is held down. Stored in a ref so
  // pointer-move updates don't re-render the whole tree — we write straight
  // to the card and label DOM nodes instead.
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const leftLabelRef = useRef<HTMLDivElement>(null);
  const rightLabelRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const firstSwipeButtonRef = useRef<HTMLButtonElement>(null);

  // Imperatively highlight whichever label the card is dragged toward.
  // Below the threshold: scale up slightly and fade the opposite label.
  // At/past the threshold: fill with a solid background so it reads as "selected".
  const applyLabelHighlight = useCallback((dy: number) => {
    const topEl = leftLabelRef.current;
    const botEl = rightLabelRef.current;
    if (!topEl || !botEl) return;

    const past = Math.abs(dy) >= SWIPE_THRESHOLD;
    const intensity = Math.min(1, Math.abs(dy) / SWIPE_THRESHOLD);

    const fillActive = (el: HTMLDivElement) => {
      el.style.background = 'var(--color-foreground)';
      el.style.color = 'var(--color-background)';
      el.style.borderColor = 'var(--color-foreground)';
      el.style.transform = 'scale(1.04)';
      el.style.opacity = '1';
    };
    const scaleActive = (el: HTMLDivElement) => {
      el.style.background = '';
      el.style.color = '';
      el.style.borderColor = '';
      el.style.transform = `scale(${1 + 0.04 * intensity})`;
      el.style.opacity = '1';
    };
    const dim = (el: HTMLDivElement) => {
      el.style.background = '';
      el.style.color = '';
      el.style.borderColor = '';
      el.style.transform = 'scale(1)';
      el.style.opacity = String(1 - 0.5 * intensity);
    };
    const neutral = (el: HTMLDivElement) => {
      el.style.background = '';
      el.style.color = '';
      el.style.borderColor = '';
      el.style.transform = 'scale(1)';
      el.style.opacity = '1';
    };

    if (dy < -8) {
      if (past) { fillActive(topEl); } else { scaleActive(topEl); }
      dim(botEl);
    } else if (dy > 8) {
      if (past) { fillActive(botEl); } else { scaleActive(botEl); }
      dim(topEl);
    } else {
      neutral(topEl);
      neutral(botEl);
    }
  }, []);

  const resetLabelHighlight = useCallback(() => {
    for (const el of [leftLabelRef.current, rightLabelRef.current]) {
      if (!el) continue;
      el.style.background = '';
      el.style.color = '';
      el.style.borderColor = '';
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    }
  }, []);

  const applyDragStyle = useCallback((dx: number, dy: number) => {
    if (!cardRef.current) return;
    const rotate = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx / 12));
    cardRef.current.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
    cardRef.current.style.transition = 'none';
    cardRef.current.style.opacity = '0.72';
    cardRef.current.style.zIndex = '20';
    applyLabelHighlight(dy);
  }, [applyLabelHighlight]);

  const resetDragStyle = useCallback((instant = false) => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'translate(0, 0) rotate(0deg)';
    cardRef.current.style.transition = instant
      ? 'none'
      : 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    cardRef.current.style.opacity = '1';
    cardRef.current.style.zIndex = '';
    resetLabelHighlight();
  }, [resetLabelHighlight]);

  const flyOutStyle = useCallback((direction: SwipeDirection) => {
    if (!cardRef.current) return;
    const y = direction === 'up' ? '-150%' : '150%';
    cardRef.current.style.transform = `translate(0, ${y}) rotate(0deg)`;
    cardRef.current.style.opacity = '0';
    cardRef.current.style.zIndex = '';
    cardRef.current.style.transition = 'transform 320ms ease-in, opacity 320ms ease-in';
  }, []);

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (!spec.cards[currentIndex] || swipeState) return;
      const correct = direction === spec.cards[currentIndex]!.correctDirection;

      telemetry.track({
        eventType: 'card_swiped',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct,
        payload: { cardIndex: currentIndex, direction },
      });

      flyOutStyle(direction);
      setSwipeState({ direction, phase: 'animating' });

      setTimeout(() => {
        setSwipeState((prev) => (prev ? { ...prev, phase: 'revealing' } : null));
        if (cardRef.current) {
          cardRef.current.style.transform = '';
          cardRef.current.style.opacity = '';
          cardRef.current.style.transition = '';
        }
        // Clear imperative drag styles so className-driven reveal colors take over
        resetLabelHighlight();
        // Record the result now so handleNext can read it synchronously.
        resultsRef.current = [...resultsRef.current, { cardIndex: currentIndex, direction, correct }];
        setResults(resultsRef.current);
      }, 320);
    },
    [
      currentIndex,
      swipeState,
      spec.cards,
      spec.kind,
      spec.learningComponentId,
      flyOutStyle,
      resetLabelHighlight,
      telemetry,
    ],
  );

  const handleNext = useCallback(() => {
    if (swipeState?.phase !== 'revealing') return;

    // A plain read and a plain call, not a setState updater: this runs from a
    // click handler, which is the safe place to trigger the parent's state.
    if (currentIndex + 1 === spec.cards.length) {
      const finalResults = resultsRef.current;
      telemetry.track({
        eventType: 'widget_completed',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct: finalResults.every((entry) => entry.correct),
        payload: {
          correct: finalResults.filter((entry) => entry.correct).length,
          total: finalResults.length,
        },
      });
      telemetry.flush();
      onComplete?.(finalResults);
    }

    setCurrentIndex((i) => i + 1);
    setSwipeState(null);
    // Defer until the next card's buttons are rendered
    requestAnimationFrame(() => firstSwipeButtonRef.current?.focus());
  }, [
    swipeState,
    currentIndex,
    spec.cards.length,
    spec.kind,
    spec.learningComponentId,
    onComplete,
    telemetry,
  ]);

  // Pointer events — use capture so we keep the pointer even if the user
  // moves outside the card element.
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (swipeState) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY };
    },
    [swipeState],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || swipeState) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      applyDragStyle(dx, dy);
    },
    [swipeState, applyDragStyle],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || swipeState) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      dragRef.current = null;

      if (Math.abs(dy) >= SWIPE_THRESHOLD) {
        handleSwipe(dy < 0 ? 'up' : 'down');
      } else if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        handleSwipe(dx < 0 ? 'up' : 'down');
      } else {
        resetDragStyle();
      }
    },
    [swipeState, handleSwipe, resetDragStyle],
  );

  // Cancel drag if pointer is released outside the element
  useEffect(() => {
    function onWindowPointerUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      resetDragStyle();
      resetLabelHighlight();
    }
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => window.removeEventListener('pointerup', onWindowPointerUp);
  }, [resetDragStyle, resetLabelHighlight]);

  // Reset card element styles whenever the card advances
  useEffect(() => {
    resetDragStyle(true);
  }, [currentIndex, resetDragStyle]);

  // Move focus to Next button as soon as the reveal card appears
  useEffect(() => {
    if (swipeState?.phase === 'revealing') {
      nextButtonRef.current?.focus();
    }
  }, [swipeState?.phase]);

  // ── Completed state ──────────────────────────────────────────────────────────
  if (currentIndex >= spec.cards.length) {
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const allCorrect = correct === total;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-4xl font-bold tabular-nums">{correct}/{total}</p>
          <p className="text-muted-foreground">
            {allCorrect ? 'Perfect — you got every card right!' : 'Keep it up — you\'re getting there.'}
          </p>
          <Button size="lg" className="w-full mt-2" onClick={() => onComplete?.(results)}>
            Continue →
          </Button>
        </CardContent>
      </Card>
    );
  }

  const card = spec.cards[currentIndex] as CardData;
  const isRevealing = swipeState?.phase === 'revealing';
  const swipedCorrect = swipeState ? card.correctDirection === swipeState.direction : false;
  const isSwipingUp = swipeState?.direction === 'up';
  const isSwipingDown = swipeState?.direction === 'down';

  const progress = currentIndex / spec.cards.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
          role="progressbar"
          aria-valuenow={currentIndex}
          aria-valuemin={0}
          aria-valuemax={spec.cards.length}
          aria-label={`Card ${currentIndex} of ${spec.cards.length}`}
        />
      </div>

      {/* Top label — swipe up */}
      <div
        ref={leftLabelRef}
        style={{ transition: 'opacity 80ms, transform 80ms' }}
        className={cn(
          'flex h-12 items-center justify-center rounded-lg border-2 text-center text-sm font-semibold',
          isRevealing
            ? swipeState?.direction === 'up'
              ? card.correctDirection === 'up'
                ? 'border-success bg-success text-white' // selected + correct = solid green
                : 'border-destructive bg-destructive text-white' // selected + wrong = solid red
              : card.correctDirection === 'up'
                ? 'border-success text-success' // not selected + correct = outlined green
                : 'border-muted-foreground/30 text-muted-foreground/30' // not selected + wrong = dim
            : isSwipingUp
              ? 'border-destructive text-destructive'
              : isSwipingDown
                ? 'border-muted-foreground/20 text-muted-foreground/20'
                : 'border-muted-foreground/40 text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {card.upLabel}
      </div>

      {/* The flashcard — ref lets us write transform directly during drag */}
      <div
        ref={cardRef}
        className={isRevealing ? undefined : 'cursor-grab select-none active:cursor-grabbing'}
        onPointerDown={isRevealing ? undefined : onPointerDown}
        onPointerMove={isRevealing ? undefined : onPointerMove}
        onPointerUp={isRevealing ? undefined : onPointerUp}
      >
        {isRevealing ? (
          <Card role="status" className="min-h-36">
            <CardContent className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
              <p className={cn('text-sm font-semibold', swipedCorrect ? 'text-success' : 'text-destructive')}>
                {swipedCorrect
                  ? CORRECT_REACTIONS[currentIndex % CORRECT_REACTIONS.length]
                  : INCORRECT_REACTIONS[currentIndex % INCORRECT_REACTIONS.length]}
              </p>
              <p className="text-sm text-foreground">{card.explanation}</p>
              <Button ref={nextButtonRef} size="lg" className="mt-1 w-full" onClick={handleNext}>
                Next →
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="min-h-36 pointer-events-none">
            <CardContent className="flex min-h-36 items-center justify-center text-center">
              <p className="text-base font-medium">{card.question}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom label — swipe down */}
      <div
        ref={rightLabelRef}
        style={{ transition: 'opacity 80ms, transform 80ms' }}
        className={cn(
          'flex h-12 items-center justify-center rounded-lg border-2 text-center text-sm font-semibold',
          isRevealing
            ? swipeState?.direction === 'down'
              ? card.correctDirection === 'down'
                ? 'border-success bg-success text-white' // selected + correct = solid green
                : 'border-destructive bg-destructive text-white' // selected + wrong = solid red
              : card.correctDirection === 'down'
                ? 'border-success text-success' // not selected + correct = outlined green
                : 'border-muted-foreground/30 text-muted-foreground/30' // not selected + wrong = dim
            : isSwipingDown
              ? 'border-success text-success'
              : isSwipingUp
                ? 'border-muted-foreground/20 text-muted-foreground/20'
                : 'border-muted-foreground/40 text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {card.downLabel}
      </div>

      {/* Swipe hint */}
      {!swipeState && !isRevealing && (
        <p className="text-center text-xs text-muted-foreground">
          Drag the card up or down — or use the buttons below
        </p>
      )}

      {/* Button row */}
      {!swipeState && !isRevealing && (
        <div className="flex justify-center gap-4">
          <Button
            ref={firstSwipeButtonRef}
            variant="outline"
            size="lg"
            onClick={() => handleSwipe('up')}
            aria-label={`Swipe up — ${card.upLabel}`}
          >
            {card.upLabel}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleSwipe('down')}
            aria-label={`Swipe down — ${card.downLabel}`}
          >
            {card.downLabel}
          </Button>
        </div>
      )}

      {/* Card counter */}
      <p className="text-center text-xs tabular-nums text-muted-foreground">
        {currentIndex + 1} / {spec.cards.length}
      </p>
    </div>
  );
}
