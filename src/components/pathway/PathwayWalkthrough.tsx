'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

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
        <span className="rounded-full border-2 border-violet-200 bg-white/80 px-3 py-1 text-xs font-bold text-violet-600">
          {session.standardCode ?? '✨ exploring'}
        </span>
        <span className="flex items-center gap-1 rounded-full border-2 border-amber-200 bg-white/80 px-4 py-1">
          <motion.span
            key={stars}
            initial={{ scale: 1.8, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            className="text-xl"
          >
            ⭐
          </motion.span>
          <span className="text-lg font-black text-amber-600">{stars}</span>
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
                        'relative w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                        isViewing
                          ? 'h-3 bg-emerald-400/70 shadow-[0_0_0_3px_rgba(52,211,153,0.6)] cursor-pointer'
                          : isCurrent
                            ? isReviewing
                              ? 'h-3 bg-violet-400 cursor-pointer'
                              : 'h-3 bg-violet-400 shadow-[0_0_0_3px_rgba(139,92,246,0.5)] cursor-pointer'
                            : isDone
                              ? 'h-3 bg-emerald-400/70 cursor-pointer hover:bg-emerald-400'
                              : 'h-3 bg-white/25 cursor-default',
                        '',
                        'transition-[height,background-color] duration-300',
                      ].join(' ')}
                    >
                      {/* Completion sweep — fills left-to-right when a step is done */}
                      {isDone && !isViewing && (
                        <motion.span
                          className="absolute inset-0 rounded-full bg-emerald-400/70 origin-left"
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
                          <span className={`h-2 w-2 rounded-full ${isViewing ? 'bg-emerald-500' : 'bg-violet-500'}`} />
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
              className="self-start rounded-xl border-2 border-violet-200 bg-white/80 px-3 py-1 text-sm font-bold text-violet-600 hover:bg-violet-50"
            >
              ← Back to current
            </button>
          )}

          {currentWidget ? (
            <div className={`w-full rounded-3xl border-4 bg-white/80 p-4 ${isReviewing ? 'border-emerald-200 opacity-90' : 'border-violet-200'}`}>
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

              {/* External button for widgets that fire onComplete silently (no internal CTA),
                  and for the three widgets that never fire onComplete at all. */}
              {!isReviewing && !HAS_OWN_CTA.has(currentKind ?? '') && (
                <button
                  type="button"
                  onClick={advanceStep}
                  disabled={!widgetDone && !ALWAYS_ENABLED.has(currentKind ?? '')}
                  className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 font-black text-white shadow-[0_5px_0_0_#047857] transition-opacity active:translate-y-1 active:shadow-[0_2px_0_0_#047857] disabled:opacity-30 disabled:shadow-[0_5px_0_0_#047857] disabled:active:translate-y-0"
                >
                  {currentStep + 1 === totalSteps ? "I'm done! 🎉" : 'Next activity →'}
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border-4 border-violet-200 bg-white/80 p-4 text-center font-bold text-violet-500">
              ✨ Building this activity…
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
          <p className="text-center text-4xl">🎉</p>
          <p className="text-center text-xl font-black text-balance">
            All done — {totalSteps} activities, {stars} stars!
          </p>

          {onRestart && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onRestart.another}
                disabled={onRestart.busy}
                className="rounded-2xl bg-amber-400 px-7 py-3 font-black text-amber-950 shadow-[0_5px_0_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_0_#b45309] disabled:opacity-50"
              >
                {onRestart.busy ? 'Building…' : 'Another one! 🚀'}
              </button>
              <button
                type="button"
                onClick={onRestart.newTopic}
                className="rounded-2xl border-4 border-violet-200 bg-white px-5 py-3 font-black text-violet-600"
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
