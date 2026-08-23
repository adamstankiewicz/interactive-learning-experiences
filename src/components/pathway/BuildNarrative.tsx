'use client';

import { motion } from 'motion/react';
import type { CSSProperties } from 'react';

import { hueForActivity, kindLabel } from '@/components/pathway/ActivityFrame';
import { STAGES } from '@/lib/pathway/events';
import type { PathwayState, StageStatus } from '@/lib/pathway/use-pathway-stream';
import { cn } from '@/lib/utils';

/**
 * The two-column build narrative (design 1c): the in-progress state is the
 * design. Left column, the five pipeline stages and the graph's verdicts as
 * rows that settle and stay. Right column, the anchor card sliding in and
 * plan steps appearing one at a time, each with an activity cell in its
 * guest hue that reads "configuring…" until the widget arrives.
 *
 * Rendered only while a run streams — once it finishes, the plan document
 * below is the artifact and this narrative retires; provenance stays
 * reachable through the document's own disclosure.
 */

/** How each completion behaviour reads in the activity cell, in words. */
const COMPLETION_COPY: Record<string, string> = {
  'markdown-card': 'advances itself',
  flashcard: 'advances itself',
  'step-reveal': 'advances itself',
  'narrated-card': 'advances itself',
  'swiper-flashcard': 'advances itself',
  'drag-sort': 'advances itself',
  'drag-categorize': 'advances itself',
  'timeline-builder': 'advances itself',
  'fraction-area-model': 'open-ended',
  'draft-meter': 'open-ended',
  crossword: 'open-ended',
};

function completionCopy(kind: string): string {
  return COMPLETION_COPY[kind] ?? 'signals done';
}

/** Static classes — Tailwind only compiles class names it can see. */
const PURPOSE_TAG: Record<string, string> = {
  activate: 'bg-(--purpose-activate-bg) text-(--purpose-activate-fg)',
  model: 'bg-(--purpose-model-bg) text-(--purpose-model-fg)',
  practice: 'bg-(--purpose-practice-bg) text-(--purpose-practice-fg)',
  check: 'bg-(--purpose-check-bg) text-(--purpose-check-fg)',
};

export function BuildNarrative({ state }: { state: PathwayState }) {
  if (state.status !== 'streaming') return null;

  const anchorCode = state.anchor?.standard.code ?? null;
  const steps = state.plan?.steps ?? [];

  return (
    <div className="mt-6 grid gap-6 border-t border-border pt-6 lg:grid-cols-[430px_minmax(0,1fr)] lg:gap-0">
      {/* Left: the stages, and the trust beat. */}
      <div className="lg:border-r lg:border-border lg:pr-6">
        <ol>
          {STAGES.map((stage) => {
            const entry = state.stages[stage.id];
            return (
              <li key={stage.id} className="flex gap-3 py-2">
                <Marker status={entry.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm',
                      entry.status === 'pending'
                        ? 'text-muted-foreground/60'
                        : entry.status === 'active'
                          ? 'font-semibold'
                          : entry.status === 'skipped'
                            ? 'text-warning'
                            : 'text-ink-2',
                    )}
                  >
                    {stage.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.status === 'active'
                      ? stage.active
                      : (entry.detail ??
                        (entry.status === 'skipped'
                          ? 'Skipped — there is no anchor to walk'
                          : entry.status === 'pending'
                            ? 'waiting'
                            : ''))}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {state.candidates.length > 0 && (
          <div className="mt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              The graph votes
            </p>
            <ul className="mt-1.5 space-y-1">
              {state.candidates.map((candidate) => {
                const verdict = state.verdicts[candidate.statementCode];
                const isAnchor = candidate.statementCode === anchorCode;
                if (verdict === undefined) {
                  return (
                    <li
                      key={candidate.statementCode}
                      className="animate-pulse border border-dashed border-border px-2.5 py-1.5 font-mono text-xs text-muted-foreground/70 motion-reduce:animate-none"
                    >
                      {candidate.statementCode}
                    </li>
                  );
                }
                return (
                  <motion.li
                    key={candidate.statementCode}
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                    className={cn(
                      'flex items-baseline gap-2 border px-2.5 py-1.5 font-mono text-xs',
                      verdict
                        ? 'border-verified-edge bg-verified-tint text-verified'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    <span className={cn(!verdict && 'line-through decoration-1')}>
                      {verdict ? '✓' : '✗'} {candidate.statementCode}
                    </span>
                    <span className="font-sans text-[11px] normal-case">
                      {verdict
                        ? isAnchor
                          ? `${state.anchor?.standard.sourceLabel ?? 'verified'} · anchor`
                          : 'verified · companion'
                        : 'no such code'}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Right: the pathway forming. */}
      <div className="lg:pl-6">
        {state.anchor ? (
          <motion.div
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              {state.anchor.standard.verified ? (
                <span className="inline-flex items-center gap-1 border border-verified-edge bg-verified-tint px-1.5 py-px font-mono text-[10.5px] text-verified">
                  ✓ {state.anchor.standard.code}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 border border-warning-edge bg-warning-tint px-1.5 py-px font-mono text-[10.5px] text-warning">
                  ⚠ no standard matched
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {state.anchor.standard.sourceLabel}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-2">{state.anchor.standard.description}</p>

            {state.anchor.learningComponents.length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Breaks down into
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
                  {state.anchor.learningComponents.slice(0, 4).map((component) => (
                    <li key={component.id}>· {component.description}</li>
                  ))}
                </ul>
              </div>
            )}

            {state.anchor.prerequisites.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Builds on {state.anchor.prerequisites.map((p) => p.code).join(', ')}
              </p>
            )}
          </motion.div>
        ) : (
          <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">
            Waiting for the graph…
          </div>
        )}

        {steps.length > 0 && (
          <ol className="mt-4 space-y-2">
            {steps.map((step, index) => {
              if (!step?.title) return null;
              const widget = state.stepWidgets[index];
              const widgetKind = step.widgetKind ?? '';
              const hue = hueForActivity(widgetKind || `step-${index}`);
              return (
                <motion.li
                  key={step.title}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex items-stretch gap-3 border border-border bg-card"
                >
                  <div className="min-w-0 flex-1 px-3.5 py-2.5">
                    {step.purpose && (
                      <span
                        className={cn(
                          'inline-block px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.12em]',
                          PURPOSE_TAG[step.purpose] ?? 'bg-sunk text-muted-foreground',
                        )}
                      >
                        {step.purpose}
                      </span>
                    )}
                    <p className="mt-1 truncate text-sm font-semibold">{step.title}</p>
                  </div>
                  <div
                    className="activity-skin flex w-40 shrink-0 flex-col justify-center border-l-[3px] px-3 py-2"
                    style={
                      {
                        '--activity-h': hue,
                        borderLeftColor: 'var(--activity-fill)',
                        background: 'var(--activity-tint)',
                      } as CSSProperties
                    }
                  >
                    {widget ? (
                      <>
                        <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--activity-text)' }}>
                          {kindLabel(widgetKind || 'activity')}
                        </span>
                        <span className="text-[11px] text-ink-2">{completionCopy(widgetKind)}</span>
                      </>
                    ) : (
                      <span className="animate-pulse text-[11px] text-muted-foreground motion-reduce:animate-none">
                        configuring…
                      </span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Marker({ status }: { status: StageStatus }) {
  const base = 'mt-0.5 flex size-[19px] shrink-0 items-center justify-center text-[11px]';
  if (status === 'done')
    return <span className={cn(base, 'border border-verified-edge bg-verified-tint text-verified')} role="img" aria-label="done">✓</span>;
  if (status === 'skipped')
    return <span className={cn(base, 'border border-warning-edge bg-warning-tint text-warning')} role="img" aria-label="skipped">–</span>;
  if (status === 'active')
    return <span className={cn(base, 'animate-pulse border border-foreground bg-brand-fill motion-reduce:animate-none')} role="img" aria-label="in progress" />;
  return <span className={cn(base, 'border border-border')} role="img" aria-label="pending" />;
}
