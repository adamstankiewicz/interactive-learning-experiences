'use client';

import { Check, ChevronDown, Minus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { STAGES } from '@/lib/pathway/events';
import type { StageId } from '@/lib/pathway/events';
import type { PathwayState, StageStatus } from '@/lib/pathway/use-pathway-stream';

/** A small warmth accent on top of each stage's real copy — not a substitute for it. */
const STAGE_EMOJI: Record<StageId, string> = {
  propose: '🔍',
  verify: '✅',
  graph: '🕸️',
  plan: '🧠',
  widget: '🛠️',
};

/**
 * The run's own progress, shown as work happens rather than as a spinner.
 *
 * A slim segmented strip is the primary, always-visible view — it doesn't
 * compete with the document forming below it for attention. The full stage
 * list (candidate codes, verdicts) a teacher doesn't need mid-wait moves
 * behind "How this was built", collapsed by default even while streaming —
 * demoted, not removed, the same "provenance stays reachable, not upfront"
 * rule `DocumentHeader`'s "Why this standard" already follows.
 */
export function ActivityTrail({ state }: { state: PathwayState }) {
  const streaming = state.status === 'streaming';
  const elapsed = useElapsed(state.startedAt, state.finishedAt);
  const [open, setOpen] = useState(false);

  const rejected = Object.values(state.verdicts).filter((ok) => !ok).length;
  const activeStage = STAGES.find((stage) => state.stages[stage.id].status === 'active');

  const headline = streaming
    ? (activeStage?.active ?? 'Building the pathway')
    : state.status === 'error'
      ? 'Stopped'
      : 'Built the pathway';
  const emoji = streaming ? STAGE_EMOJI[activeStage?.id ?? 'propose'] : state.status === 'error' ? '🙃' : '🎉';

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2.5">
        <ol className="flex flex-1 gap-1.5" aria-label="Build progress">
          {STAGES.map((stage) => (
            <li key={stage.id} className="h-2 flex-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/50">
              <span
                className={cn(
                  'block h-full rounded-full transition-colors',
                  state.stages[stage.id].status === 'done' && 'bg-emerald-400',
                  state.stages[stage.id].status === 'active' && 'w-full animate-pulse bg-violet-400',
                  state.stages[stage.id].status === 'skipped' && 'bg-muted-foreground/30',
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
            className="flex-1 text-sm font-medium text-violet-700 dark:text-violet-300"
          >
            <span aria-hidden>{emoji}</span> {headline}
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
          <ol className="mt-2 space-y-0 border-l-2 border-border pl-3">
            {STAGES.map((stage) => {
              const entry = state.stages[stage.id];
              const isVerify = stage.id === 'verify';
              const showCandidates = isVerify && state.candidates.length > 0 && entry.status !== 'pending';

              return (
                <li key={stage.id} className="flex gap-3 py-1.5">
                  <StatusDot status={entry.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={cn(
                          'text-sm',
                          entry.status === 'pending'
                            ? 'text-muted-foreground/50'
                            : entry.status === 'active'
                              ? 'font-medium'
                              : 'text-muted-foreground',
                        )}
                      >
                        {stage.label}
                      </span>
                      {entry.detail && <span className="text-xs text-muted-foreground">{entry.detail}</span>}
                    </div>

                    {showCandidates && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {state.candidates.map((candidate) => (
                          <Verdict
                            key={candidate.statementCode}
                            code={candidate.statementCode}
                            verdict={state.verdicts[candidate.statementCode]}
                          />
                        ))}
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
 * has not been asked yet — the resolution loop short-circuits on the first hit,
 * so trailing codes stay unchecked and should not read as rejected.
 */
function Verdict({ code, verdict }: { code: string; verdict: boolean | undefined }) {
  if (verdict === undefined) {
    return (
      <Badge variant="outline" className="font-mono text-muted-foreground/50">
        {code}
      </Badge>
    );
  }

  return verdict ? (
    <Badge variant="outline" className="border-success/40 font-mono text-success">
      <Check aria-hidden />
      {code}
    </Badge>
  ) : (
    <Badge variant="outline" className="font-mono text-muted-foreground line-through decoration-1">
      <X aria-hidden />
      {code}
    </Badge>
  );
}

function StatusDot({ status }: { status: StageStatus }) {
  const base = 'mt-1 flex size-3.5 shrink-0 items-center justify-center rounded-full';

  if (status === 'done') {
    return (
      <span className={cn(base, 'bg-success/15 text-success')} aria-label="done">
        <Check className="size-2.5" aria-hidden />
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className={cn(base, 'bg-muted text-muted-foreground')} aria-label="skipped">
        <Minus className="size-2.5" aria-hidden />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className={cn(base, 'relative')} aria-label="in progress">
        <span className="absolute inline-flex size-3.5 animate-ping rounded-full bg-primary/25" />
        <span className="relative size-2 rounded-full bg-primary" />
      </span>
    );
  }
  return (
    <span className={cn(base, 'border border-muted-foreground/30')} aria-label="pending" />
  );
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
