'use client';

import { Check, Mic } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import { useVoiceIntake } from '@/hooks/useVoiceIntake';
import type { DebateMessage, DebateSide, DebateTurnResult } from '@/lib/debate/schema';
import type { DebateAiSpec } from '@/lib/pathway/schema';

type Props = { spec: DebateAiSpec; onComplete?: () => void };

/**
 * A debate: two sides, the student takes one, the assistant takes the other.
 *
 * The side-picking screen is not ceremony. An earlier version fixed the
 * assistant's position and asked the student to "test my argument" — which is a
 * real task, but it is not debating: nobody is arguing *for* anything, and the
 * student never has to hold a case of their own. Choosing a side is what turns
 * it into an argument they own, and seeing both sides put fairly before they
 * choose is what stops it being a loyalty test.
 *
 * Nobody wins. What gets tracked instead is whether the student argued like
 * someone evaluating — challenged the evidence rather than the person, caught a
 * leap, granted a fair point. Those are the chips, and they are the only
 * scoring shown.
 *
 * The opponent never says how the student is doing. Praise inside the reply
 * would flatter, leak the judgement, and turn an opponent into a teacher — so
 * the assessment rides back on the same call and renders somewhere else.
 */
export function DebateAI({ spec, onComplete }: Props) {
  const [studentSide, setStudentSide] = useState<DebateSide | null>(null);
  const [aiSide, setAiSide] = useState<DebateSide | null>(null);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [made, setMade] = useState<Set<string>>(new Set());
  const [turn, setTurn] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [conceded, setConceded] = useState(false);

  const telemetry = useWidgetTelemetry();
  const shownRef = useRef(false);
  const completedRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const appendTranscript = useCallback((text: string) => {
    setDraft((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const voice = useVoiceIntake(appendTranscript, { continuous: true });

  // Guarded by a ref so a remount in development does not double-count.
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    telemetry.track({
      eventType: 'widget_shown',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: telemetry.standardCode,
      correct: null,
      payload: { motion: spec.motion, moves: spec.moves.map((m) => m.id), turnLimit: spec.turnLimit },
    });
  }, [telemetry, spec]);

  // Keep the newest message in view without yanking the whole page around.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pending]);

  /**
   * `chosen` is passed in rather than read from state: the assistant's opening
   * has to be the one for the side it actually drew, and state set in the same
   * tick is not readable yet.
   */
  const chooseSide = useCallback(
    (chosen: (typeof spec.sides)[number]) => {
      const opponent = spec.sides.find((side) => side.id !== chosen.id) ?? spec.sides[0]!;

      setStudentSide({ id: chosen.id, label: chosen.label, summary: chosen.summary });
      setAiSide({ id: opponent.id, label: opponent.label, summary: opponent.summary });
      setMessages([{ role: 'ai', text: opponent.opening }]);

      telemetry.track({
        eventType: 'answer_checked',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct: null,
        // Which side a student picks is worth knowing: a class that all picks
        // the same way is a sign the motion is not actually contestable.
        payload: { phase: 'side-chosen', studentSide: chosen.id },
      });
    },
    [spec, telemetry],
  );

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || pending || done || !aiSide || !studentSide) return;

    const nextTurn = turn + 1;
    const transcript = messages;

    setMessages((prev) => [...prev, { role: 'student', text: message }]);
    setDraft('');
    setPending(true);
    setError(null);
    if (voice.listening) voice.stop();

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motion: spec.motion,
          aiSide,
          studentSide,
          aiPersona: spec.aiPersona,
          moves: spec.moves,
          transcript,
          message,
          turn: nextTurn,
          turnLimit: spec.turnLimit,
        }),
      });

      if (!response.ok) throw new Error('The debate service did not answer.');
      const result = (await response.json()) as DebateTurnResult;

      setMessages((prev) => [...prev, { role: 'ai', text: result.reply }]);
      setTurn(nextTurn);
      if (result.conceded) setConceded(true);

      const grown = new Set(made);
      result.movesMade.forEach((id) => grown.add(id));
      setMade(grown);

      telemetry.track({
        eventType: 'answer_checked',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        // An exchange has no right answer — `correct` would be a category error.
        correct: null,
        payload: {
          turn: nextTurn,
          movesThisTurn: result.movesMade,
          movesSoFar: [...grown],
          conceded: result.conceded,
        },
      });

      if (!result.final) return;
      setDone(true);
      onComplete?.();

      if (completedRef.current) return;
      completedRef.current = true;

      telemetry.track({
        eventType: 'widget_completed',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct: null,
        payload: {
          turns: nextTurn,
          movesMade: [...grown],
          movesMissed: spec.moves.filter((m) => !grown.has(m.id)).map((m) => m.id),
        },
      });
      telemetry.flush();
    } catch {
      // The student's message stays on screen: losing what they wrote because a
      // request failed is worse than the failure.
      setError('Could not reach your opponent. Try sending that again.');
    } finally {
      setPending(false);
    }
  }, [draft, pending, done, turn, messages, spec, made, telemetry, onComplete, voice, aiSide, studentSide]);

  const remaining = spec.turnLimit - turn;

  // Both sides put fairly, then a choice. Seeing the strongest version of the
  // side you are about to argue against is what keeps this a debate rather than
  // a loyalty test.
  if (!studentSide || !aiSide) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{spec.prompt}</p>
          <p className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
            {spec.motion}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {spec.sides.map((side) => (
            <button
              key={side.id}
              type="button"
              onClick={() => chooseSide(side)}
              className="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="text-sm font-semibold text-foreground">{side.label}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{side.summary}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => chooseSide(spec.sides[Math.floor(Math.random() * spec.sides.length)]!)}
          >
            Pick one for me
          </Button>
          <span className="text-xs text-muted-foreground">
            You&apos;ll argue your side. I&apos;ll take the other, and I won&apos;t make it easy.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{spec.motion}</p>
        {/* Who holds what, kept on screen. In a four-turn exchange it is
            genuinely easy to lose track of which side you took. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground">
            You: {studentSide.label}
          </span>
          <span className="text-muted-foreground">vs</span>
          <span className="rounded-full border border-border px-2.5 py-1 font-medium text-muted-foreground">
            Me: {aiSide.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              message.role === 'ai'
                ? 'self-start rounded-bl-sm bg-card text-foreground shadow-sm'
                : 'self-end rounded-br-sm bg-primary text-primary-foreground'
            }`}
          >
            {message.text}
          </div>
        ))}

        {pending && (
          <div className="self-start rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 shadow-sm">
            <span className="flex gap-1" aria-label="Thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/*
        The scoring, and the whole point of the widget. Disagreeing is not on
        this list; naming why an argument fails is. A student can read it before
        they have made any of them and know what is being asked of them, which a
        score out of ten could never tell them.
      */}
      <div className="flex flex-wrap gap-1.5">
        {spec.moves.map((move) => {
          const hit = made.has(move.id);
          return (
            <span
              key={move.id}
              title={move.lookFor}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                hit
                  ? 'border-success/40 bg-success/10 font-medium text-success'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {hit && <Check className="size-3" aria-hidden="true" />}
              {move.label}
            </span>
          );
        })}
      </div>

      {done ? (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed"
        >
          <span className="font-medium">That&apos;s the debate — no winner, by design.</span>{' '}
          {made.size === spec.moves.length
            ? 'You made every move on the list — you tested the argument rather than just disagreeing with it.'
            : made.size > 0
              ? `You made ${made.size} of ${spec.moves.length}. The ones left are the moves worth trying next time: ${spec.moves
                  .filter((m) => !made.has(m.id))
                  .map((m) => m.label.toLowerCase())
                  .join(', ')}.`
              : 'You held your ground, but none of the evaluative moves landed — the list above is what to aim at next time.'}
          {conceded && ' You also forced a concession, which takes a real argument.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Test the argument — what does not hold up, and why?"
            rows={3}
            disabled={pending}
            className="block min-h-[80px] w-full resize-y rounded-lg border border-input bg-transparent p-3 text-sm leading-[1.6] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={send} disabled={!draft.trim() || pending}>
              {pending ? 'Sending…' : 'Reply'}
            </Button>

            {voice.supported && (
              <Button
                size="sm"
                variant={voice.listening ? 'default' : 'outline'}
                onClick={voice.listening ? voice.stop : voice.start}
                aria-pressed={voice.listening}
                aria-label={voice.listening ? 'Stop dictating' : 'Dictate your reply'}
              >
                <Mic className="size-3.5" aria-hidden="true" />
                {voice.listening ? 'Listening' : 'Speak'}
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {remaining} {remaining === 1 ? 'reply' : 'replies'} left
            </span>
          </div>

          {(voice.interim || voice.error) && (
            <p
              className={`truncate text-xs ${voice.error ? 'text-destructive' : 'text-muted-foreground italic'}`}
            >
              {voice.error ?? voice.interim}
            </p>
          )}

          {error && (
            <p role="status" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
