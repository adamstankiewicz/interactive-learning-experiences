'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Repeat,
  RotateCcw,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { WidgetRenderer } from '@/components/widgets/registry';
import { plainMath } from '@/lib/learning-commons/format';
import type { Anchor, DeepPartial } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { PathwayState } from '@/lib/pathway/use-pathway-stream';
import { cn } from '@/lib/utils';

import { ShareLink } from './ShareLink';

type RegenerateStep = (anchor: Anchor, plan: PathwayPlan, stepIndex: number) => Promise<void>;
type EditPlan = (plan: PathwayPlan) => void;

/**
 * Each step purpose gets its own icon and stage color — the same violet/
 * pink/amber/emerald family `/learn` builds its whole identity from — so the
 * four kinds read as distinct at a glance and a teacher scanning the list
 * sees a step's category from its border alone, not just a small label.
 * Raw Tailwind palette classes rather than the token system, on purpose:
 * this is the same "local, literal color" approach `/learn` and
 * `PathwayWalkthrough` already use, deliberately separate from the app's
 * quieter shadcn token layer.
 */
const PURPOSE_META: Record<
  string,
  { label: string; Icon: LucideIcon; border: string; tint: string; icon: string }
> = {
  activate: {
    label: 'Activate',
    Icon: Sparkles,
    border: 'border-pink-200 dark:border-pink-900',
    tint: 'bg-pink-100 dark:bg-pink-950/50',
    icon: 'text-pink-500 dark:text-pink-400',
  },
  model: {
    label: 'Model',
    Icon: BookOpen,
    border: 'border-violet-200 dark:border-violet-900',
    tint: 'bg-violet-100 dark:bg-violet-950/50',
    icon: 'text-violet-500 dark:text-violet-400',
  },
  practice: {
    label: 'Practice',
    Icon: Repeat,
    border: 'border-amber-200 dark:border-amber-900',
    tint: 'bg-amber-100 dark:bg-amber-950/50',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  check: {
    label: 'Check',
    Icon: CircleCheck,
    border: 'border-emerald-200 dark:border-emerald-900',
    tint: 'bg-emerald-100 dark:bg-emerald-950/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
};

/**
 * Waypoint colors for the pathway thread — the vertical line + node running
 * down "The pathway" section. Separate from `PURPOSE_META`'s `tint`/`icon`
 * (a low-alpha pill background needs a different color than a solid node
 * fill), reusing the same four-hue mapping so a step's category reads
 * identically whether you're scanning the thread or the card itself.
 */
const WAYPOINT_META: Record<string, { dot: string; line: string }> = {
  activate: { dot: 'bg-pink-400', line: 'bg-pink-200 dark:bg-pink-900' },
  model: { dot: 'bg-violet-400', line: 'bg-violet-200 dark:bg-violet-900' },
  practice: { dot: 'bg-amber-400', line: 'bg-amber-200 dark:bg-amber-900' },
  check: { dot: 'bg-emerald-400', line: 'bg-emerald-200 dark:bg-emerald-900' },
};

/** A preview cycle of the four purposes' border + waypoint colors, for the skeleton — real steps aren't known yet. */
const STEP_SKELETON_WAYPOINTS = (['activate', 'model', 'practice', 'check'] as const).map((purpose) => ({
  border: PURPOSE_META[purpose].border,
  dot: WAYPOINT_META[purpose].dot,
  line: WAYPOINT_META[purpose].line,
}));

/**
 * The plan names a step's `widgetKind` before the spec exists — real
 * information the pending state can use instead of a generic "loading"
 * label. Plain-English names, not the kind's identifier.
 */
const WIDGET_KIND_LABEL: Record<string, string> = {
  crossword: 'a crossword',
  'defend-claim': 'a defend-the-claim activity',
  'draft-meter': 'a live-scored draft',
  'drag-categorize': 'a sorting activity',
  'drag-sort': 'a drag-to-order activity',
  'draw-the-curve': 'a draw-the-curve activity',
  'find-the-flaw': 'a spot-the-mistake activity',
  flashcard: 'flashcards',
  'fraction-area-model': 'a fraction area model',
  'markdown-card': 'a reading card',
  'narrated-card': 'a narrated walkthrough',
  'step-reveal': 'a step-by-step reveal',
  'swiper-flashcard': 'a swipe activity',
  'timeline-builder': 'a timeline activity',
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
  const streaming = state.status === 'streaming';

  // Both only make sense once `plan` is the real validated thing, not the
  // partial shape it streams in as — regeneration replays a step through the
  // same widget-generation call the pipeline made the first time, and an
  // edit rewrites a field on a plan that still has every other field intact.
  const regenerateStep = state.status === 'done' ? onRegenerateStep : undefined;
  const editPlan = state.status === 'done' ? onEditPlan : undefined;

  const rejectedCodes = useMemo(
    () =>
      Object.entries(state.verdicts)
        .filter(([, resolved]) => !resolved)
        .map(([code]) => code),
    [state.verdicts],
  );

  // Every edit callback closes over the *current* full plan and writes back
  // a whole new one — `editPlan` (like `regenerateStep`) is only ever handed
  // a complete `PathwayPlan`, never a partial one, so this cast is safe
  // exactly where `editPlan` itself is truthy.
  const editOutcome = useMemo(
    () =>
      editPlan
        ? (index: number, field: 'statement' | 'evidence', text: string) => {
            const current = plan as PathwayPlan;
            editPlan({
              ...current,
              outcomes: current.outcomes.map((o, i) => (i === index ? { ...o, [field]: text } : o)),
            });
          }
        : undefined,
    [editPlan, plan],
  );

  const editStepField = useMemo(
    () =>
      editPlan
        ? (index: number, field: 'title' | 'description', text: string) => {
            const current = plan as PathwayPlan;
            editPlan({
              ...current,
              steps: current.steps.map((s, i) => (i === index ? { ...s, [field]: text } : s)),
            });
          }
        : undefined,
    [editPlan, plan],
  );

  const editMisconception = useMemo(
    () =>
      editPlan
        ? (index: number, text: string) => {
            const current = plan as PathwayPlan;
            editPlan({
              ...current,
              misconceptions: current.misconceptions.map((m, i) => (i === index ? text : m)),
            });
          }
        : undefined,
    [editPlan, plan],
  );

  // Stable across renders so a memoized StepCard is not invalidated by a new
  // closure every time the stream dispatches. Each card binds its own index.
  const handleRegenerateStep = useCallback(
    (index: number) => {
      if (regenerateStep && anchor) void regenerateStep(anchor, plan as PathwayPlan, index);
    },
    [regenerateStep, anchor, plan],
  );

  const handleEditStepField = useCallback(
    (index: number, field: 'title' | 'description', text: string) => {
      editStepField?.(index, field, text);
    },
    [editStepField],
  );

  // Below the hooks: they must run in the same order on every render. A
  // skeleton fills the gap between "submitted" and "the first real event
  // arrived" so the document starts assembling the instant a teacher hits
  // submit, rather than staying blank through the propose/verify/graph
  // stages. Once the run has ended without ever producing an anchor (an
  // early error, or a stop before anything landed) there is nothing to keep
  // showing a promise for.
  if (!anchor) {
    return state.status === 'streaming' ? <PathwayDocumentSkeleton /> : null;
  }

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
          before investing in reading the five-step sequence that serves them.
          A skeleton holds this section's place while streaming and before
          `plan` has landed — without it, `anchor`-derived sections further
          down (prior knowledge, also touches) would appear first simply
          because they arrive earlier, undercutting backward design exactly
          when a teacher is watching it build. */}
      {plan?.outcomes?.length ? (
        <Section
          title="What students will be able to do"
          note={
            anchor.learningComponents.length
              ? `Grounded in ${anchor.learningComponents.length} learning components from the graph`
              : 'This standard has no published learning components'
          }
        >
          <ol className="space-y-2">
            {plan?.outcomes?.map((outcome, index) => (
              <li
                key={index}
                className="flex items-start gap-3 rounded-2xl border-3 border-emerald-200 bg-card px-4 py-3.5 shadow-sm dark:border-emerald-900"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                >
                  <Target className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
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
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ) : streaming ? (
        <Section title="What students will be able to do">
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <OutcomeSkeletonRow key={i} />
            ))}
          </div>
        </Section>
      ) : null}

      {plan?.steps?.length ? (
        <Section title="The pathway" note="Each step, in order, with its interaction">
          {/* The one structural device this document earns: steps genuinely
              are an ordered sequence — a lesson walked in this order, not a
              set of independent cards — so a connecting thread with a
              waypoint per step encodes something true, the same way a trail
              map's line is the point, not decoration. */}
          <ol className="space-y-0">
            {plan?.steps?.map((step, index) => {
              const waypoint = (step?.purpose && WAYPOINT_META[step.purpose]) ?? null;
              const isLast = index === (plan?.steps?.length ?? 0) - 1;
              const Icon = (step?.purpose && PURPOSE_META[step.purpose]?.Icon) ?? Sparkles;

              return (
                <li key={index} className="flex gap-3">
                  <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden>
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-white',
                        waypoint?.dot ?? 'bg-muted-foreground/40',
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {!isLast && (
                      <span className={cn('my-1 w-0.5 flex-1 rounded-full', waypoint?.line ?? 'bg-border')} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <StepCard
                      step={step}
                      index={index}
                      widget={state.stepWidgets[index]}
                      widgetSeq={state.stepWidgetSeq[index] ?? 0}
                      note={state.stepWidgetNotes[index]}
                      regenerating={Boolean(state.regeneratingSteps[index])}
                      regenerateError={state.stepErrors[index]}
                      onRegenerate={regenerateStep ? handleRegenerateStep : undefined}
                      onEditField={editStepField ? handleEditStepField : undefined}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      ) : streaming ? (
        <Section title="The pathway" note="Each step, in order, with its interaction">
          <StepWaypointSkeletonList />
        </Section>
      ) : null}

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

/** Baked-in offsets rather than `Math.random()` — a fixed, designed burst shape, not jitter. */
const CONFETTI = [
  { emoji: '✨', x: -48, y: -36, rotate: -18, delay: 0 },
  { emoji: '🎊', x: 42, y: -32, rotate: 14, delay: 0.05 },
  { emoji: '⭐', x: -60, y: 8, rotate: -8, delay: 0.12 },
  { emoji: '🎉', x: 56, y: 12, rotate: 10, delay: 0.08 },
  { emoji: '✨', x: 4, y: -46, rotate: 0, delay: 0.16 },
];

/**
 * The actual payoff of a build, played as a real moment — not just a styled
 * box. Mirrors `PathwayWalkthrough`'s finished-state beat (spring-in, 🎉,
 * a tally) for a teacher instead of a student: the receipt (steps, standard,
 * time) and the share link are the same "here's what you made" idea, just
 * read here as a build summary rather than a stars count.
 */
export function PathwayCompletionStrip({ state }: { state: PathwayState }) {
  if (state.status !== 'done' || !state.sessionId) return null;

  const stepCount = state.plan?.steps?.length ?? 0;
  const code = state.anchor?.standard.verified ? state.anchor.standard.code : null;
  const elapsedMs = state.startedAt !== null && state.finishedAt !== null ? state.finishedAt - state.startedAt : null;

  const summary = [
    stepCount > 0 ? `${stepCount} step${stepCount === 1 ? '' : 's'}` : null,
    code ? `matched to ${code}` : null,
    elapsedMs !== null ? `built in ${(elapsedMs / 1000).toFixed(0)}s` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="mt-6 rounded-3xl border-3 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-transparent dark:to-amber-950/10"
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
          <Check className="size-6" aria-hidden />
          {CONFETTI.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
              animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: 1, rotate: p.rotate }}
              transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
              className="pointer-events-none absolute text-lg"
            >
              {p.emoji}
            </motion.span>
          ))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-black text-balance">Your pathway is ready! 🎉</p>
          {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-violet-100 bg-white/70 px-4 py-3 dark:border-violet-900 dark:bg-white/5">
        <ShareLink sessionId={state.sessionId} />
      </div>
    </motion.div>
  );
}

/** One placeholder outcome row — shared by the full pre-anchor skeleton and the real document's own outcomes section while `plan` is still in flight. */
function OutcomeSkeletonRow() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-3 border-emerald-100 bg-card px-4 py-3.5 dark:border-emerald-950">
      <Skeleton className="mt-0.5 size-6 shrink-0 rounded-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/** One placeholder step card — same sharing rationale as `OutcomeSkeletonRow`. */
function StepSkeletonCard({ border }: { border: string }) {
  return (
    <div className={cn('rounded-2xl border-3 bg-card px-4 py-3.5', border)}>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="mt-2.5 h-4 w-1/2" />
      <Skeleton className="mt-1.5 h-3.5 w-3/4" />
    </div>
  );
}

/**
 * Fills the gap between "submitted" and "the first real event arrived" so
 * the document reads as assembling itself rather than staying blank while
 * `ActivityTrail`'s progress strip is the only thing on screen. Shapes are
 * generic (a plausible outcome count, step count) rather than tied to the
 * eventual plan — nothing about the real topic is known yet at this point.
 */
function PathwayDocumentSkeleton() {
  return (
    <article className="mt-8 space-y-10" aria-hidden>
      <header>
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="mt-3 h-7 w-3/4" />
        <Skeleton className="mt-2.5 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
      </header>

      <section>
        <Skeleton className="mb-3 h-3 w-56" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <OutcomeSkeletonRow key={i} />
          ))}
        </div>
      </section>

      <section>
        <Skeleton className="mb-3 h-3 w-44" />
        <StepWaypointSkeletonList />
      </section>
    </article>
  );
}

/** The waypoint-threaded skeleton step list — shared by the full pre-anchor skeleton and the real document's own steps section while `plan.steps` is still in flight. */
function StepWaypointSkeletonList() {
  return (
    <div className="space-y-0">
      {STEP_SKELETON_WAYPOINTS.map(({ border, dot, line }, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden>
            <Skeleton className={cn('size-8 shrink-0 rounded-full', dot)} />
            {i < STEP_SKELETON_WAYPOINTS.length - 1 && (
              <span className={cn('my-1 w-0.5 flex-1 rounded-full', line)} />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <StepSkeletonCard border={border} />
          </div>
        </div>
      ))}
    </div>
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
            <span className="rounded-full border-2 border-violet-200 bg-white/80 px-3 py-1 font-mono text-xs font-bold text-violet-600 dark:border-violet-800 dark:bg-white/5 dark:text-violet-300">
              {standard.code}
            </span>
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

      <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-balance">{topic}</h2>

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
          <ChevronDown className="size-3.5 transition-transform group-data-panel-open/why:rotate-180" />
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
 *
 * Takes per-step values rather than the whole `PathwayState`: the stream
 * replaces that object on every event, so passing it would defeat the memo and
 * re-render every mounted widget on each one.
 */
const StepCard = memo(function StepCard({
  step,
  index,
  widget,
  widgetSeq,
  note,
  regenerating,
  regenerateError,
  onRegenerate,
  onEditField,
}: {
  step: PartialStep;
  index: number;
  widget: unknown;
  widgetSeq: number;
  note?: string;
  regenerating: boolean;
  regenerateError?: string;
  onRegenerate?: (index: number) => void;
  onEditField?: (index: number, field: 'title' | 'description', text: string) => void;
}) {
  const purpose = step?.purpose;
  const hasWidget = widget !== undefined;
  const pending = Boolean(step?.widgetKind) && !hasWidget;
  const meta = (purpose && PURPOSE_META[purpose]) ?? null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-3 bg-card shadow-sm transition-colors',
        meta ? meta.border : 'border-border',
      )}
    >
      <div className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:gap-4">
        <span className="shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 font-mono text-[10px] font-semibold tracking-widest uppercase',
              meta?.tint ?? 'bg-muted',
            )}
          >
            {meta ? <meta.Icon className={cn('size-3', meta.icon)} aria-hidden /> : null}
            {meta?.label ?? purpose}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          {onEditField ? (
            <EditableText
              value={step?.title ?? ''}
              onSave={(text) => onEditField(index, 'title', text)}
              className="text-sm font-medium"
            />
          ) : (
            <p className="text-sm font-medium">{step?.title}</p>
          )}
          {onEditField ? (
            <EditableText
              value={step?.description ?? ''}
              onSave={(text) => onEditField(index, 'description', text)}
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
        {onRegenerate && hasWidget && (
          <button
            type="button"
            onClick={() => onRegenerate(index)}
            disabled={regenerating}
            className="flex shrink-0 items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className={cn('size-3.5', regenerating && 'animate-spin')} aria-hidden />
            {regenerating ? 'Trying again…' : 'Try a different one'}
          </button>
        )}
      </div>

      {(hasWidget || pending || note) && (
        <div
          className={cn(
            'border-t-3 bg-muted/30 px-4 py-4 sm:pl-24',
            meta ? meta.border : 'border-border',
          )}
        >

          {hasWidget ? (
            <WidgetRenderer key={widgetSeq} spec={widget} />
          ) : pending ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <motion.span
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                className={cn('flex size-10 items-center justify-center rounded-full', meta?.tint ?? 'bg-muted')}
                aria-hidden
              >
                {meta ? <meta.Icon className={cn('size-4.5', meta.icon)} /> : <Sparkles className="size-4.5" />}
              </motion.span>
              <p className={cn('text-sm font-semibold', meta?.icon ?? 'text-muted-foreground')}>
                Building {(step?.widgetKind && WIDGET_KIND_LABEL[step.widgetKind]) ?? 'the interaction'}…
              </p>
              <Skeleton className={cn('h-2.5 w-32 rounded-full', meta?.tint ?? 'bg-muted')} />
            </div>
          ) : (
            <Alert variant="warning">
              <AlertDescription>{note}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
});

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
