'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NarratedCardSpec } from '@/lib/pathway/schema';

type Props = { spec: NarratedCardSpec; onComplete?: (correct: boolean) => void };

// Base speech rate at 1x, scaled by the student's chosen speed multiplier.
const BASE_RATE = 0.92;
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

// Split plain text into sentences. Strips markdown markers so the TTS
// doesn't read "asterisk asterisk" aloud.
function toPlainSentences(markdown: string): string[] {
  const plain = markdown
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`(.*?)`/g, '$1')
    .trim();

  return plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Highlight active sentence in the body text by wrapping it in a <mark>.
// We match on a stripped version so markdown bold/italic doesn't prevent matching.
function HighlightedBody({
  body,
  activeSentence,
  revealedSentences,
}: {
  body: string;
  activeSentence: number; // index into sentences array, -1 = step not yet started
  revealedSentences: number; // how many sentences are fully spoken
}) {
  const sentences = toPlainSentences(body);

  return (
    <p className="text-sm leading-relaxed text-foreground">
      {sentences.map((sentence, i) => {
        const isActive = i === activeSentence;
        const isRevealed = i < revealedSentences;
        const isHidden = i > activeSentence && i >= revealedSentences;

        if (isHidden) return null;

        return (
          <span
            key={i}
            className={`transition-all duration-200 ${
              isActive
                ? 'bg-primary/15 text-foreground rounded px-0.5'
                : isRevealed
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            }`}
          >
            {sentence}
            {i < sentences.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}

export function NarratedCard({ spec, onComplete }: Props) {
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Which sentence within the current step is being spoken (-1 = not started)
  const [activeSentence, setActiveSentence] = useState(-1);
  // How many sentences in the current step are fully spoken
  const [revealedSentences, setRevealedSentences] = useState(0);
  // How many steps have been fully narrated (so previous steps show fully)
  const [completedSteps, setCompletedSteps] = useState(0);
  // Playback speed multiplier applied on top of BASE_RATE (1 = normal)
  const [speed, setSpeed] = useState<number>(1);

  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const stoppedRef = useRef(false);
  // Mirrors `speed` so in-flight utterance creation always reads the latest
  // value, even when the speed changes mid-step (state updates are async).
  const speedRef = useRef(speed);

  // Narration is self-referential: finishing a step schedules the next one.
  // Reached through a ref so the callback does not have to depend on itself.
  const speakStepRef = useRef<((sIdx: number) => void) | null>(null);

  // Cancel any ongoing speech and clean up
  const stopSpeech = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis?.cancel();
    utterancesRef.current = [];
  }, []);

  // Speak the sentences of the current step starting at `startAt`, then advance
  const speakStep = useCallback((sIdx: number, startAt = 0) => {
    if (!window.speechSynthesis) return;
    stoppedRef.current = false;

    const step = spec.steps[sIdx];
    if (!step) return;

    const sentences = toPlainSentences(step.body);
    // Also append the "why" text if present
    const allSentences = step.why
      ? [...sentences, step.why]
      : sentences;

    // Queue utterances
    allSentences.slice(startAt).forEach((text, offset) => {
      const i = startAt + offset;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = BASE_RATE * speedRef.current;
      utterance.pitch = 1;

      utterance.onstart = () => {
        if (stoppedRef.current) return;
        setActiveSentence(i);
      };

      utterance.onend = () => {
        if (stoppedRef.current) return;
        setRevealedSentences(i + 1);

        const isLastSentence = i === allSentences.length - 1;
        if (isLastSentence) {
          setCompletedSteps((c) => c + 1);
          setActiveSentence(-1);

          if (sIdx < spec.steps.length - 1) {
            // Brief pause before next step
            setTimeout(() => {
              if (stoppedRef.current) return;
              setStepIndex(sIdx + 1);
              setActiveSentence(-1);
              setRevealedSentences(0);
              speakStepRef.current?.(sIdx + 1);
            }, 600);
          } else {
            // All steps done
            setPlaying(false);
          }
        }
      };

      window.speechSynthesis.speak(utterance);
    });
  }, [spec.steps]);

  useEffect(() => {
    speakStepRef.current = speakStep;
  }, [speakStep]);

  const handlePlayPause = useCallback(() => {
    if (!window.speechSynthesis) return;

    if (playing) {
      window.speechSynthesis.pause();
      setPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlaying(true);
      } else {
        setPlaying(true);
        speakStep(stepIndex);
      }
    }
  }, [playing, speakStep, stepIndex]);

  // Change playback speed. If a step is actively being narrated, restart
  // the in-flight utterance at the new rate from the current sentence.
  const handleSpeedChange = useCallback(
    (nextSpeed: number) => {
      setSpeed(nextSpeed);
      speedRef.current = nextSpeed;

      if (playing) {
        stoppedRef.current = true;
        window.speechSynthesis?.cancel();
        speakStep(stepIndex, activeSentence === -1 ? 0 : activeSentence);
      }
    },
    [playing, activeSentence, stepIndex, speakStep],
  );

  // Skip narration of the current step and jump straight to the next one
  // (or finish the widget if this was the last step).
  const handleSkipAhead = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis?.cancel();

    const nextIndex = stepIndex + 1;
    setCompletedSteps((c) => Math.max(c, stepIndex + 1));
    setActiveSentence(-1);
    setRevealedSentences(0);

    if (nextIndex < spec.steps.length) {
      setStepIndex(nextIndex);
      if (playing) speakStep(nextIndex);
    } else {
      setPlaying(false);
    }
  }, [playing, stepIndex, speakStep, spec.steps.length]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => stopSpeech();
  }, [stopSpeech]);

  const allDone = completedSteps === spec.steps.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      {/* Step list */}
      <ul className="flex flex-col" aria-live="polite">
        {spec.steps.map((step, sIdx) => {
          const isCurrentStep = sIdx === stepIndex;
          const isCompleted = sIdx < completedSteps;
          const isUpcoming = sIdx > stepIndex;

          return (
            <li key={step.id} className={isUpcoming && !allDone ? 'opacity-30' : ''}>
              <div className="flex gap-4">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      isCompleted
                        ? 'bg-primary text-primary-foreground'
                        : isCurrentStep && playing
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? '✓' : sIdx + 1}
                  </div>
                  {sIdx < spec.steps.length - 1 && (
                    <div className="mt-1 w-0.5 flex-1 bg-border" aria-hidden="true" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-6 pt-0.5 min-w-0 flex-1">
                  <h3 className="mb-2 text-sm font-semibold text-foreground leading-snug">
                    {step.title}
                  </h3>

                  {(isCurrentStep || isCompleted) && (
                    <>
                      <HighlightedBody
                        body={step.body}
                        activeSentence={isCurrentStep ? activeSentence : 999}
                        revealedSentences={isCompleted ? 999 : revealedSentences}
                      />

                      {step.why && (isCompleted || revealedSentences >= toPlainSentences(step.body).length) && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                          <p className="text-sm text-amber-900 dark:text-amber-200">
                            <span className="font-semibold">Why? </span>
                            {step.why}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Controls */}
      {!allDone && (
        <div className="flex items-center gap-2">
          <Select value={String(speed)} onValueChange={(value) => handleSpeedChange(Number(value))}>
            <SelectTrigger className="w-24 text-sm" aria-label="Playback speed">
              <SelectValue>{(value: string) => `${value}x`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SPEED_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={handleSkipAhead}
          >
            Skip ahead ⏭
          </Button>
        </div>
      )}

      {allDone ? (
        <Button size="lg" className="w-full" onClick={() => onComplete?.(true)}>
          Continue to next section
        </Button>
      ) : (
        <Button size="lg" variant={playing ? 'outline' : 'default'} className="w-full" onClick={handlePlayPause}>
          {playing ? '⏸ Pause' : activeSentence === -1 && completedSteps === 0 ? '▶ Listen' : '▶ Resume'}
        </Button>
      )}
    </div>
  );
}
