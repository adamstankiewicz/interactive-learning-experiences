'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SwiperFlashcardSpec } from '@/lib/pathway/schema';

type CardData = SwiperFlashcardSpec['cards'][number];
type SwipeDirection = 'left' | 'right';
type CardResult = { cardIndex: number; direction: SwipeDirection; correct: boolean };

type Props = {
  spec: SwiperFlashcardSpec;
  onComplete?: (results: CardResult[]) => void;
};

// How far (px) the user must drag before we commit the swipe on release.
const SWIPE_THRESHOLD = 80;
// Max rotation angle (deg) at full drag extent.
const MAX_ROTATE = 18;

export function SwiperFlashcard({ spec, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  const [swipeState, setSwipeState] = useState<{
    direction: SwipeDirection;
    phase: 'animating' | 'revealing';
  } | null>(null);

  // Live drag offset while the pointer is held down. Stored in a ref so
  // pointer-move updates don't re-render the whole tree — we write straight
  // to the card's style instead.
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const applyDragStyle = useCallback((dx: number) => {
    if (!cardRef.current) return;
    // Clamp rotation so it stays tasteful even on wide monitors.
    const rotate = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx / 10));
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
    cardRef.current.style.transition = 'none';
  }, []);

  const resetDragStyle = useCallback((instant = false) => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'translateX(0) rotate(0deg)';
    cardRef.current.style.transition = instant
      ? 'none'
      : 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)';
  }, []);

  const flyOutStyle = useCallback((direction: SwipeDirection) => {
    if (!cardRef.current) return;
    const x = direction === 'left' ? '-150%' : '150%';
    const rotate = direction === 'left' ? -25 : 25;
    cardRef.current.style.transform = `translateX(${x}) rotate(${rotate}deg)`;
    cardRef.current.style.opacity = '0';
    cardRef.current.style.transition = 'transform 320ms ease-in, opacity 320ms ease-in';
  }, []);

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (!spec.cards[currentIndex] || swipeState) return;
      const correct = direction === spec.cards[currentIndex]!.correctDirection;

      flyOutStyle(direction);
      setSwipeState({ direction, phase: 'animating' });

      setTimeout(() => {
        setSwipeState((prev) => (prev ? { ...prev, phase: 'revealing' } : null));
        // Reset the card element for the reveal phase
        if (cardRef.current) {
          cardRef.current.style.transform = '';
          cardRef.current.style.opacity = '';
          cardRef.current.style.transition = '';
        }
      }, 320);

      setTimeout(() => {
        const result: CardResult = { cardIndex: currentIndex, direction, correct };
        setResults((prev) => {
          const next = [...prev, result];
          if (next.length === spec.cards.length) onComplete?.(next);
          return next;
        });
        setCurrentIndex((i) => i + 1);
        setSwipeState(null);
      }, 1600);
    },
    [currentIndex, swipeState, spec.cards, flyOutStyle, onComplete],
  );

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
      applyDragStyle(dx);
    },
    [swipeState, applyDragStyle],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || swipeState) return;
      const dx = e.clientX - dragRef.current.startX;
      dragRef.current = null;

      if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        handleSwipe(dx < 0 ? 'left' : 'right');
      } else {
        // Not far enough — spring back
        resetDragStyle();
      }
    },
    [swipeState, handleSwipe, resetDragStyle],
  );

  // Cancel drag if pointer leaves the window (e.g. user releases outside)
  useEffect(() => {
    function onWindowPointerUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      resetDragStyle();
    }
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => window.removeEventListener('pointerup', onWindowPointerUp);
  }, [resetDragStyle]);

  // Reset card element styles whenever the card advances
  useEffect(() => {
    resetDragStyle(true);
  }, [currentIndex, resetDragStyle]);

  // ── Completed state ──────────────────────────────────────────────────────────
  if (currentIndex >= spec.cards.length) {
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-4xl font-bold tabular-nums">{correct}/{total}</p>
          <p className="text-muted-foreground">
            {correct === total ? 'Perfect — you got every card right!' : `${total - correct} to review.`}
          </p>
          <Button
            variant="outline"
            onClick={() => { setCurrentIndex(0); setResults([]); setSwipeState(null); }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const card = spec.cards[currentIndex] as CardData;
  const isRevealing = swipeState?.phase === 'revealing';
  const swipedCorrect = swipeState ? card.correctDirection === swipeState.direction : false;

  // Live drag intensity (0–1) for label highlighting — read from the card's
  // current transform so it stays in sync with the rAF-free imperative updates.
  // We derive this only for the side-label colors; it's recalculated on every
  // render that the labels participate in, which is fine.
  const isSwipingLeft = swipeState?.direction === 'left';
  const isSwipingRight = swipeState?.direction === 'right';

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

      {/* Card stack area */}
      <div className="relative flex items-stretch justify-center gap-3">
        {/* Left label */}
        <div
          className={cn(
            'flex w-16 shrink-0 items-center justify-center rounded-lg border-2 text-center text-sm font-semibold leading-tight transition-colors duration-150',
            isSwipingLeft
              ? 'border-destructive text-destructive'
              : isSwipingRight
                ? 'border-muted-foreground/20 text-muted-foreground/20'
                : 'border-muted-foreground/40 text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {card.leftLabel}
        </div>

        {/* The flashcard — ref lets us write transform directly during drag */}
        <div
          ref={cardRef}
          className="flex-1 cursor-grab select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {isRevealing ? (
            <Alert
              role="status"
              variant={swipedCorrect ? 'success' : 'warning'}
              className="flex min-h-36 items-center justify-center text-center"
            >
              <AlertDescription className="text-sm">{card.explanation}</AlertDescription>
            </Alert>
          ) : (
            <Card className="min-h-36 pointer-events-none">
              <CardContent className="flex min-h-36 items-center justify-center text-center">
                <p className="text-base font-medium">{card.question}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right label */}
        <div
          className={cn(
            'flex w-16 shrink-0 items-center justify-center rounded-lg border-2 text-center text-sm font-semibold leading-tight transition-colors duration-150',
            isSwipingRight
              ? 'border-success text-success'
              : isSwipingLeft
                ? 'border-muted-foreground/20 text-muted-foreground/20'
                : 'border-muted-foreground/40 text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {card.rightLabel}
        </div>
      </div>

      {/* Swipe hint */}
      {!swipeState && (
        <p className="text-center text-xs text-muted-foreground">
          Drag the card or use the buttons below
        </p>
      )}

      {/* Button row */}
      {!swipeState && (
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleSwipe('left')}
            aria-label={`Swipe left — ${card.leftLabel}`}
          >
            ← {card.leftLabel}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleSwipe('right')}
            aria-label={`Swipe right — ${card.rightLabel}`}
          >
            {card.rightLabel} →
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
