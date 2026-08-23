'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { STAGES } from '@/lib/pathway/events';
import type { PathwayState, StageStatus } from '@/lib/pathway/use-pathway-stream';

/**
 * The run's own progress, shown as work happens rather than as a spinner —
 * the in-progress state is the design. A square segmented strip is the
 * always-visible summary; the stage rows and the graph's verdicts sit in a
 * collapsible that opens itself during a run (the trust beat should be seen)
 * and stays reachable afterwards.
 */
export function ActivityTrail({ state }: { state: PathwayState }) {
  const streaming = state.status === 'streaming';
  const elapsed = useElapsed(state.startedAt, state.finishedAt);
  const [open, setOpen] = useState(true);

  const rejected = Object.values(state.verdicts).filter((ok) => !ok).length;
  const activeStage = STAGES.find((stage) => state.stages[stage.id].status === 'active');

  const headline = streaming
    ? (activeStage?.active ?? 'Building the pathway')
    : state.status === 'error'
      ? 'Stopped'
      : 'Built the pathway';

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2.5">
        <ol className="flex flex-1 gap-[5px]" aria-label="Build progress">
          {STAGES.map((stage) => (
            <li key={stage.id} className="h-[7px] flex-1 overflow-hidden bg-sunk">
              <span
                className={cn(
                  'block h-full transition-[width] duration-100',
                  state.stages[stage.id].status === 'done' && 'w-full bg-verified',
                  state.stages[stage.id].status === 'active' &&
                    'w-full animate-pulse bg-foreground motion-reduce:animate-none',
                  state.stages[stage.id].status === 'skipped' && 'w-full bg-warning-edge',
                  state.stages[stage.id].status === 'pending' && 'w-0',
                )}
              />
            </li>
          ))}
        </ol>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {(elapsed / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={headline}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex-1 text-sm font-semibold',
              streaming
                ? 'text-brand-text'
                : state.status === 'error'
                  ? 'text-destructive'
                  : 'text-verified',
            )}
          >
            {!streaming && state.status !== 'error' && <span aria-hidden>✓ </span>}
            {state.status === 'error' && <span aria-hidden>⚠ </span>}
            {headline}
            {!streaming && rejected > 0 && (
              <span className="font-normal text-muted-foreground">
                {' '}
                · {rejected} code{rejected === 1 ? '' : 's'} rejected by the graph
              </span>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-1.5">
        <CollapsibleTrigger className="group/why flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className="size-3.5 transition-transform group-data-panel-open/why:rotate-180" />
          How this was built
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="mt-2 space-y-0 border-l border-border pl-3.5">
            {STAGES.map((stage) => {
              const entry = state.stages[stage.id];
              const isVerify = stage.id === 'verify';
              const showCandidates = isVerify && state.candidates.length > 0 && entry.status !== 'pending';

              return (
                <li key={stage.id} className="flex gap-3 py-1.5">
                  <StatusMarker status={entry.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span
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
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.detail ??
                          (entry.status === 'skipped'
                            ? 'Skipped — there is no anchor to walk'
                            : entry.status === 'pending'
                              ? 'waiting'
                              : null)}
                      </span>
                    </div>

                    {showCandidates && (
                      <div className="mt-1.5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          The graph votes
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {state.candidates.map((candidate) => (
                            <Verdict
                              key={candidate.statementCode}
                              code={candidate.statementCode}
                              verdict={state.verdicts[candidate.statementCode]}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * A code the model proposed and the graph's answer. Undefined means the graph
 * has not been asked yet — the resolution loop short-circuits on the first
 * hit, so trailing codes stay unchecked and must not read as rejected.
 * Rejections stay on screen: provenance, not embarrassment.
 */
function Verdict({ code, verdict }: { code: string; verdict: boolean | undefined }) {
  if (verdict === undefined) {
    return (
      <span className="inline-flex animate-pulse items-center gap-1 border border-dashed border-border px-1.5 py-px font-mono text-[11px] text-muted-foreground/70 motion-reduce:animate-none">
        {code}
      </span>
    );
  }

  return verdict ? (
    <span className="inline-flex items-center gap-1 border border-verified-edge bg-verified-tint px-1.5 py-px font-mono text-[11px] text-verified">
      ✓ {code}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 border border-border px-1.5 py-px font-mono text-[11px] text-muted-foreground line-through decoration-1">
      ✗ {code}
    </span>
  );
}

/** 19px square stage markers: verified tint when done, pulsing highlighter while active, rule outline while pending. */
function StatusMarker({ status }: { status: StageStatus }) {
  const base = 'mt-0.5 flex size-[19px] shrink-0 items-center justify-center text-[11px]';

  if (status === 'done') {
    return (
      <span className={cn(base, 'border border-verified-edge bg-verified-tint text-verified')} role="img" aria-label="done">
        ✓
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className={cn(base, 'border border-warning-edge bg-warning-tint text-warning')} role="img" aria-label="skipped">
        –
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span
        className={cn(base, 'animate-pulse border border-foreground bg-brand-fill motion-reduce:animate-none')}
        aria-label="in progress"
      />
    );
  }
  return <span className={cn(base, 'border border-border')} role="img" aria-label="pending" />;
}

/**
 * Elapsed time for the run, frozen once it finishes.
 *
 * The run owns both timestamps, so this only has to supply a ticking `now`
 * while it is in flight: the clock is the external system the effect
 * subscribes to, and elapsed is derived rather than stored.
 */
function useElapsed(startedAt: number | null, finishedAt: number | null) {
  const [now, setNow] = useState(0);
  const running = startedAt !== null && finishedAt === null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  if (startedAt === null) return 0;
  return Math.max(0, (finishedAt ?? now) - startedAt);
}
