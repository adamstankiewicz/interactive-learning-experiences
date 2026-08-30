'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWidgetTelemetry } from '@/components/widgets/telemetry-context';
import type { WritingWorkshopSpec } from '@/lib/pathway/schema';
import type { Annotation, ReviewResult } from '@/lib/workshop/schema';

type Props = { spec: WritingWorkshopSpec; onComplete?: () => void };

/**
 * Long-form writing, marked up when the student asks for it.
 *
 * The deliberate opposite of Draft Meter. That widget scores three sentences
 * live, because a short answer is something you fiddle with. A thousand words
 * is something you think through, and a meter twitching while you draft a
 * paragraph is a hand on your shoulder. So nothing happens until the button.
 *
 * And the feedback lands *on the sentences*. A verdict under a long piece is
 * unactionable — the student agrees the evidence is thin and has no idea where.
 * Underlining the four places it is thin is the entire value.
 */

/** Split the draft at the annotation boundaries so each span can be drawn. */
function segment(text: string, annotations: Annotation[]) {
  const out: { text: string; annotation?: Annotation }[] = [];
  let cursor = 0;

  // `annotations` arrives sorted and non-overlapping from `withoutOverlaps`.
  for (const annotation of annotations) {
    if (annotation.start > cursor) out.push({ text: text.slice(cursor, annotation.start) });
    out.push({ text: text.slice(annotation.start, annotation.end), annotation });
    cursor = annotation.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });

  return out;
}

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export function WritingWorkshop({ spec, onComplete }: Props) {
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);
  /** The draft the marks belong to — the editor keeps changing under them. */
  const [markedDraft, setMarkedDraft] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      payload: { genre: spec.genre, targetWords: spec.targetWords },
    });
  }, [telemetry, spec]);

  const words = countWords(draft);
  const label = (id: string) => spec.lookFor.find((d) => d.id === id)?.label ?? id;

  const askForRead = useCallback(async () => {
    const text = draft.trim();
    if (!text || pending) return;

    const nextRound = round + 1;
    setPending(true);
    setError(null);
    setSelected(null);

    try {
      const response = await fetch('/api/workshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: text,
          brief: spec.brief,
          genre: spec.genre,
          dimensions: spec.lookFor,
          round: nextRound,
        }),
      });

      if (!response.ok) throw new Error('The review service did not answer.');
      const reviewed = (await response.json()) as ReviewResult;

      // Pinned together: the marks are offsets into *this* text, so the view
      // must render the draft that was read, not whatever is in the editor by
      // the time the response lands.
      setResult(reviewed);
      setMarkedDraft(text);
      setRound(nextRound);

      telemetry.track({
        eventType: 'answer_checked',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        // A draft is not right or wrong; a verdict here would be a category error.
        correct: null,
        payload: {
          round: nextRound,
          words: countWords(text),
          strengths: reviewed.annotations.filter((a) => a.kind === 'strength').length,
          weaknesses: reviewed.annotations.filter((a) => a.kind === 'weakness').length,
          // Worth watching: a rising count means the model is paraphrasing
          // quotes and the marks are quietly getting thinner.
          unplaced: reviewed.unplaced.length,
        },
      });

      onComplete?.();
      if (completedRef.current) return;
      completedRef.current = true;

      telemetry.track({
        eventType: 'widget_completed',
        widgetKind: spec.kind,
        learningComponentId: spec.learningComponentId,
        standardCode: telemetry.standardCode,
        correct: null,
        payload: { rounds: nextRound, words: countWords(text) },
      });
      telemetry.flush();
    } catch {
      // The draft stays exactly where it is: losing a student's writing to a
      // failed request is far worse than the failure.
      setError('Could not get a read on that. Your draft is safe — try again.');
    } finally {
      setPending(false);
    }
  }, [draft, pending, round, spec, telemetry, onComplete]);

  const segments = useMemo(
    () => (result ? segment(markedDraft, result.annotations) : []),
    [result, markedDraft],
  );

  const reviewing = result !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{spec.prompt}</p>

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {spec.brief.title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed">{spec.brief.task}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {spec.genre} · about {spec.targetWords} words
        </p>
      </div>

      {!reviewing ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={spec.placeholder}
          rows={14}
          disabled={pending}
          className="block min-h-[320px] w-full resize-y rounded-lg border border-input bg-transparent p-4 font-serif text-[15px] leading-[1.65] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm leading-[1.9] whitespace-pre-wrap">
            {segments.map((piece, index) =>
              piece.annotation ? (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setSelected((current) =>
                      current === result!.annotations.indexOf(piece.annotation!)
                        ? null
                        : result!.annotations.indexOf(piece.annotation!),
                    )
                  }
                  className={`cursor-pointer rounded-sm underline decoration-2 underline-offset-4 transition-colors ${
                    piece.annotation.kind === 'strength'
                      ? 'decoration-success hover:bg-success/10'
                      : 'decoration-warning hover:bg-warning/10'
                  } ${
                    selected === result!.annotations.indexOf(piece.annotation)
                      ? piece.annotation.kind === 'strength'
                        ? 'bg-success/15'
                        : 'bg-warning/15'
                      : ''
                  }`}
                >
                  {piece.text}
                </button>
              ) : (
                <span key={index}>{piece.text}</span>
              ),
            )}
          </p>
        </div>
      )}

      {reviewing && result && (
        <div className="flex flex-col gap-3">
          {/*
            Clicking a mark opens its note here rather than in a tooltip: the
            comments run to a sentence or two, and a student re-reading their
            own paragraph should not have to keep a popover alive to do it.
          */}
          {selected !== null && result.annotations[selected] && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
                result.annotations[selected]!.kind === 'strength'
                  ? 'border-success/40 bg-success/10'
                  : 'border-warning/40 bg-warning/10'
              }`}
            >
              <span className="text-xs font-semibold tracking-wide uppercase">
                {result.annotations[selected]!.kind === 'strength' ? 'Works' : 'Needs a look'} ·{' '}
                {label(result.annotations[selected]!.dimensionId)}
              </span>
              <p className="mt-1">{result.annotations[selected]!.comment}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {result.annotations.filter((a) => a.kind === 'strength').length} passages working ·{' '}
            {result.annotations.filter((a) => a.kind === 'weakness').length} to look at · tap an
            underline to read the note
          </p>

          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed">
            {result.overall}
            {result.nextStep && (
              <p className="mt-2">
                <span className="font-medium">Next: </span>
                {result.nextStep}
              </p>
            )}
          </div>

          {/* Real feedback that could not be pinned to a sentence. Shown rather
              than dropped — it is still a note the student should read. */}
          {result.unplaced.length > 0 && (
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                On the piece as a whole
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {result.unplaced.map((note, index) => (
                  <li key={index} className="text-sm leading-relaxed">
                    {note.comment}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!reviewing ? (
          <Button size="sm" onClick={askForRead} disabled={!draft.trim() || pending}>
            {pending ? 'Reading…' : round === 0 ? 'Ask for a read' : 'Ask for another read'}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setResult(null)}>
            Back to editing
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {words} {words === 1 ? 'word' : 'words'}
          {round > 0 && ` · read ${round}`}
        </span>
      </div>

      {error && (
        <p role="status" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
