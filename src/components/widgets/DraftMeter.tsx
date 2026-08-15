'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import type { Band, ScoreResult } from '@/lib/draft-meter/schema';
import type { DraftMeterSpec } from '@/lib/pathway/schema';

/**
 * Question, textbox, one line.
 *
 * The meter is the only feedback surface. Everything the model returns has to
 * arrive as a line position or a label — the payload also carries `signals`
 * (stance / reasoning / evidence), which are deliberately not rendered.
 * Per-dimension feedback turns this into a grading interface.
 */

/**
 * Long enough to be a real pause rather than a gap between words. At 800ms the
 * meter fired mid-sentence often enough that it read as scoring *while* you
 * typed rather than after you stopped.
 */
const DEBOUNCE_MS = 1500;

/**
 * The fill never fully empties: the knob is centred on the fill's leading edge,
 * so a 0% fill would push it half off the track. 5% parks it just inside.
 */
const IDLE_FILL = 5;

type Phase = 'idle' | 'checking' | 'scored' | 'error';

/** Only the empty box is genuinely "just starting" — see the ladder in schema.ts. */
const PHASE_LABEL: Record<Exclude<Phase, 'scored'>, string> = {
  idle: 'just starting',
  checking: 'checking…',
  error: "couldn't check",
};

/**
 * One colour ramp driving the fill and the label together, so the line itself
 * carries the progress rather than only the words.
 *
 * These are the four chromatic tokens the design system defines, in their
 * intended roles — the palette is otherwise greyscale, and each of these was
 * lightness-tuned to clear WCAG AA against `--card`.
 *
 * Colour is also a claim: idle, checking and error stay muted, so a pulsing bar
 * is never mistaken for a verdict the model hasn't given yet.
 */
const BAND_TONE: Record<Band, { fill: string; dot: string; label: string }> = {
  developing: { fill: 'bg-destructive', dot: 'border-destructive', label: 'text-destructive' },
  approaching: { fill: 'bg-warning', dot: 'border-warning', label: 'text-warning' },
  proficient: { fill: 'bg-selected', dot: 'border-selected', label: 'text-selected' },
  advanced: { fill: 'bg-success', dot: 'border-success', label: 'text-success' },
};

const UNSCORED_TONE = {
  fill: 'bg-muted-foreground/40',
  dot: 'border-muted-foreground/40',
  label: 'text-muted-foreground',
};

function meterTone(phase: Phase, result: ScoreResult | null) {
  if (phase !== 'scored' || !result) return UNSCORED_TONE;
  return BAND_TONE[result.band];
}

export function DraftMeter({ spec }: { spec: DraftMeterSpec }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ScoreResult | null>(null);

  const telemetry = useWidgetTelemetry();
  /**
   * Held in a ref so the scoring effect below need not depend on it. The handle
   * is stable, but listing it there would tie a network call to the identity of
   * something that has no bearing on when a draft should be scored.
   */
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  const shownRef = useRef(false);
  const completedRef = useRef(false);
  const lastBandRef = useRef<Band | null>(null);

  /**
   * Hints are pulled, not pushed. Shown unprompted they turn the widget into a
   * guided exercise — the student stops thinking about the argument and starts
   * working through instructions. Behind a toggle, the help is there for
   * whoever wants it and out of the way for whoever doesn't.
   */
  const [hintOpen, setHintOpen] = useState(false);

  const questionId = useId();

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
      payload: { mode: spec.passage ? 'cite-source' : 'argue', criteria: spec.criteria.length },
    });
  }, [telemetry, spec]);

  /** Monotonic request id — a response whose id is stale is dropped, not rendered. */
  const seq = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  /**
   * Clearing the box returns the meter to idle — not to a score of zero. That
   * is a response to a user action rather than a synchronisation, so it belongs
   * here and not in the effect below. Bumping `seq` invalidates anything still
   * in flight, so a late response can't resurrect the old position.
   */
  function handleChange(value: string) {
    setText(value);
    if (value.trim()) return;

    seq.current += 1;
    inFlight.current?.abort();
    inFlight.current = null;
    setPhase('idle');
    setResult(null);
  }

  useEffect(() => {
    const draft = text.trim();
    if (!draft) return;

    const timer = setTimeout(() => {
      inFlight.current?.abort();

      const controller = new AbortController();
      inFlight.current = controller;
      const id = ++seq.current;

      setPhase('checking');

      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: draft,
          question: spec.question,
          standardCode: spec.standardCode,
          standardDescription: spec.standardDescription,
          criteria: spec.criteria,
          passage: spec.passage,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Scoring failed.');
          return (await response.json()) as ScoreResult;
        })
        .then((scored) => {
          if (id !== seq.current) return;
          setResult(scored);
          setPhase('scored');
          recordScore(scored);
        })
        .catch(() => {
          // A cancelled call is expected, not a failure. A stale one is ignored.
          // Neither moves the line, and neither does the error: it holds.
          if (controller.signal.aborted || id !== seq.current) return;
          setPhase('error');
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, spec]);

  /**
   * The meter re-scores on every pause in typing, so recording each response
   * would bury the profile in one student's keystrokes. Only a band change is
   * reported, and only the finish line is scored: a draft still being written
   * is not a wrong answer, so intermediate events carry a null verdict and stay
   * out of mastery.
   */
  function recordScore(scored: ScoreResult) {
    const t = telemetryRef.current;

    if (scored.band !== lastBandRef.current) {
      lastBandRef.current = scored.band;
      t.track({
        eventType: 'answer_checked',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: t.standardCode,
        correct: null,
        payload: { score: scored.score, band: scored.band, signals: scored.signals },
      });
    }

    if (!scored.criteriaMet || completedRef.current) return;
    completedRef.current = true;

    t.track({
      eventType: 'widget_completed',
      widgetKind: spec.kind,
      learningComponentId: spec.learningComponentId,
      standardCode: t.standardCode,
      correct: true,
      payload: { score: scored.score, band: scored.band },
    });
    t.flush();
  }

  const fill = phase === 'idle' ? IDLE_FILL : Math.max(result?.score ?? 0, IDLE_FILL);
  const label = phase === 'scored' && result ? result.label : PHASE_LABEL[phase as keyof typeof PHASE_LABEL];
  const tone = meterTone(phase, result);

  // Once every criterion is met the widget stops asking and says so. Nudging up
  // to that point is the productive part; nudging past it is a treadmill, and a
  // hint that just disappears reads as a bug rather than as a finish line.
  const done = phase !== 'idle' && result?.criteriaMet;
  const hint = phase === 'idle' ? null : result?.nudge;

  return (
    <Card className="w-full max-w-[460px]">
      <CardContent>
        {spec.passage && (
          <figure className="mb-4 rounded-lg bg-muted p-3.5">
            <figcaption className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {spec.passage.source}
            </figcaption>
            {/* Sized so a spec-conformant passage (<=120 words) shows in full;
                the scroll is a safety valve for an overlong one, not the norm. */}
            <p className="mt-1.5 max-h-[340px] overflow-y-auto text-sm leading-[1.6]">
              {spec.passage.text}
            </p>
          </figure>
        )}

        <div className="flex items-start gap-2">
          <p id={questionId} className="text-base leading-[1.4] font-semibold">
            {spec.question}
          </p>
          <StandardHelp text={spec.standardForStudents} />
        </div>

        <textarea
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          aria-labelledby={questionId}
          placeholder={spec.placeholder}
          rows={3}
          className="mt-4 block min-h-[92px] w-full resize-y rounded-lg border border-input bg-transparent p-3.5 text-sm leading-[1.6] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
        />

        <div className="mt-5 flex items-center gap-3.5">
          <div
            role="progressbar"
            aria-label="Response strength"
            aria-valuemin={0}
            aria-valuemax={100}
            // Omitted while checking, which is what makes the bar read as
            // indeterminate rather than as a score the UI hasn't earned yet.
            aria-valuenow={phase === 'scored' && result ? result.score : undefined}
            className={`relative h-2 flex-1 rounded-full bg-muted ${phase === 'checking' ? 'animate-pulse' : ''}`}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${tone.fill}`}
              style={{ width: `${fill}%` }}
            />
            <div
              className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card transition-[left,border-color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${tone.dot}`}
              style={{ left: `${fill}%` }}
            />
          </div>

          <span
            role="status"
            className={`w-[104px] shrink-0 text-right text-xs font-semibold transition-colors ${tone.label}`}
          >
            {label}
          </span>
        </div>

        {done ? (
          <p
            role="status"
            className={`mt-3 inline-block rounded-full bg-success/10 px-3 py-1.5 text-xs leading-snug font-medium text-success transition-opacity ${
              phase === 'scored' ? 'opacity-100' : 'opacity-50'
            }`}
          >
            That&apos;s all three — a side, a reason, and evidence
            {spec.passage ? ' from the text' : ''}.
          </p>
        ) : hint ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                // Counted before the toggle, and only on the way open, so the
                // hint rate reflects asking for help rather than tidying up.
                if (!hintOpen) {
                  telemetry.track({
                    eventType: 'hint_requested',
                    widgetKind: spec.kind,
                    learningComponentId: spec.learningComponentId,
                    standardCode: telemetry.standardCode,
                    correct: null,
                    payload: { band: result?.band ?? null },
                  });
                }
                setHintOpen((open) => !open);
              }}
              aria-expanded={hintOpen}
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            >
              {hintOpen ? 'Hide hint' : 'Need a hint?'}
            </button>
            {hintOpen && (
              <p
                role="status"
                className={`mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-snug transition-opacity ${
                  phase === 'scored' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {hint}
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The standard, on demand.
 *
 * Standards wording is written for adults, so a student being measured against
 * one has no way to see what is actually being asked. This is the goalpost:
 * hover or tap the "?" and the criteria appear in words meant for the person
 * doing the work. Click-toggles as well as hovers, so it survives touch and
 * keyboard.
 */
function StandardHelp({ text }: { text: string }) {
  const [pinned, setPinned] = useState(false);
  const helpId = useId();

  return (
    <span className="group relative mt-0.5 shrink-0">
      <button
        type="button"
        onClick={() => setPinned((value) => !value)}
        aria-expanded={pinned}
        aria-describedby={helpId}
        aria-label="What is this asking for?"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:border-ring focus-visible:text-foreground focus-visible:outline-none"
      >
        ?
      </button>

      <span
        id={helpId}
        role="tooltip"
        className={`absolute top-7 right-0 z-10 w-64 rounded-lg bg-foreground p-3 text-xs leading-[1.5] font-normal text-background shadow-lg transition-opacity ${
          pinned
            ? 'visible opacity-100'
            : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  );
}
