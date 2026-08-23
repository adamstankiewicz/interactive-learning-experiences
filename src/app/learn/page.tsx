'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { PathwayWalkthrough, type WalkthroughSession } from '@/components/pathway/PathwayWalkthrough';
import { useVoiceIntake } from '@/hooks/useVoiceIntake';
import type { PathwayEvent } from '@/lib/pathway/events';

/**
 * The student-facing counterpart to the pathway builder on `/`.
 *
 * Same pipeline, same graph grounding, different audience: the builder is a
 * planning artifact for a teacher, this is a thing a nine-year-old touches.
 * Styling is deliberately local rather than global so the design system on `/`
 * is untouched.
 *
 * This page owns *generating* a session (voice/typed topic in, streamed
 * pathway out); once one exists, `PathwayWalkthrough` owns walking through
 * it — the same component `/learn/[sessionId]` uses for a persisted,
 * shared pathway, so a live build and a shared link end in the identical
 * student experience.
 */

const BUILDING_LINES = [
  'Finding the right lesson…',
  'Asking the knowledge graph…',
  'Building your activities…',
];

export default function LearnPage() {
  // Lazy initializer: reads the cached id (if any) exactly once, at mount,
  // rather than a synchronous setState from an effect. `typeof window` guards
  // the server-rendered pass this 'use client' page still gets before hydration.
  const [studentId, setStudentId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('studentId'),
  );
  const [session, setSession] = useState<WalkthroughSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [voiceCapture, setVoiceCapture] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [line, setLine] = useState(0);

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
      setVoiceCapture(null);

      try {
        const response = await fetch('/api/pathway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, studentId }),
        });
        if (!response.body) throw new Error('No response from the server.');

        const next: WalkthroughSession = {
          sessionId: null,
          topic,
          bigIdea: '',
          standardCode: null,
          steps: [],
          stepWidgets: {},
          stepWidgetNotes: {},
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

            if (event.type === 'anchor') {
              next.standardCode = event.anchor.standard.verified ? event.anchor.standard.code : null;
            }
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

  const voice = useVoiceIntake((transcript) => {
    setVoiceCapture(transcript);
    setTyped(transcript);
  });

  return (
    <div className="register-student min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center gap-6 px-5 py-10">
        {!session && (
          <AnimatePresence mode="wait">
            <motion.h1
              key="hero"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="mt-12 text-center text-5xl font-black tracking-tight text-balance"
            >
              What do you want to <span className="text-brand-text">learn?</span>
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
              className="flex size-36 flex-col items-center justify-center gap-1 rounded-full border-2 border-foreground bg-brand-fill text-foreground shadow-[0_8px_0_0_var(--brand-press)] transition-transform active:translate-y-1 active:shadow-[0_3px_0_0_var(--brand-press)] disabled:opacity-50 motion-reduce:transition-none"
            >
              <span className="text-4xl">{busy ? '…' : voice.listening ? '●' : '🎤'}</span>
              <span className="text-sm font-black">
                {busy ? 'Building' : voice.listening ? 'Listening' : 'Tap & talk'}
              </span>
            </motion.button>

            <div className="min-h-8 text-center">
              {busy && <p className="text-lg font-bold text-brand-text">{BUILDING_LINES[line]}</p>}
              {!busy && voice.interim && (
                <p className="text-lg font-bold text-ink-2 italic">&ldquo;{voice.interim}&rdquo;</p>
              )}
              {!busy && (error || voice.error) && (
                <p className="text-base font-bold text-destructive">⚠ {voice.error ?? error}</p>
              )}
            </div>

            {voiceCapture && !busy && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full rounded-2xl border border-foreground bg-card p-6 shadow-[6px_6px_0_rgba(31,25,21,.18)]"
              >
                <p className="mb-2 text-sm font-bold text-muted-foreground">Did you say:</p>
                <p className="mb-4 text-xl font-bold">&ldquo;{voiceCapture}&rdquo;</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void build(voiceCapture)}
                    className="flex-1 rounded-xl border border-foreground bg-brand-fill py-3 font-heading font-black text-foreground shadow-[0_4px_0_0_var(--brand-press)] active:translate-y-1 active:shadow-[0_2px_0_0_var(--brand-press)]"
                  >
                    ✓ Yes, let&apos;s go!
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceCapture(null);
                      setTyped('');
                    }}
                    className="flex-1 rounded-xl bg-slate-300 py-3 font-black text-slate-700 shadow-[0_4px_0_0_#475569] active:translate-y-1 active:shadow-[0_2px_0_0_#475569]"
                  >
                    ✗ Try again
                  </button>
                </div>
              </motion.div>
            )}

            {!voiceCapture && (
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
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-5 py-3 font-semibold placeholder:text-muted-foreground focus:border-foreground"
                />
                <button
                  type="submit"
                  disabled={busy || typed.trim().length < 3}
                  className="shrink-0 rounded-2xl border border-foreground bg-brand-fill px-6 font-heading font-black text-foreground shadow-[0_5px_0_0_var(--brand-press)] active:translate-y-1 active:shadow-[0_2px_0_0_var(--brand-press)] disabled:opacity-40"
                >
                  Go!
                </button>
              </form>
            )}
          </>
        )}

        {session && (
          <PathwayWalkthrough
            key={round}
            session={session}
            studentId={studentId}
            onRestart={{
              another: () => void build(session.topic),
              newTopic: () => {
                setSession(null);
                setTyped('');
              },
              busy,
            }}
          />
        )}
      </main>
    </div>
  );
}
