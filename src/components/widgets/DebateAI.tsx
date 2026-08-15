'use client';

import { Check, Mic } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import { useVoiceIntake } from '@/hooks/useVoiceIntake';
import type { DebateMessage, DebateTurnResult } from '@/lib/debate/schema';
import type { DebateAiSpec } from '@/lib/pathway/schema';

type Props = { spec: DebateAiSpec; onComplete?: () => void };

/**
 * A short debate with an opponent that argues back.
 *
 * Aimed at Bloom's *evaluate*, and everything here follows from that. What gets
 * credited is not winning and not disagreeing — it is the evaluative move:
 * naming why a piece of evidence fails, catching an unsupported leap, granting
 * a fair point. Those are the chips along the bottom, and they are the only
 * scoring the student sees.
 *
 * The opponent never says how the student is doing. Praise inside the reply
 * would flatter, leak the judgement, and turn an opponent into a teacher — so
 * the assessment rides back on the same call and is rendered somewhere else
 * entirely.
 */
export function DebateAI({ spec, onComplete }: Props) {
  const [messages, setMessages] = useState<DebateMessage[]>([
    { role: 'ai', text: spec.openingMessage },
  ]);
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

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || pending || done) return;

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
          aiPosition: spec.aiPosition,
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
  }, [draft, pending, done, turn, messages, spec, made, telemetry, onComplete, voice]);

  const remaining = spec.turnLimit - turn;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{spec.prompt}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium">Motion:</span> {spec.motion}
        </p>
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
          <span className="font-medium">That&apos;s the debate.</span>{' '}
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
