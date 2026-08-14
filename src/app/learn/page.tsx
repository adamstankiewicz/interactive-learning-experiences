'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { WidgetRenderer } from '@/components/widgets/registry';
import { WidgetTelemetryProvider } from '@/components/widgets/telemetry-context';
import { useTelemetry } from '@/hooks/useTelemetry';
import { useVoiceIntake } from '@/hooks/useVoiceIntake';
import type { PathwayEvent } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';

/**
 * The student-facing counterpart to the pathway builder on `/`.
 *
 * Same pipeline, same graph grounding, different audience: the builder is a
 * planning artifact for a teacher, this is a thing a nine-year-old touches.
 * Styling is deliberately local rather than global so the design system on `/`
 * is untouched.
 *
 * A pathway is several steps now, not one widget, so a session is a
 * walkthrough: the student clears each step's activity before the next one
 * appears, and only once every step is done does the round finish.
 */

type Session = {
  sessionId: string | null;
  topic: string;
  bigIdea: string;
  standardCode: string | null;
  steps: PathwayPlan['steps'];
  /** stepIndex -> widget. A missing key means that step hasn't finished building. */
  stepWidgets: Record<number, unknown>;
  stepWidgetNotes: Record<number, string>;
  currentStep: number;
};

const BUILDING_LINES = [
  'Finding the right lesson…',
  'Asking the knowledge graph…',
  'Building your activities…',
];

/**
 * Some widgets (swiper-flashcard, drag-sort, drag-categorize) report their own
 * completion through `onComplete` — there is a moment the student is
 * unambiguously "done". Fraction area model, Draft Meter, and Crossword have
 * no such moment: an area model is checked as many times as a student likes,
 * a meter just keeps scoring as they type, and a crossword can sit
 * partially solved. Those three need an explicit "I'm done" action instead
 * of an automatic one.
 */
const SELF_ADVANCING_KINDS = new Set(['swiper-flashcard', 'drag-sort', 'drag-categorize']);

function widgetKindOf(widget: unknown): string | null {
  return widget && typeof widget === 'object' && 'kind' in widget && typeof widget.kind === 'string'
    ? widget.kind
    : null;
}

export default function LearnPage() {
  // Lazy initializer: reads the cached id (if any) exactly once, at mount,
  // rather than a synchronous setState from an effect. `typeof window` guards
  // the server-rendered pass this 'use client' page still gets before hydration.
  const [studentId, setStudentId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('studentId'),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [stars, setStars] = useState(0);
  const [round, setRound] = useState(0);
  const [line, setLine] = useState(0);

  const telemetry = useTelemetry(session?.sessionId ?? null, studentId);

  useEffect(() => {
    if (studentId) return;
    void fetch('/api/student', { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { studentId?: string } | null) => {
        if (!data?.studentId) return;
        localStorage.setItem('studentId', data.studentId);
        setStudentId(data.studentId);
      })
      .catch(() => {});
  }, [studentId]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setLine((n) => (n + 1) % BUILDING_LINES.length), 2500);
    return () => clearInterval(timer);
  }, [busy]);

  const build = useCallback(
    async (topic: string) => {
      if (topic.trim().length < 3) return;
      setBusy(true);
      setError(null);
      setLine(0);

      try {
        const response = await fetch('/api/pathway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, studentId }),
        });
        if (!response.body) throw new Error('No response from the server.');

        const next: Session = {
          sessionId: null,
          topic,
          bigIdea: '',
          standardCode: null,
          steps: [],
          stepWidgets: {},
          stepWidgetNotes: {},
          currentStep: 0,
        };

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        let failure: string | null = null;

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const raw of lines) {
            if (!raw.trim()) continue;
            const event = JSON.parse(raw) as PathwayEvent;

            if (event.type === 'anchor') next.standardCode = event.anchor.standard.statementCode;
            if (event.type === 'plan') {
              next.bigIdea = event.plan.bigIdea;
              next.steps = event.plan.steps;
            }
            if (event.type === 'step-widget') {
              next.stepWidgets[event.stepIndex] = event.widget;
              if (event.note) next.stepWidgetNotes[event.stepIndex] = event.note;
            }
            if (event.type === 'session') next.sessionId = event.sessionId;
            if (event.type === 'error') failure = event.message;
          }
        }

        if (failure) throw new Error(failure);

        setSession(next);
        setRound((n) => n + 1);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [studentId],
  );

  const voice = useVoiceIntake(build);

  const advanceStep = useCallback(() => {
    setStars((n) => n + 1);
    telemetry.flush();
    setSession((current) => (current ? { ...current, currentStep: current.currentStep + 1 } : current));
  }, [telemetry]);

  const finished = session
    ? session.steps.length > 0 && session.currentStep >= session.steps.length
    : false;
  const currentWidget = session ? session.stepWidgets[session.currentStep] : undefined;
  const currentKind = widgetKindOf(currentWidget);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-violet-100 via-pink-100 to-amber-100 text-slate-900">
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center gap-6 px-5 py-10">
        {session && (
          <div className="flex w-full items-center justify-between">
            <span className="rounded-full border-2 border-violet-200 bg-white/80 px-3 py-1 text-xs font-bold text-violet-600">
              {session.standardCode ?? 'no standard'}
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
        )}

        {!session && (
          <AnimatePresence mode="wait">
            <motion.h1
              key="hero"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="mt-12 text-center text-5xl font-black tracking-tight text-balance"
            >
              What do you want to{' '}
              <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
                learn?
              </span>
            </motion.h1>
          </AnimatePresence>
        )}

        {!session && (
          <>
            <motion.button
              type="button"
              disabled={!voice.supported || busy}
              onClick={voice.listening ? voice.stop : voice.start}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              animate={voice.listening ? { scale: [1, 1.07, 1] } : { scale: 1 }}
              transition={
                voice.listening
                  ? { repeat: Infinity, duration: 1.6 }
                  : { type: 'spring', stiffness: 300, damping: 14 }
              }
              className="flex size-36 flex-col items-center justify-center gap-1 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-[0_8px_0_0_#6d28d9] transition-transform active:translate-y-1 active:shadow-[0_3px_0_0_#6d28d9] disabled:opacity-50"
            >
              <span className="text-4xl">{busy ? '✨' : voice.listening ? '👂' : '🎤'}</span>
              <span className="text-sm font-black">
                {busy ? 'Building' : voice.listening ? 'Listening' : 'Tap & talk'}
              </span>
            </motion.button>

            <div className="min-h-8 text-center">
              {busy && <p className="text-lg font-bold text-violet-600">{BUILDING_LINES[line]}</p>}
              {!busy && voice.interim && (
                <p className="text-lg font-bold text-violet-500 italic">“{voice.interim}”</p>
              )}
              {!busy && (error || voice.error) && (
                <p className="text-base font-bold text-rose-500">🙃 {voice.error ?? error}</p>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void build(typed);
              }}
              className="flex w-full gap-2"
            >
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={voice.supported ? '…or type it here' : 'Type what you want to learn'}
                maxLength={200}
                className="min-w-0 flex-1 rounded-2xl border-4 border-violet-200 bg-white px-5 py-3 font-semibold outline-none placeholder:text-violet-300 focus:border-violet-400"
              />
              <button
                type="submit"
                disabled={busy || typed.trim().length < 3}
                className="shrink-0 rounded-2xl bg-emerald-500 px-6 font-black text-white shadow-[0_5px_0_0_#047857] active:translate-y-1 active:shadow-[0_2px_0_0_#047857] disabled:opacity-40"
              >
                Go!
              </button>
            </form>
          </>
        )}

        {session && !finished && (
          <motion.div
            key={round}
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
                      index < session.currentStep
                        ? 'bg-emerald-400'
                        : index === session.currentStep
                          ? 'bg-violet-400'
                          : 'bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}

            {currentWidget ? (
              <div className="w-full rounded-3xl border-4 border-violet-200 bg-white/80 p-4">
                <WidgetTelemetryProvider telemetry={telemetry} standardCode={session.standardCode}>
                  <WidgetRenderer
                    key={session.currentStep}
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
                    {session.currentStep + 1 === session.steps.length ? "I'm done! 🎉" : 'Next activity →'}
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

        {session && finished && (
          <motion.div
            key={`${round}-done`}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="flex w-full flex-col items-center gap-5"
          >
            <p className="text-center text-4xl">🎉</p>
            <p className="text-center text-xl font-black text-balance">
              All done — {session.steps.length} activities, {stars} stars!
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void build(session.topic)}
                disabled={busy}
                className="rounded-2xl bg-amber-400 px-7 py-3 font-black text-amber-950 shadow-[0_5px_0_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_0_#b45309] disabled:opacity-50"
              >
                {busy ? 'Building…' : 'Another one! 🚀'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSession(null);
                  setTyped('');
                }}
                className="rounded-2xl border-4 border-violet-200 bg-white px-5 py-3 font-black text-violet-600"
              >
                New topic
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
