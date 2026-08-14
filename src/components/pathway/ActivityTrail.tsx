'use client';

import { Check, ChevronDown, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { STAGES } from '@/lib/pathway/events';
import type { PathwayState, StageStatus } from '@/lib/pathway/use-pathway-stream';

/**
 * The run's own progress, shown as work happens rather than as a spinner.
 *
 * The whole stage list renders up front, pending steps included, so the shape
 * of the work is legible before any of it finishes. Once the run completes the
 * trail collapses to a one-line receipt — it is scaffolding for the wait, not
 * something to keep reading afterwards.
 */
export function ActivityTrail({ state }: { state: PathwayState }) {
  const streaming = state.status === 'streaming';
  const elapsed = useElapsed(state.startedAt, state.finishedAt);
  const [open, setOpen] = useState(true);
  const [prevStatus, setPrevStatus] = useState(state.status);

  // Open for the wait, collapse once there is real output to look at instead.
  // Adjusting during render rather than in an effect avoids a second pass.
  if (state.status !== prevStatus) {
    setPrevStatus(state.status);
    if (state.status === 'done') setOpen(false);
    if (state.status === 'streaming') setOpen(true);
  }

  const rejected = Object.values(state.verdicts).filter((ok) => !ok).length;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-8 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50">
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
        />
        <span className="font-heading text-sm font-medium">
          {streaming ? 'Building the pathway' : state.status === 'error' ? 'Stopped' : 'Built the pathway'}
        </span>
        {!open && rejected > 0 && (
          <span className="text-xs text-muted-foreground">
            · {rejected} code{rejected === 1 ? '' : 's'} rejected by the graph
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {(elapsed / 1000).toFixed(1)}s
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ol className="space-y-0 px-4 pb-3">
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

                  {entry.status === 'active' && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{stage.active}</p>
                  )}

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
