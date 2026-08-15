'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { FlashcardSpec } from '@/lib/pathway/schema';

type CardSpec = FlashcardSpec['cards'][number];
type Side = CardSpec['front'];

type Props = { spec: FlashcardSpec; onComplete?: (correct: boolean) => void };

// Direction the new card enters from.
type SlideDirection = 'left' | 'right' | 'none';

function CardSide({ side }: { side: Side }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {side.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={side.imageUrl}
          alt={side.imageAlt ?? ''}
          className="max-h-48 w-full rounded-lg object-contain bg-white p-1"
        />
      )}
      {side.text && (
        <p className="text-lg font-semibold text-foreground leading-snug">{side.text}</p>
      )}
      {side.markdown && (
        <div className="w-full text-left text-sm text-foreground flex flex-col gap-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc pl-5 flex flex-col gap-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 flex flex-col gap-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            }}
          >
            {side.markdown}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// Dot progress indicator
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-4 h-2 bg-primary'
              : i < current
                ? 'w-2 h-2 bg-primary/40'
                : 'w-2 h-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

export function Flashcard({ spec, onComplete }: Props) {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [slideDir, setSlideDir] = useState<SlideDirection>('none');
  // Key increments on every card change to force a remount of the card div,
  // which re-triggers the CSS animation even when going back to the same index.
  const [cardKey, setCardKey] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const card = spec.cards[cardIndex]!;
  const isLast = cardIndex === spec.cards.length - 1;
  const isFirst = cardIndex === 0;

  const navigate = useCallback((delta: 1 | -1) => {
    setSlideDir(delta === 1 ? 'left' : 'right');
    setCardKey((k) => k + 1);
    setCardIndex((i) => i + delta);
    setFlipped(false);
  }, []);

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete?.(true);
    } else {
      navigate(1);
    }
  }, [isLast, onComplete, navigate]);

  const handlePrev = useCallback(() => {
    if (!isFirst) navigate(-1);
  }, [isFirst, navigate]);

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  // Arrow keys always navigate; space always flips.
  // Guard inputs/textareas so we don't steal keystrokes from other form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      else if (e.key === ' ') { e.preventDefault(); handleFlip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev, handleFlip]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{spec.prompt}</p>
        <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {cardIndex + 1} / {spec.cards.length}
        </span>
      </div>

      {/* Card stage */}
      <div className="rounded-2xl">
        <div
          key={cardKey}
          ref={cardRef}
          tabIndex={0}
          role="button"
          onClick={handleFlip}
          aria-label={flipped ? `Card back: ${card.id}` : `Card front: ${card.id} — press space to flip`}
          className="w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
          style={{
            perspective: '1000px',
            animation: slideDir === 'none'
              ? undefined
              : `slide-in-${slideDir} 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
          }}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '220px',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-border bg-card p-6 shadow-sm hover:border-muted-foreground/30"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <CardSide side={card.front} />
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 shadow-sm"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <CardSide side={card.back} />
            </div>
          </div>
        </div>
      </div>

      {/* Flip hint — below the card so it never overlaps content */}
      <p className="text-center text-xs text-muted-foreground/60 select-none -mt-2">
        {flipped ? 'Tap to hide' : 'Tap to reveal'}
      </p>

      {/* Progress dots */}
      <ProgressDots total={spec.cards.length} current={cardIndex} />

      {/* Navigation row */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          variant="outline"
          disabled={isFirst}
          onClick={handlePrev}
          aria-label="Previous card"
        >
          ← Back
        </Button>
        <Button
          size="lg"
          onClick={handleNext}
        >
          {isLast ? 'Continue to next section' : 'Next →'}
        </Button>
      </div>

      {/* Slide keyframes injected once */}
      <style>{`
        @keyframes slide-in-left {
          from { transform: translateX(100px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(-100px); opacity: 0; }
          to   { transform: translateX(0);      opacity: 1; }
        }
      `}</style>
    </div>
  );
}
