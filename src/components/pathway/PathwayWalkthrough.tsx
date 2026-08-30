'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';

import { ActivityFrame } from '@/components/pathway/ActivityFrame';
import { WidgetRenderer } from '@/components/widgets/registry';
import { WidgetTelemetryProvider } from '@/components/widgets/telemetry-context';
import { useTelemetry, type RemediationPayload } from '@/hooks/useTelemetry';
import type { PathwayPlan } from '@/lib/pathway/schema';

/**
 * The step-by-step student experience — extracted from `/learn` so a fresh
 * live generation and a persisted, shared pathway (`/learn/[sessionId]`) can
 * render the identical walkthrough instead of two copies of this UI. Owns its
 * own progress (`currentStep`, `stars`) rather than taking it from the
 * caller: mount this once per session (key on `round` for a fresh build, or
 * on `sessionId` for a persisted one) and it resets itself.
 */

export type WalkthroughSession = {
  sessionId: string | null;
  topic: string;
  bigIdea: string;
  standardCode: string | null;
  steps: PathwayPlan['steps'];
  /** stepIndex -> widget. A missing key means that step hasn't finished building. */
  stepWidgets: Record<number, unknown>;
  stepWidgetNotes: Record<number, string>;
};

/**
 * Widgets that own their own "Continue →" / "Got it →" button and wire it to
 * `onComplete` directly. For these the walkthrough passes `advanceStep` as
 * `onComplete` so their internal button advances the pathway — no external
 * button is shown.
 */
const HAS_OWN_CTA = new Set([
  'markdown-card',
  'flashcard',
  'step-reveal',
  'narrated-card',
  'swiper-flashcard',
  'drag-sort',
  'drag-categorize',
  'timeline-builder',
]);

/**
 * Widgets with no `onComplete` at all — no unambiguous done moment exists.
 * The external continue button is shown and always enabled.
 */
const ALWAYS_ENABLED = new Set([
  'fraction-area-model',
  'draft-meter',
  'crossword',
]);

function widgetKindOf(widget: unknown): string | null {
  return widget && typeof widget === 'object' && 'kind' in widget && typeof widget.kind === 'string'
    ? widget.kind
    : null;
}

/** An injected remediation widget carries its own "Let's revisit: …" title. */
function widgetTitleOf(widget: unknown): string | null {
  return widget && typeof widget === 'object' && 'title' in widget && typeof widget.title === 'string'
    ? widget.title
    : null;
}

function stepKey(sessionId: string) { return `pathway:step:${sessionId}`; }
function doneKey(sessionId: string) { return `pathway:done:${sessionId}`; }

export function savedProgress(sessionId: string): { step: number; stars: number; done: boolean } | null {
  try {
    const raw = localStorage.getItem(doneKey(sessionId));
    if (raw) {
      const parsed = JSON.parse(raw) as { stars: number };
      return { step: Infinity, stars: parsed.stars ?? 0, done: true };
    }
    const step = Number(localStorage.getItem(stepKey(sessionId)) ?? 'NaN');
    if (!Number.isNaN(step) && step > 0) return { step, stars: step, done: false };
  } catch { /* localStorage unavailable */ }
  return null;
}

export function PathwayWalkthrough({
  session,
  studentId,
  onRestart,
}: {
  session: WalkthroughSession;
  studentId: string | null;
  /** "Another one!" / "New topic" actions — omitted on a read-only shared view. */
  onRestart?: { another: () => void; newTopic: () => void; busy?: boolean };
}) {
  const [currentStep, setCurrentStep] = useState(() => {
    if (!session.sessionId) return 0;
    try {
      const step = Number(localStorage.getItem(stepKey(session.sessionId)) ?? 'NaN');
      return Number.isNaN(step) ? 0 : step;
    } catch { return 0; }
  });
  const [stars, setStars] = useState(() => currentStep);
  // null = show the live current step; a number = reviewing that completed step
  const [viewingStep, setViewingStep] = useState<number | null>(null);

  // Extra widgets injected at runtime by the server after detecting a struggle.
  // Keys are absolute step indices. The effective widget map merges these on top
  // of session.stepWidgets so injected slots take precedence.
  const [injectedWidgets, setInjectedWidgets] = useState<Record<number, unknown>>({});
  const [lastInjectedAt, setLastInjectedAt] = useState<number | null>(null);

  // Ref so onRemediation can read the latest currentStep without being recreated.
  const currentStepRef = useRef(currentStep);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

  const onRemediation = useCallback((payload: RemediationPayload) => {
    // Clamp to after the student's current position — the server already does
    // this, but the student may have advanced again in the window between flush
    // and response.
    const insertAt = Math.max(payload.insertAt, currentStepRef.current + 1);
    setInjectedWidgets((prev) => {
      const shifted: Record<number, unknown> = {};
      for (const [key, val] of Object.entries(prev)) {
        const idx = Number(key);
        shifted[idx >= insertAt ? idx + 1 : idx] = val;
      }
      shifted[insertAt] = payload.widget;
      return shifted;
    });
    setLastInjectedAt(insertAt);
  }, []);

  const telemetry = useTelemetry(session.sessionId, studentId, onRemediation, currentStep);

  // The effective widget map: session widgets shifted by any injections, then
  // injected widgets overlaid on top. We recompute lazily on render rather
  // than in an effect — the state change from onRemediation already triggers a
  // re-render, so we just derive from current state.
  const effectiveWidgets: Record<number, unknown> = (() => {
    if (Object.keys(injectedWidgets).length === 0) return session.stepWidgets;
    // Shift the session's original widgets past any injected indices.
    const result: Record<number, unknown> = {};
    for (const [key, val] of Object.entries(session.stepWidgets)) {
      let idx = Number(key);
      for (const injectedIdx of Object.keys(injectedWidgets).map(Number).sort((a, b) => a - b)) {
        if (injectedIdx <= idx) idx += 1;
      }
      result[idx] = val;
    }
    // Overlay injected widgets.
    Object.assign(result, injectedWidgets);
    return result;
  })();

  // Total step count = original steps + one per injected widget.
  const totalSteps = session.steps.length + Object.keys(injectedWidgets).length;

  // Absolute-index helpers over the injected slots — the same mapping the
  // progress bar does inline, shared with the activity frame's header.
  const injectedIndexList = Object.keys(injectedWidgets).map(Number).sort((a, b) => a - b);
  const isInjectedStep = (index: number) => injectedIndexList.includes(index);
  const originalStepIndex = (index: number) =>
    index - injectedIndexList.filter((i) => i < index).length;

  // Same ref idiom as currentStepRef: advanceStep runs from event handlers,
  // so reading the latest injected slots through a ref keeps its identity
  // stable without depending on a per-render derived array.
  const injectedIndexRef = useRef(injectedIndexList);
  useEffect(() => { injectedIndexRef.current = injectedIndexList; });

  const advanceStep = useCallback(() => {
    setViewingStep(null);
    // Injected remediation steps cost no star (design 1g) — help, not a
    // penalty, and the star total still matches the pathway's own length.
    if (!injectedIndexRef.current.includes(currentStepRef.current)) {
      setStars((n) => n + 1);
    }
    telemetry.flush();
    setCurrentStep((n) => {
      const next = n + 1;
      if (session.sessionId) {
        try { localStorage.setItem(stepKey(session.sessionId), String(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [telemetry, session.sessionId]);

  const finished = totalSteps > 0 && currentStep >= totalSteps;

  // Which step is actually rendered — review overrides current.
  const displayStep = viewingStep ?? currentStep;
  const isReviewing = viewingStep !== null;
  const currentWidget = effectiveWidgets[displayStep];
  const currentKind = widgetKindOf(currentWidget);

  // True once the current widget signals it's done. Resets when the displayed
  // step changes — adjusted during render (same idiom `ActivityTrail` uses
  // for its own prev-status comparison) rather than in an effect, so the
  // reset lands in the same commit as the step change instead of one render
  // later.
  const [widgetDone, setWidgetDone] = useState(false);
  const [widgetDoneForStep, setWidgetDoneForStep] = useState(displayStep);
  if (displayStep !== widgetDoneForStep) {
    setWidgetDoneForStep(displayStep);
    setWidgetDone(false);
  }
  const markWidgetDone = useCallback(() => setWidgetDone(true), []);

  // Fires once per mount, the student's half of "close the loop back to the
  // teacher" — the ref survives re-renders while `finished` stays true, so a
  // parent re-render (or React Strict Mode's double-invoke) can't double-count.
  const reportedCompletion = useRef(false);
  useEffect(() => {
    if (!finished || !session.sessionId || reportedCompletion.current) return;
    reportedCompletion.current = true;
    // Persist completion to localStorage so the student homepage can show results.
    try { localStorage.setItem(doneKey(session.sessionId), JSON.stringify({ stars })); } catch { /* ignore */ }
    void fetch(`/api/pathway/session/${session.sessionId}/complete`, { method: 'POST' }).catch(() => {
      // Best-effort — a student who finished should never see this fail.
    });
  }, [finished, session.sessionId, stars]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Design 1g header: three things only — a 30px circular exit, one
          continuous 14px progress bar, and the star count. State, topic, and
          the standard live in the quiet line beneath. */}
      <div className="flex w-full items-center gap-3">
        <Link
          href="/learn"
          aria-label="Exit pathway"
          className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-foreground bg-card text-sm font-bold text-foreground transition-colors hover:bg-sunk"
        >
          ✕
        </Link>
        {totalSteps > 1 ? (
          <div
            className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-full border border-border bg-track"
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-label={`Activity ${Math.min(currentStep + 1, totalSteps)} of ${totalSteps}`}
          >
            <motion.span
              className="absolute inset-y-0 left-0 border-r border-foreground bg-brand-fill"
              initial={false}
              animate={{ width: `${(Math.min(currentStep, totalSteps) / totalSteps) * 100}%` }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            />
            {injectedIndexList.map((index) => (
              <span
                key={`notch-${index}`}
                aria-hidden="true"
                className={`absolute inset-y-0 w-1 bg-brand-press ${index === lastInjectedAt ? 'animate-pulse motion-reduce:animate-none' : ''}`}
                style={{ left: `${(index / totalSteps) * 100}%` }}
              />
            ))}
            {/* Invisible per-step buttons keep tap-to-review under the
                continuous bar. */}
            <span className="absolute inset-0 flex">
              {Array.from({ length: totalSteps }, (_, index) => {
                const isDone = index < currentStep;
                const isCurrent = index === currentStep;
                const isViewing = index === viewingStep;
                const stepTitle = isInjectedStep(index)
                  ? 'Extra practice'
                  : (session.steps[originalStepIndex(index)]?.title ?? `Activity ${index + 1}`);
                return (
                  <button
                    key={`step-${index}-of-${totalSteps}`}
                    type="button"
                    title={isDone || isCurrent ? stepTitle : undefined}
                    aria-label={isDone ? `Review: ${stepTitle}` : stepTitle}
                    disabled={finished || (!isDone && !isCurrent)}
                    onClick={
                      isDone ? () => setViewingStep(isViewing ? null : index)
                      : isCurrent ? () => setViewingStep(null)
                      : undefined
                    }
                    className={`h-full min-w-0 flex-1 ${!finished && (isDone || isCurrent) ? 'cursor-pointer' : 'cursor-default'} ${isViewing ? 'bg-verified/30' : 'bg-transparent'}`}
                  />
                );
              })}
            </span>
          </div>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )}
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-foreground bg-card py-1 pr-3.5 pl-1.5">
          <motion.span
            key={stars}
            initial={{ scale: 1.6, rotate: -16 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            className="flex size-6 items-center justify-center rounded-full border border-foreground bg-brand-fill text-sm text-foreground motion-reduce:transition-none"
            aria-hidden="true"
          >
            ★
          </motion.span>
          <span className="font-heading text-lg font-black tabular-nums">{stars}</span>
        </span>
      </div>

      {/* The quiet line: state on the left; topic, standard, and the break
          link on the right. */}
      <div className="-mt-2 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-xs text-muted-foreground">
          {finished
            ? 'All done'
            : isReviewing
              ? 'Looking back at a finished activity'
              : isInjectedStep(currentStep)
                ? 'Just added · extra practice'
                : `Activity ${Math.min(currentStep + 1, totalSteps)} of ${totalSteps}`}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="max-w-56 truncate text-xs text-muted-foreground">{session.topic}</span>
          {session.standardCode ? (
            <span className="rounded-full border border-verified-edge bg-verified-tint px-2 py-px font-mono text-[10px] font-semibold text-verified">
              ✓ {session.standardCode}
            </span>
          ) : (
            <span className="rounded-full border border-warning-edge bg-warning-tint px-2 py-px font-mono text-[10px] font-semibold text-warning">
              Exploring
            </span>
          )}
          <Link
            href="/games"
            className="text-xs font-bold text-ink-2 underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Take a break
          </Link>
        </span>
      </div>

      {!finished && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="flex w-full flex-col items-center gap-5"
        >
          <p className="text-center text-xl font-black text-balance">{session.bigIdea}</p>

          {isReviewing && (
            <button
              type="button"
              onClick={() => setViewingStep(null)}
              className="self-start rounded-xl border border-border bg-card px-3 py-1 text-sm font-bold text-ink-2 hover:border-foreground hover:text-foreground"
            >
              ← Back to current
            </button>
          )}

          {currentWidget ? (
            <div className="w-full">
              <ActivityFrame
                kind={currentKind ?? 'activity'}
                title={
                  isInjectedStep(displayStep)
                    ? (widgetTitleOf(currentWidget) ?? 'Extra practice')
                    : (session.steps[originalStepIndex(displayStep)]?.title ?? `Activity ${displayStep + 1}`)
                }
                state={
                  isReviewing ? (
                    <span className="shrink-0 rounded-full border border-verified-edge bg-verified-tint px-2 py-px font-mono text-[10px] uppercase tracking-[0.12em] text-verified">
                      ✓ done
                    </span>
                  ) : isInjectedStep(displayStep) ? (
                    <span className="shrink-0 rounded-full border border-foreground bg-brand-fill px-2 py-px font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">
                      just added
                    </span>
                  ) : undefined
                }
              >
                <WidgetTelemetryProvider telemetry={telemetry} standardCode={session.standardCode} stepIndex={currentStep}>
                  <WidgetRenderer
                    key={displayStep}
                    spec={currentWidget}
                    onComplete={
                      isReviewing ? undefined
                      : HAS_OWN_CTA.has(currentKind ?? '') ? advanceStep
                      : markWidgetDone
                    }
                  />
                </WidgetTelemetryProvider>
              </ActivityFrame>

              {!isReviewing && isInjectedStep(displayStep) && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  This one doesn&rsquo;t cost you a star. Your pathway is waiting
                  exactly where you left it.
                </p>
              )}

              {/* External button for widgets that fire onComplete silently (no internal CTA),
                  and for the three widgets that never fire onComplete at all. The reason a
                  button is live or waiting is stated, not implied. */}
              {!isReviewing && !HAS_OWN_CTA.has(currentKind ?? '') && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={advanceStep}
                    disabled={!widgetDone && !ALWAYS_ENABLED.has(currentKind ?? '')}
                    className="w-full rounded-2xl border border-foreground bg-brand-fill py-3 font-heading font-black text-foreground shadow-[0_5px_0_0_var(--brand-press)] transition-all hover:bg-brand-fill-hover active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--brand-press)] disabled:opacity-40 disabled:shadow-[0_5px_0_0_var(--brand-press)] disabled:active:translate-y-0 motion-reduce:transition-none"
                  >
                    {currentStep + 1 === totalSteps ? "I'm done!" : 'Next activity →'}
                  </button>
                  <p className="mt-1.5 text-center text-xs text-muted-foreground">
                    {ALWAYS_ENABLED.has(currentKind ?? '')
                      ? 'No finish line on this one — move on whenever you want.'
                      : widgetDone
                        ? 'Nice — ready when you are.'
                        : 'Finish the activity to keep going.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="w-full rounded-2xl border border-dashed border-border bg-card p-4 text-center font-bold text-muted-foreground">
              Building this activity…
            </p>
          )}
        </motion.div>
      )}

      {finished && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="flex w-full flex-col items-center gap-5"
        >
          <p
            className="flex size-14 items-center justify-center rounded-full border border-foreground bg-brand-fill text-2xl text-foreground"
            aria-hidden="true"
          >
            ★
          </p>
          <p className="text-center font-heading text-xl font-black text-balance">
            All done — {totalSteps} activities, {stars} stars!
          </p>

          {onRestart && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onRestart.another}
                disabled={onRestart.busy}
                className="rounded-2xl border border-foreground bg-brand-fill px-7 py-3 font-heading font-black text-foreground shadow-[0_5px_0_0_var(--brand-press)] transition-all hover:bg-brand-fill-hover active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--brand-press)] disabled:opacity-50 motion-reduce:transition-none"
              >
                {onRestart.busy ? 'Building…' : 'Another one!'}
              </button>
              <button
                type="button"
                onClick={onRestart.newTopic}
                className="rounded-2xl border border-border bg-card px-5 py-3 font-heading font-black text-ink-2 hover:border-foreground hover:text-foreground"
              >
                New topic
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
