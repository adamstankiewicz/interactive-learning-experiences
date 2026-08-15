'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Sparkles } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { WidgetRenderer } from '@/components/widgets/registry';
import { plainMath } from '@/lib/learning-commons/format';
import type { Anchor, DeepPartial } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { PathwayState } from '@/lib/pathway/use-pathway-stream';
import { cn } from '@/lib/utils';

type RegenerateStep = (anchor: Anchor, plan: PathwayPlan, stepIndex: number) => Promise<void>;
type EditPlan = (plan: PathwayPlan) => void;

const PURPOSE_LABEL: Record<string, string> = {
  activate: 'Activate',
  model: 'Model',
  practice: 'Practice',
  check: 'Check',
};

type PartialStep = DeepPartial<PathwayPlan>['steps'] extends (infer S)[] | undefined ? S : never;

/**
 * The generated pathway, as the artifact a teacher actually reads.
 *
 * Ordering is deliberate and differs from the pipeline's: the lesson leads, and
 * the standards provenance that justifies it sits one disclosure away. A
 * teacher opens this to teach, not to audit the knowledge graph — but the audit
 * has to stay one click from the claim it supports.
 */
export function PathwayDocument({
  state,
  onRegenerateStep,
  onEditPlan,
}: {
  state: PathwayState;
  onRegenerateStep?: RegenerateStep;
  onEditPlan?: EditPlan;
}) {
  const { anchor, plan } = state;
  if (!anchor) return null;

  // Both only make sense once `plan` is the real validated thing, not the
  // partial shape it streams in as — regeneration replays a step through the
  // same widget-generation call the pipeline made the first time, and an
  // edit rewrites a field on a plan that still has every other field intact.
  const regenerateStep = state.status === 'done' ? onRegenerateStep : undefined;
  const editPlan = state.status === 'done' ? onEditPlan : undefined;

  const rejectedCodes = Object.entries(state.verdicts)
    .filter(([, resolved]) => !resolved)
    .map(([code]) => code);

  // Every edit callback closes over the *current* full plan and writes back
  // a whole new one — `editPlan` (like `regenerateStep`) is only ever handed
  // a complete `PathwayPlan`, never a partial one, so this cast is safe
  // exactly where `editPlan` itself is truthy.
  const editOutcome = editPlan
    ? (index: number, field: 'statement' | 'evidence', text: string) => {
        const current = plan as PathwayPlan;
        editPlan({
          ...current,
          outcomes: current.outcomes.map((o, i) => (i === index ? { ...o, [field]: text } : o)),
        });
      }
    : undefined;

  const editStepField = editPlan
    ? (index: number, field: 'title' | 'description', text: string) => {
        const current = plan as PathwayPlan;
        editPlan({
          ...current,
          steps: current.steps.map((s, i) => (i === index ? { ...s, [field]: text } : s)),
        });
      }
    : undefined;

  const editMisconception = editPlan
    ? (index: number, text: string) => {
        const current = plan as PathwayPlan;
        editPlan({
          ...current,
          misconceptions: current.misconceptions.map((m, i) => (i === index ? text : m)),
        });
      }
    : undefined;

  return (
    <article className="mt-8 space-y-10">
      <DocumentHeader
        anchor={anchor}
        plan={plan}
        rejectedCodes={rejectedCodes}
        topic={state.topic}
        onEditBigIdea={
          editPlan ? (text) => editPlan({ ...(plan as PathwayPlan), bigIdea: text }) : undefined
        }
      />

      {/* Backward design: objectives before activities. A teacher decides
          whether this is the right target for their class from the outcomes,
          before investing in reading the five-step sequence that serves them. */}
      {Boolean(plan?.outcomes?.length) && (
        <Section
          title="What students will be able to do"
          note={
            anchor.learningComponents.length
              ? `Grounded in ${anchor.learningComponents.length} learning components from the graph`
              : 'This standard has no published learning components'
          }
        >
          <ol className="space-y-3">
            {plan?.outcomes?.map((outcome, index) => (
              <li key={index}>
                <Card size="sm">
                  <CardContent>
                    {editOutcome ? (
                      <EditableText
                        value={outcome?.statement ?? ''}
                        onSave={(text) => editOutcome(index, 'statement', text)}
                        className="text-sm font-medium"
                      />
                    ) : (
                      <p className="text-sm font-medium">{outcome?.statement}</p>
                    )}
                    {editOutcome ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        You&rsquo;ll know they have it when:{' '}
                        <EditableText
                          value={outcome?.evidence ?? ''}
                          onSave={(text) => editOutcome(index, 'evidence', text)}
                          as="span"
                        />
                      </div>
                    ) : (
                      outcome?.evidence && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          You&rsquo;ll know they have it when: {outcome.evidence}
                        </p>
                      )
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {Boolean(plan?.steps?.length) && (
        <Section title="The pathway" note="Each step, in order, with its interaction">
          <ol className="space-y-4">
            {plan?.steps?.map((step, index) => (
              <StepCard
                key={index}
                step={step}
                index={index}
                state={state}
                onRegenerate={
                  regenerateStep ? () => regenerateStep(anchor, plan as PathwayPlan, index) : undefined
                }
                onEditField={
                  editStepField ? (field, text) => editStepField(index, field, text) : undefined
                }
              />
            ))}
          </ol>
        </Section>
      )}

      {Boolean(plan?.misconceptions?.length) && (
        <Section title="Watch for" note="Specific, diagnosable misconceptions">
          <ul className="space-y-2">
            {plan?.misconceptions?.map((misconception, index) => (
              <li key={index} className="flex gap-2.5 text-sm">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                {editMisconception ? (
                  <EditableText
                    value={misconception ?? ''}
                    onSave={(text) => editMisconception(index, text)}
                    as="span"
                    className="flex-1"
                  />
                ) : (
                  misconception
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {anchor.prerequisites.length > 0 && (
        <Section
          title="Prior knowledge to activate"
          note="Earlier standards this one builds on — activate, don't reteach"
        >
          <ul className="space-y-2.5">
            {anchor.prerequisites.map((prerequisite) => (
              <li key={prerequisite.id} className="text-sm">
                <Badge variant="outline" className="mr-2 font-mono">
                  {prerequisite.code}
                </Badge>
                {plainMath(prerequisite.description)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {anchor.companions.length > 0 && (
        <Section
          title="Also touches"
          note="Peer standards from other subjects this topic resolved against — informed the framing, not the outcomes"
        >
          <ul className="space-y-2.5">
            {anchor.companions.map((companion) => (
              <li key={companion.id} className="text-sm">
                <Badge variant="outline" className="mr-2 font-mono">
                  {companion.code}
                </Badge>
                <span className="text-xs text-muted-foreground">{companion.subject} · </span>
                {plainMath(companion.description)}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function DocumentHeader({
  anchor,
  plan,
  rejectedCodes,
  topic,
  onEditBigIdea,
}: {
  anchor: Anchor;
  plan: DeepPartial<PathwayPlan> | null;
  rejectedCodes: string[];
  topic: string;
  onEditBigIdea?: (text: string) => void;
}) {
  const { standard } = anchor;

  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        {standard.verified ? (
          <>
            <Badge className="font-mono">{standard.code}</Badge>
            <span className="text-xs text-muted-foreground">
              {standard.subject} · Grade {standard.gradeLevels.join(', ')} · {standard.jurisdiction}
            </span>
          </>
        ) : (
          <Badge variant="secondary" className="font-mono">
            Exploration pathway — not matched to a standard
          </Badge>
        )}
      </div>

      <h2 className="mt-3 font-heading text-xl font-semibold tracking-tight">{topic}</h2>

      {onEditBigIdea ? (
        <EditableText
          value={plan?.bigIdea ?? ''}
          onSave={onEditBigIdea}
          className="mt-2 text-base leading-relaxed text-muted-foreground"
          multiline
        />
      ) : (
        plan?.bigIdea && (
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{plan.bigIdea}</p>
        )
      )}

      {/* The provenance is the product's whole claim, so it stays reachable —
          but a teacher planning a lesson does not need it open by default. */}
      <Collapsible className="mt-4">
        <CollapsibleTrigger className="group/why flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]/why:rotate-180" />
          {standard.verified ? 'Why this standard' : 'Why no standard'}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
            {standard.verified ? (
              <>
                <p className="leading-relaxed">{plainMath(standard.description)}</p>
                <p className="mt-2 text-xs">
                  Matched against the {standard.sourceLabel} graph.
                  {rejectedCodes.length > 0 && (
                    <> Rejected before this one: {rejectedCodes.join(', ')}.</>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs">
                None of the proposed codes resolved against any active standards source
                {rejectedCodes.length > 0 && <> ({rejectedCodes.join(', ')})</>}. This pathway is built from
                general subject-matter knowledge instead — treat it as a starting point to review, not a
                verified alignment.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </header>
  );
}

/**
 * A step and the interaction it asked for.
 *
 * The plan names a `widgetKind` before the spec exists, so a step can advertise
 * a pending interaction — the placeholder is real information, not a spinner.
 */
function StepCard({
  step,
  index,
  state,
  onRegenerate,
  onEditField,
}: {
  step: PartialStep;
  index: number;
  state: PathwayState;
  onRegenerate?: () => void;
  onEditField?: (field: 'title' | 'description', text: string) => void;
}) {
  const purpose = step?.purpose;
  const widget = state.stepWidgets[index];
  const note = state.stepWidgetNotes[index];
  const pending = Boolean(step?.widgetKind) && widget === undefined;
  const regenerating = Boolean(state.regeneratingSteps[index]);
  const regenerateError = state.stepErrors[index];

  return (
    <li className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:gap-4">
        <span className="shrink-0 sm:w-20">
          {/* A filing tab, not a chip — border-left rather than a filled pill,
              square rather than rounded-full. This is a category marker in a
              lesson sequence, closer to a binder divider than a marketing tag. */}
          <span className="inline-flex items-center border-l-2 border-primary bg-primary/5 py-0.5 pl-1.5 font-mono text-[10px] font-semibold tracking-widest text-primary-tint-foreground uppercase">
            {(purpose && PURPOSE_LABEL[purpose]) ?? purpose}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          {onEditField ? (
            <EditableText
              value={step?.title ?? ''}
              onSave={(text) => onEditField('title', text)}
              className="text-sm font-medium"
            />
          ) : (
            <p className="text-sm font-medium">{step?.title}</p>
          )}
          {onEditField ? (
            <EditableText
              value={step?.description ?? ''}
              onSave={(text) => onEditField('description', text)}
              className="mt-0.5 text-sm text-muted-foreground"
              multiline
            />
          ) : (
            step?.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
            )
          )}
          {regenerateError && <p className="mt-1 text-xs text-destructive">{regenerateError}</p>}
        </div>
        {onRegenerate && widget && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex shrink-0 items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className={cn('size-3.5', regenerating && 'animate-spin')} aria-hidden />
            {regenerating ? 'Trying again…' : 'Try a different one'}
          </button>
        )}
      </div>

      {(widget || pending || note) && (
        <div className={cn('border-t border-border bg-muted/30 px-4 py-4', 'sm:pl-24')}>
          {widget ? (
            <WidgetRenderer spec={widget} />
          ) : pending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse" aria-hidden />
              Building the interaction for this step…
            </p>
          ) : (
            <Alert variant="warning">
              <AlertDescription>{note}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {/* Mono is the register for anything that labels or classifies rather
          than reads as prose — same rule the standard-code badge already
          follows. A curriculum tool's native material is codes and
          categories; the type system says so instead of a generic sans
          eyebrow every SaaS product reaches for. */}
      <div className="mb-3">
        <h3 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {title}
        </h3>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Click a prose field, get a textarea in its place; blur or Enter commits,
 * Escape reverts. No rich-text formatting, no AI toolbar — just the ability
 * to hand-fix a word choice without regenerating the whole step around it.
 * `onSave` only fires when the trimmed text actually changed.
 */
function EditableText({
  value,
  onSave,
  as = 'p',
  className,
  multiline = false,
}: {
  value: string;
  onSave: (text: string) => void;
  as?: 'p' | 'span';
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    ref.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  }

  if (editing) {
    return (
      <Textarea
        ref={ref}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
            setEditing(false);
          } else if (event.key === 'Enter' && !multiline && !event.shiftKey) {
            event.preventDefault();
            commit();
          }
        }}
        rows={multiline ? 3 : 1}
        className={cn('min-h-0 resize-none py-1', className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        'cursor-text rounded text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50',
        as === 'p' && 'block w-full',
        className,
      )}
    >
      {value || <span className="text-muted-foreground/50">Click to add…</span>}
    </button>
  );
}
