'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import type { StepRevealSpec } from '@/lib/pathway/schema';

type Props = { spec: StepRevealSpec; onComplete?: (correct: boolean) => void };

type Step = StepRevealSpec['steps'][number];

function StepItem({ step, index, isNew, isLast }: { step: Step; index: number; isNew: boolean; isLast: boolean }) {
  return (
    <li
      className={isNew ? 'step-reveal-enter' : ''}
      aria-label={step.title}
    >
      <div className="flex gap-4">
        {/* Timeline connector + number circle */}
        <div className="flex flex-col items-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {index + 1}
          </div>
          {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" aria-hidden="true" />}
        </div>

        {/* Step content */}
        <div className="pb-6 pt-0.5 min-w-0 flex-1">
          <h3 className="mb-2 text-sm font-semibold text-foreground leading-snug">{step.title}</h3>

          <div className="flex flex-col gap-2 text-sm text-foreground">
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
              {step.body}
            </ReactMarkdown>
          </div>

          {step.why && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <span className="font-semibold">Why? </span>
                {step.why}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function StepReveal({ spec, onComplete }: Props) {
  // visibleCount: how many steps have been revealed (starts at 1)
  const [visibleCount, setVisibleCount] = useState(1);
  // Track which step index was just revealed so we can animate it
  const [newestIndex, setNewestIndex] = useState(0);

  const totalSteps = spec.steps.length;
  const isOnLastStep = visibleCount === totalSteps;

  function handleNext() {
    if (isOnLastStep) {
      onComplete?.(true);
    } else {
      const nextIndex = visibleCount;
      setNewestIndex(nextIndex);
      setVisibleCount((c) => c + 1);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Framing prompt */}
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      {/* Step list — aria-live so screen readers announce new steps */}
      <ul
        className="flex flex-col"
        aria-live="polite"
        aria-label="Steps"
      >
        {spec.steps.slice(0, visibleCount).map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isNew={index === newestIndex && index > 0}
            isLast={index === visibleCount - 1}
          />
        ))}
      </ul>

      {/* Navigation button */}
      <Button size="lg" className="w-full" onClick={handleNext}>
        {isOnLastStep ? 'Continue to next section' : 'Next step →'}
      </Button>

      {/* Animation keyframes */}
      <style>{`
        @keyframes step-reveal-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .step-reveal-enter {
          animation: step-reveal-in 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
      `}</style>
    </div>
  );
}
