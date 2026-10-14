'use client';

import { AssignToStudents } from '@/components/roster/AssignToStudents';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { PathwayState } from '@/lib/pathway/use-pathway-stream';

/**
 * The plan review rail (design 1d): assignment first, then provenance —
 * the anchor, its companions, and the codes the graph rejected, kept as a
 * record — then coverage per outcome with an honest note where it runs thin.
 * Rendered only once a run is done; the document owns the left column.
 */
export function PlanRail({ state, gradeHint }: { state: PathwayState; gradeHint?: string }) {
  if (state.status !== 'done' || !state.anchor) return null;

  const plan = state.plan as PathwayPlan | null;
  const rejected = Object.entries(state.verdicts)
    .filter(([, ok]) => !ok)
    .map(([code]) => code);

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <AssignToStudents
        topic={state.topic}
        gradeHint={gradeHint}
        parentSessionId={state.sessionId ?? undefined}
      />

      <section className="border border-border bg-card p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Provenance
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {state.anchor.standard.verified ? (
            <span className="inline-flex items-center gap-1 border border-verified-edge bg-verified-tint px-1.5 py-px font-mono text-[10.5px] text-verified">
              ✓ {state.anchor.standard.code}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 border border-warning-edge bg-warning-tint px-1.5 py-px font-mono text-[10.5px] text-warning">
              ⚠ no standard matched
            </span>
          )}
          {state.anchor.companions.map((companion) => (
            <span
              key={companion.code}
              className="inline-flex items-center gap-1 border border-verified-edge px-1.5 py-px font-mono text-[10.5px] text-verified"
            >
              {companion.code}
            </span>
          ))}
        </div>
        {rejected.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Rejected by the graph:{' '}
            {rejected.map((code) => (
              <span key={code} className="mr-1.5 font-mono line-through decoration-1">
                {code}
              </span>
            ))}
            <span className="block">Kept on the session record.</span>
          </p>
        )}
      </section>

      {plan && plan.outcomes.length > 0 && (
        <section className="border border-border bg-card p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Coverage by outcome
          </h3>
          <ul className="mt-2 space-y-2.5">
            {plan.outcomes.map((outcome, index) => {
              const count = plan.steps.filter((step) => step.outcomeIndex === index).length;
              const max = Math.max(1, ...plan.outcomes.map((_, i) => plan.steps.filter((s) => s.outcomeIndex === i).length));
              return (
                <li key={outcome.statement}>
                  <p className="truncate text-xs text-ink-2" title={outcome.statement}>
                    {outcome.statement}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 flex-1 bg-sunk">
                      <span
                        className="block h-full bg-foreground"
                        style={{ width: `${Math.round((count / max) * 100)}%` }}
                      />
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {count} step{count === 1 ? '' : 's'}
                      {count <= 1 ? ' · thin' : ''}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
