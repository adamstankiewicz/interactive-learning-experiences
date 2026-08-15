'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import type { FindTheFlawSpec } from '@/lib/pathway/schema';

type Props = { spec: FindTheFlawSpec; onComplete?: (correct: boolean) => void };

/**
 * A worked example with one mistake in it.
 *
 * Two stages, in the order a real diagnosis happens: find *where* it goes
 * wrong, then say *why*. The second stage is the point — locating a bad step
 * can be luck across five options, but naming what is wrong with it cannot,
 * and the wrong options are the misdiagnoses a student actually makes.
 *
 * Both stages check locally against the spec, so there is no model call and no
 * waiting: the student clicks and knows.
 */

type Stage = 'locating' | 'diagnosing' | 'done';

export function FindTheFlaw({ spec, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('locating');
  const [pickedStep, setPickedStep] = useState<string | null>(null);
  const [pickedWhy, setPickedWhy] = useState<string | null>(null);
  /** Steps ruled out by a wrong guess — struck through rather than re-offered. */
  const [ruledOut, setRuledOut] = useState<Set<string>>(new Set());
  const [wrongWhy, setWrongWhy] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);

  const telemetry = useWidgetTelemetry();
  const shownRef = useRef(false);
  const completedRef = useRef(false);

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
      payload: { steps: spec.steps.length, whyOptions: spec.whyOptions.length },
    });
  }, [telemetry, spec]);

  const pickStep = useCallback(
    (id: string) => {
      if (stage !== 'locating' || ruledOut.has(id)) return;

      const correct = id === spec.flawedStepId;
      setPickedStep(id);
      setAttempts((a) => a + 1);
      if (!correct) setRuledOut((prev) => new Set(prev).add(id));
      else setStage('diagnosing');

      telemetry.track({
        eventType: 'answer_checked',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct,
        payload: {
          phase: 'locate',
          attempt: attempts + 1,
          picked: id,
          // The profile confirms a misconception only from a wrong answer carrying it.
          ...(correct ? {} : { misconception: spec.hint }),
        },
      });
    },
    [stage, ruledOut, spec, attempts, telemetry],
  );

  const pickWhy = useCallback(
    (id: string) => {
      if (stage !== 'diagnosing' || wrongWhy.has(id)) return;

      const option = spec.whyOptions.find((o) => o.id === id);
      const correct = option?.correct === true;
      setPickedWhy(id);
      setAttempts((a) => a + 1);
      if (!correct) {
        setWrongWhy((prev) => new Set(prev).add(id));
      } else {
        setStage('done');
        onComplete?.(true);
      }

      telemetry.track({
        eventType: 'answer_checked',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct,
        payload: {
          phase: 'diagnose',
          attempt: attempts + 1,
          picked: id,
          // A wrong diagnosis is the more diagnostic of the two stages: it names
          // which misreading of the error the student actually holds.
          ...(correct ? {} : { misdiagnosis: option?.label ?? id }),
        },
      });

      if (!correct || completedRef.current) return;
      completedRef.current = true;

      telemetry.track({
        eventType: 'widget_completed',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct: true,
        payload: { attempts: attempts + 1 },
      });
      telemetry.flush();
    },
    [stage, wrongWhy, spec, attempts, telemetry, onComplete],
  );

  const foundIt = stage !== 'locating';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {spec.scenario.title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed">{spec.scenario.setup}</p>
      </div>

      {/*
        A vertical timeline rather than a numbered list.

        The task is "find the step where it goes wrong", which only makes sense
        if the reader can see that these are steps *in order* — one thing
        happening after another, each following from the last. Numbers said that
        weakly: 1-2-3-4 down a page reads as a list of items, and the thing that
        makes an error findable is noticing where one step stops following from
        the one above it. A connected rail says "this flows" without a numeral,
        so a broken link in it is the thing you are looking for.
      */}
      <ol className="flex flex-col">
        {spec.steps.map((step, index) => {
          const isFlaw = step.id === spec.flawedStepId;
          const isRuledOut = ruledOut.has(step.id);
          const revealed = foundIt && isFlaw;
          const last = index === spec.steps.length - 1;

          return (
            <li key={step.id} className="flex gap-3">
              {/* The rail. The connector stops at the last node so the sequence
                  reads as ending rather than trailing off. */}
              <div className="flex w-4 shrink-0 flex-col items-center" aria-hidden="true">
                <span
                  className={`mt-4 size-3 shrink-0 rounded-full border-2 transition-colors ${
                    revealed
                      ? 'border-destructive bg-destructive'
                      : isRuledOut
                        ? 'border-muted-foreground/30 bg-card'
                        : 'border-muted-foreground/50 bg-card'
                  }`}
                />
                {!last && (
                  <span
                    className={`w-0.5 flex-1 transition-colors ${
                      revealed ? 'bg-destructive/40' : 'bg-border'
                    }`}
                  />
                )}
              </div>

              {/* Full width, so the cards form a straight column beside the rail
                  rather than a ragged edge that hugs each sentence. */}
              <div className={`min-w-0 flex-1 ${last ? '' : 'pb-2'}`}>
                <button
                  type="button"
                  onClick={() => pickStep(step.id)}
                  disabled={foundIt || isRuledOut}
                  aria-pressed={pickedStep === step.id}
                  aria-label={`Step ${index + 1} of ${spec.steps.length}: ${step.label}`}
                  className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                    revealed
                      ? 'border-destructive bg-destructive/5'
                      : isRuledOut
                        ? 'border-border bg-card opacity-45'
                        : foundIt
                          ? 'border-border bg-card opacity-70'
                          : 'cursor-pointer border-border bg-card hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                  }`}
                >
                  <span className={`text-sm ${isRuledOut ? 'line-through' : ''}`}>{step.label}</span>
                  {revealed && (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-destructive">
                      here
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* A wrong guess rules that step out and says what to re-check, rather than
          simply saying no — the hint is the only teaching that happens here. */}
      {stage === 'locating' && ruledOut.size > 0 && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-xs leading-snug text-muted-foreground">
          {spec.hint}
        </p>
      )}

      {/*
        The steps above are a sequence and are numbered as one. These are not:
        they are a pick-one set in arbitrary order. Without a marker they render
        as an identical stack of cards continuing straight down from the
        numbered list, which reads as steps 6-9 with the numbers missing — so
        each one carries a radio dot instead, and the group is a real radiogroup
        rather than a row of toggles.
      */}
      {stage === 'diagnosing' && (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="What is wrong with that step?">
          <p className="text-sm font-medium">That&apos;s the step. What&apos;s wrong with it?</p>
          {spec.whyOptions.map((option) => {
            const isWrong = wrongWhy.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={pickedWhy === option.id}
                onClick={() => pickWhy(option.id)}
                disabled={isWrong}
                className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors ${
                  isWrong
                    ? 'border-border bg-card text-muted-foreground line-through opacity-45'
                    : 'cursor-pointer border-border bg-card hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
                    isWrong ? 'border-muted-foreground/40' : 'border-muted-foreground/60'
                  }`}
                />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {stage === 'done' && (
        <div
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm leading-relaxed text-success"
        >
          {spec.explanation}
        </div>
      )}

      {stage === 'done' && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStage('locating');
              setPickedStep(null);
              setPickedWhy(null);
              setRuledOut(new Set());
              setWrongWhy(new Set());
              // Without this, a fresh run reports attempt 5, 6, 7… to telemetry.
              setAttempts(0);
            }}
          >
            Try it again
          </Button>
        </div>
      )}
    </div>
  );
}
