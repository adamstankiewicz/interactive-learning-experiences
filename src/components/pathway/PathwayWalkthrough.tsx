'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

import { WidgetRenderer } from '@/components/widgets/registry';
import { WidgetTelemetryProvider } from '@/components/widgets/telemetry-context';
import { useTelemetry } from '@/hooks/useTelemetry';
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
 * Most widgets report completion through `onComplete` — there is a moment the
 * student is unambiguously "done" (last flashcard, all events correct, etc.).
 * Fraction Area Model, Draft Meter, and Crossword have no such moment: an area
 * model is checked as many times as a student likes, a meter just keeps scoring
 * as they type, and a crossword can sit partially solved. Those three need an
 * explicit "I'm done" action instead of an automatic one.
 */
const SELF_ADVANCING_KINDS = new Set([
  'swiper-flashcard',
  'drag-sort',
  'drag-categorize',
  'markdown-card',
  'flashcard',
  'step-reveal',
  'narrated-card',
  'timeline-builder',
]);

function widgetKindOf(widget: unknown): string | null {
  return widget && typeof widget === 'object' && 'kind' in widget && typeof widget.kind === 'string'
    ? widget.kind
    : null;
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
  const [currentStep, setCurrentStep] = useState(0);
  const [stars, setStars] = useState(0);
  const telemetry = useTelemetry(session.sessionId, studentId);

  const advanceStep = useCallback(() => {
    setStars((n) => n + 1);
    telemetry.flush();
    setCurrentStep((n) => n + 1);
  }, [telemetry]);

  const finished = session.steps.length > 0 && currentStep >= session.steps.length;
  const currentWidget = session.stepWidgets[currentStep];
  const currentKind = widgetKindOf(currentWidget);

  // Fires once per mount, the student's half of "close the loop back to the
  // teacher" — the ref survives re-renders while `finished` stays true, so a
  // parent re-render (or React Strict Mode's double-invoke) can't double-count.
  const reportedCompletion = useRef(false);
  useEffect(() => {
    if (!finished || !session.sessionId || reportedCompletion.current) return;
    reportedCompletion.current = true;
    void fetch(`/api/pathway/session/${session.sessionId}/complete`, { method: 'POST' }).catch(() => {
      // Best-effort — a student who finished should never see this fail.
    });
  }, [finished, session.sessionId]);

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

          {session.steps.length > 1 && (
            <div className="flex w-full items-center gap-1.5" aria-hidden="true">
              {session.steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    index < currentStep ? 'bg-emerald-400' : index === currentStep ? 'bg-violet-400' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}

          {currentWidget ? (
            <div className="w-full rounded-3xl border-4 border-violet-200 bg-white/80 p-4">
              <WidgetTelemetryProvider telemetry={telemetry} standardCode={session.standardCode}>
                <WidgetRenderer
                  key={currentStep}
                  spec={currentWidget}
                  onComplete={SELF_ADVANCING_KINDS.has(currentKind ?? '') ? advanceStep : undefined}
                />
              </WidgetTelemetryProvider>

              {/* Fraction area model, Draft Meter, and Crossword have no "done"
                  moment of their own, so the student says when they're ready to move on. */}
              {currentKind && !SELF_ADVANCING_KINDS.has(currentKind) && (
                <button
                  type="button"
                  onClick={advanceStep}
                  className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 font-black text-white shadow-[0_5px_0_0_#047857] active:translate-y-1 active:shadow-[0_2px_0_0_#047857]"
                >
                  {currentStep + 1 === session.steps.length ? "I'm done! 🎉" : 'Next activity →'}
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
            All done — {session.steps.length} activities, {stars} stars!
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
