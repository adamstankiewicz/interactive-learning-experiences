'use client';

import { Check, Mic } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import { useVoiceIntake } from '@/hooks/useVoiceIntake';
import type { FeedbackResult, PriorRound, Stance } from '@/lib/defend-claim/schema';
import type { DefendClaimSpec } from '@/lib/pathway/schema';

/**
 * A claim, two sources that disagree, and an argument the student has to hold.
 *
 * The rule this widget is built around: nothing is judged until it is asked
 * for. Draft Meter, its nearest neighbour, scores continuously — the line moves
 * while you type. Here the box stays silent however long the student writes,
 * and the model speaks only when they press the button. Feedback you did not
 * request is an interruption; feedback you did request is a reply, and a reply
 * is something you can argue back at.
 *
 * That is also why the response always contains a challenge, including on the
 * round where every criterion is met. The end state is not "correct" — it is
 * "your defense holds, and here is what you would still have to answer."
 */

const CRITERIA = ['position', 'reasoning', 'evidence'] as const;

/**
 * Short of this, a model call cannot say anything a student does not already
 * know about their own two words. It is a floor on burning a call, not a
 * standard — the shortest genuinely defensible answer this asks for is roughly
 * a side, a because, and a quote.
 */
const MIN_WORDS = 12;

type Phase = 'drafting' | 'reading' | 'feedback' | 'error';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

type Props = { spec: DefendClaimSpec; onComplete?: () => void };

export function DefendClaim({ spec, onComplete }: Props) {
  const [stance, setStance] = useState<Stance | null>(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('drafting');
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [history, setHistory] = useState<PriorRound[]>([]);
  /**
   * The exact draft the current feedback was written about. Comparing against
   * it is what lets the button distinguish a revision from a re-submission of
   * the same words — and the scoring call is deterministic, so re-reading an
   * unchanged draft would spend a call to return the identical verdict.
   */
  const [reviewedText, setReviewedText] = useState<string | null>(null);

  const telemetry = useWidgetTelemetry();
  /**
   * Held in a ref for the reason DraftMeter documents — the context value is
   * rebuilt on every provider render, so depending on it directly would churn
   * — but written from an effect rather than in the render body. Mutating a ref
   * during render is against the rules even when nothing reads it until a later
   * event fires, and `useVoiceIntake` already does it this way.
   */
  const telemetryRef = useRef(telemetry);
  useEffect(() => {
    telemetryRef.current = telemetry;
  });

  const shownRef = useRef(false);
  const completedRef = useRef(false);
  const inFlight = useRef<AbortController | null>(null);
  /**
   * Whether any of this draft arrived by voice. Worth reporting because it is
   * the question the feature has to answer to justify itself — and it is a ref
   * rather than state because nothing renders differently for it.
   */
  const spokeRef = useRef(false);

  const claimId = useId();
  const defenseId = useId();
  const stanceName = useId();

  useEffect(() => () => inFlight.current?.abort(), []);

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
      payload: { era: spec.era, sources: spec.sources.length },
    });
  }, [telemetry, spec]);

  /**
   * Voice appends rather than replaces.
   *
   * The learn page pipes a transcript straight into a fresh search, so
   * overwriting is right there. Here the student is building one paragraph
   * across several utterances, and a transcript that replaced the box would
   * delete the argument they just dictated.
   */
  const appendTranscript = useCallback((transcript: string) => {
    spokeRef.current = true;
    setText((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
  }, []);

  const voice = useVoiceIntake(appendTranscript, { continuous: true });

  const words = wordCount(text);
  const revised = reviewedText !== null && text.trim() !== reviewedText;
  const canSubmit =
    stance !== null && words >= MIN_WORDS && phase !== 'reading' && (reviewedText === null || revised);

  async function requestFeedback() {
    if (!canSubmit || stance === null) return;

    const defense = text.trim();
    const round = history.length + 1;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setPhase('reading');

    const t = telemetryRef.current;
    t.track({
      eventType: 'feedback_requested',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: t.standardCode,
      correct: null,
      payload: { round, words: wordCount(defense), stance, spoken: spokeRef.current },
    });

    try {
      const response = await fetch('/api/defend-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defense,
          stance,
          claim: spec.claim,
          context: spec.context,
          sources: spec.sources,
          criteria: spec.criteria,
          standardCode: spec.standardCode,
          standardDescription: spec.standardDescription,
          round,
          history,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Could not read your defense.');
      const feedback = (await response.json()) as FeedbackResult;

      setResult(feedback);
      setReviewedText(defense);
      setHistory((rounds) => [
        ...rounds,
        { defense, challenge: feedback.challenge, revise: feedback.revise },
      ]);
      setPhase('feedback');
      record(feedback, round);
    } catch {
      // An aborted call is an unmount, not a failure. Anything else leaves the
      // draft exactly where it was — losing a paragraph to a failed request is
      // a worse outcome than getting no reading.
      if (controller.signal.aborted) return;
      setPhase('error');
    }
  }

  /**
   * Every reading is reported, unlike Draft Meter's band-change filter — there
   * are a handful of these per lesson rather than one per pause in typing, and
   * which round a criterion was first met on is the signal worth having.
   *
   * `correct` stays null until the defense holds: a draft still being argued is
   * not a wrong answer, and `component_mastery_rollup` counts any non-null
   * verdict as an attempt.
   */
  function record(feedback: FeedbackResult, round: number) {
    const t = telemetryRef.current;

    t.track({
      eventType: 'answer_checked',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: t.standardCode,
      correct: feedback.holds ? true : null,
      payload: {
        round,
        met: feedback.met,
        checks: feedback.checks,
        stanceMatchesWriting: feedback.stanceMatchesWriting,
      },
    });

    if (!feedback.holds || completedRef.current) return;
    completedRef.current = true;

    t.track({
      eventType: 'widget_completed',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: t.standardCode,
      correct: true,
      payload: { rounds: round, met: feedback.met },
    });
    t.flush();
    onComplete?.();
  }

  const holds = phase === 'feedback' && result?.holds;

  return (
    <Card className="w-full max-w-[620px]">
      <CardContent>
        <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-wider uppercase">
          <span className="font-semibold text-primary">Defend a claim</span>
          <span className="text-muted-foreground">{spec.era}</span>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            The claim
          </p>
          <p id={claimId} className="mt-2 text-xl leading-[1.35] font-semibold text-balance">
            {spec.claim}
          </p>
          <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{spec.context}</p>
        </div>

        <StancePicker
          name={stanceName}
          value={stance}
          onChange={setStance}
          describedBy={claimId}
          // Locked once a reading exists: the feedback, the challenge, and the
          // stance-match verdict were all written about one side of the claim,
          // and silently switching sides underneath them makes every word of it
          // wrong without marking any of it stale.
          locked={reviewedText !== null}
        />

        <section className="mt-6">
          <h3 className="text-sm font-semibold">Sources you can cite</h3>
          <ul className="mt-2.5 space-y-2.5" role="list">
            {spec.sources.map((source, index) => (
              <li key={index} className="rounded-lg border border-border p-3.5">
                <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  {source.attribution}
                </p>
                <p className="mt-1.5 text-sm leading-[1.6]">{source.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor={defenseId} className="text-sm font-semibold">
              Your defense
            </label>
            <span className="text-xs text-muted-foreground">
              Take a side, say why, then point to a source.
            </span>
          </div>

          <div className="relative mt-2.5">
            <textarea
              id={defenseId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={spec.placeholder}
              rows={6}
              className="block min-h-[150px] w-full resize-y rounded-lg border border-input bg-transparent p-3.5 pb-11 text-sm leading-[1.7] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
            />

            {/* Inside the box, bottom-left: the mic belongs to the field it
                fills, and parking it outside made it read as a separate
                action that discarded what was already typed. */}
            {voice.supported && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={voice.listening ? voice.stop : voice.start}
                  aria-pressed={voice.listening}
                  aria-label={voice.listening ? 'Stop dictating' : 'Dictate your defense'}
                  className={`pointer-events-auto flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
                    voice.listening
                      ? 'animate-pulse border-destructive bg-destructive/10 text-destructive'
                      : 'border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground'
                  }`}
                >
                  <Mic aria-hidden="true" className="size-3.5" />
                  {voice.listening ? 'Listening' : 'Speak'}
                </button>

                {(voice.interim || voice.error) && (
                  <span
                    className={`truncate text-xs ${voice.error ? 'text-destructive' : 'text-muted-foreground italic'}`}
                  >
                    {voice.error ?? `“${voice.interim}”`}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <Checklist spec={spec} result={phase === 'feedback' ? result : null} />

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void requestFeedback()}
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:bg-primary/85 disabled:pointer-events-none disabled:opacity-40"
          >
            {phase === 'reading'
              ? 'Reading your defense…'
              : reviewedText === null
                ? 'Get feedback'
                : 'Get feedback on my revision'}
          </button>

          <p role="status" className="text-xs text-muted-foreground">
            {phase === 'error'
              ? 'That did not go through. Your defense is safe — try again.'
              : stance === null
                ? 'Pick a side first.'
                : words < MIN_WORDS
                  ? `A few more words — ${MIN_WORDS - words} to go.`
                  : reviewedText !== null && !revised
                    ? 'Revise your defense, then ask again.'
                    : ''}
          </p>
        </div>

        {phase === 'feedback' && result && (
          <Feedback result={result} round={history.length} holds={Boolean(holds)} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Two options, one choice — so radios, not the checkboxes the design shows.
 * The squares are kept; the semantics are not. Native inputs carry arrow-key
 * navigation, the roving tab stop, and the grouping announcement for free, and
 * a checkbox that behaves like a radio is a promise the widget does not keep.
 */
function StancePicker({
  name,
  value,
  onChange,
  describedBy,
  locked,
}: {
  name: string;
  value: Stance | null;
  onChange: (stance: Stance) => void;
  describedBy: string;
  locked: boolean;
}) {
  return (
    <fieldset
      aria-describedby={describedBy}
      className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted px-4 py-3"
    >
      <legend className="float-left mr-6 text-sm font-semibold">Where do you land?</legend>

      {(['agree', 'disagree'] as const).map((option) => {
        const selected = value === option;

        return (
          <label
            key={option}
            className={`flex items-center gap-2 text-sm ${
              locked && !selected ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              disabled={locked && !selected}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`flex size-4 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-muted ${
                selected ? 'border-selected bg-selected text-background' : 'border-input bg-card'
              }`}
            >
              {selected && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={selected ? 'font-semibold' : ''}>
              {option === 'agree' ? 'Agree' : 'Disagree'}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * The pre-submission list and the model's verdict are the same three rows.
 *
 * Before a reading these are the goalposts; after one they are the marking
 * against them. Rendering them as two separate lists was the first attempt and
 * it read as two unrelated checklists disagreeing with each other — the student
 * has to be able to see that the thing being judged is the thing they were told
 * to do, which is why the spec fixes these keys rather than letting the model
 * write free-text labels on either side.
 */
function Checklist({ spec, result }: { spec: DefendClaimSpec; result: FeedbackResult | null }) {
  return (
    <section className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:gap-6">
      <h3 className="w-[104px] shrink-0 font-mono text-[11px] leading-[1.5] tracking-wider text-muted-foreground uppercase">
        {result ? 'How it reads' : 'Check before you submit'}
      </h3>

      <ul className="flex flex-col gap-1.5" role="list">
        {CRITERIA.map((criterion) => {
          const met = result?.checks[criterion];

          return (
            <li key={criterion} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                  met ? 'border-success bg-success text-background' : 'border-input'
                }`}
              >
                {met && <Check className="size-3" strokeWidth={3} />}
              </span>
              {/* Muted, not struck through: a rule with a line through it reads
                  as one that no longer applies, which is the opposite of what a
                  met criterion means here. */}
              <span className={met ? 'text-muted-foreground' : ''}>{spec.checklist[criterion]}</span>
              {result && <span className="sr-only">{met ? '— done' : '— not yet'}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Feedback({
  result,
  round,
  holds,
}: {
  result: FeedbackResult;
  round: number;
  holds: boolean;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="mt-5 rounded-lg border border-border bg-muted/50 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          Reading {round}
        </p>
        {holds && (
          <p className="text-xs font-semibold text-success">Your defense holds.</p>
        )}
      </div>

      <p className="mt-2.5 text-sm leading-[1.6]">{result.strength}</p>

      {!result.stanceMatchesWriting && (
        <p className="mt-2.5 text-sm leading-[1.6] text-warning">
          Careful — what you wrote argues against the side you ticked.
        </p>
      )}

      {/* The challenge is set apart, and stays even once the defense holds. A
          history argument does not end because it was well made; it ends when
          the student has heard the strongest thing said back to it. */}
      <div className="mt-4 border-l-2 border-foreground/25 pl-3.5">
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          But consider
        </p>
        <p className="mt-1.5 text-sm leading-[1.6]">{result.challenge}</p>
      </div>

      {result.revise ? (
        <p className="mt-4 inline-block rounded-full bg-selected/10 px-3 py-1.5 text-xs leading-snug font-medium text-selected">
          {result.revise}
        </p>
      ) : (
        <p className="mt-4 text-xs leading-snug text-muted-foreground">
          You took a side, said why, and cited a source — that is the whole job. Answer the
          objection above if you want to push it further.
        </p>
      )}
    </section>
  );
}
