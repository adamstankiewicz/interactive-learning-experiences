'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

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

  const advanceStep = useCallback(() => {
    setViewingStep(null);
    setStars((n) => n + 1);
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
      <div className="flex w-full items-center justify-between">
        {session.standardCode ? (
          <span className="rounded-full border border-verified-edge bg-verified-tint px-3 py-1 font-mono text-xs font-semibold text-verified">
            ✓ {session.standardCode}
          </span>
        ) : (
          <span className="rounded-full border border-warning-edge bg-warning-tint px-3 py-1 font-mono text-xs font-semibold text-warning">
            exploring
          </span>
        )}
        <div className="flex items-center gap-2">
          <a
            href="/games"
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-ink-2 transition-colors hover:border-foreground hover:text-foreground"
          >
            Take a break
          </a>
          <span className="flex items-center gap-1.5 rounded-full border border-foreground bg-card py-1 pr-3.5 pl-1.5">
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
      </div>

      {!finished && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="flex w-full flex-col items-center gap-5"
        >
          <p className="text-center text-xl font-black text-balance">{session.bigIdea}</p>

          {totalSteps > 1 && (
            <div className="flex w-full items-center gap-1.5 py-1" role="progressbar" aria-valuenow={currentStep} aria-valuemax={totalSteps}>
              <AnimatePresence initial={false}>
                {Array.from({ length: totalSteps }, (_, index) => {
                  const isDone = index < currentStep;
                  const isCurrent = index === currentStep;
                  const isViewing = index === viewingStep;
                  const isNewlyInjected = index === lastInjectedAt;
                  // Map the absolute index back to an original step title, accounting
                  // for injected slots shifting the originals forward.
                  const injectedIndices = Object.keys(injectedWidgets).map(Number).sort((a, b) => a - b);
                  const originalIndex = index - injectedIndices.filter((i) => i < index).length;
                  const isInjected = injectedIndices.includes(index);
                  const stepTitle = isInjected
                    ? 'Extra practice'
                    : (session.steps[originalIndex]?.title ?? `Activity ${index + 1}`);
                  const tooltipText = (isDone || isCurrent) ? stepTitle : null;
                  return (
                    <div key={`step-${index}-of-${totalSteps}`} className="group relative min-w-0 flex-1 flex flex-col items-center">
                      {tooltipText && (
                        <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900/90 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-10">
                          {tooltipText}
                        </div>
                      )}
                    <motion.button
                      type="button"
                      aria-label={isDone ? `Review activity ${index + 1}` : `Activity ${index + 1}`}
                      disabled={!isDone && !isCurrent}
                      onClick={
                        isDone ? () => setViewingStep(isViewing ? null : index)
                        : isCurrent ? () => setViewingStep(null)
                        : undefined
                      }
                      // Entry: new segments pop in from scale 0
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{
                        scaleX: 1,
                        opacity: 1,
                        // Newly injected segment gets an attention pulse
                        scale: isNewlyInjected ? [1, 1.15, 0.95, 1.05, 1] : 1,
                      }}
                      transition={isNewlyInjected
                        ? { duration: 0.5, ease: 'easeOut', scale: { duration: 0.6, delay: 0.15 } }
                        : { type: 'spring', stiffness: 400, damping: 30 }
                      }
                      className={[
                        'relative w-full rounded-full',
                        isViewing
                          ? 'h-3 bg-verified/70 shadow-[0_0_0_2px_var(--verified-edge)] cursor-pointer'
                          : isCurrent
                            ? isReviewing
                              ? 'h-3 border border-foreground bg-brand-fill cursor-pointer'
                              : 'h-3 border border-foreground bg-brand-fill shadow-[0_0_0_2px_var(--brand-press)] cursor-pointer'
                            : isDone
                              ? 'h-3 bg-verified/70 cursor-pointer hover:bg-verified'
                              : 'h-3 bg-sunk cursor-default',
                        isInjected && !isDone ? 'outline-2 outline-offset-1 outline-brand-press' : '',
                        'transition-[height,background-color] duration-300',
                      ].join(' ')}
                    >
                      {/* Completion sweep — fills left-to-right when a step is done */}
                      {isDone && !isViewing && (
                        <motion.span
                          className="absolute inset-0 rounded-full bg-verified/70 origin-left"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                        />
                      )}
                      {/* Dot on whichever step is currently displayed */}
                      {index === displayStep && (
                        <motion.span
                          key={displayStep}
                          className="absolute inset-0 flex items-center justify-center"
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        >
                          <span className={`h-2 w-2 rounded-full ${isViewing ? 'bg-verified' : 'bg-foreground'}`} />
                        </motion.span>
                      )}
                    </motion.button>
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

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
                    ? 'Extra practice'
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
