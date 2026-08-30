import type { HostBridge } from './host-bridge';

/**
 * What the student did, said into the conversation the widget is sitting in.
 *
 * This is the whole reason a widget in a chat beats a widget on a page. The
 * page can only record; the conversation can *respond*. A student finishes a
 * draft meter and Claude knows they finished, knows they took three attempts
 * to cite the passage, and can offer the next thing without being asked.
 *
 * Every widget already emits interaction events — they simply had nowhere to
 * go in here, since the shell provides no telemetry sink. So this is not new
 * instrumentation, only a destination for what was always being reported.
 *
 * Deliberately quiet: one message when the activity is finished, at most one
 * struggle signal before it, and nothing else. Narrating every keystroke
 * into the transcript would bury the conversation in a student's typing.
 */

type Event = {
  eventType: string;
  widgetKind?: string;
  standardCode?: string | null;
  correct?: boolean | null;
  payload?: Record<string, unknown>;
};

/** Reads naturally in a transcript: a sentence, not a log line. */
function describe(event: Event, attempts: number): string {
  const kind = event.widgetKind ?? 'activity';
  const standard = event.standardCode ? ` (${event.standardCode})` : '';

  const outcome =
    event.correct === true
      ? 'and got it right'
      : event.correct === false
        ? 'and got it wrong'
        : 'and finished it';

  const struggle =
    attempts > 2 ? ` It took ${attempts} attempts.` : attempts === 2 ? ' It took two attempts.' : '';

  const score = typeof event.payload?.score === 'number' ? ` Score: ${event.payload.score}.` : '';

  return `The student worked through the ${kind}${standard} ${outcome}.${struggle}${score}`;
}

/** How many consecutive wrong checks before the conversation hears about it early. */
const STRUGGLE_AFTER_WRONG = 3;

/**
 * Payload fields that mean "the student is advancing through a multi-part
 * widget". Crossword and friends emit `answer_checked` with `correct: false`
 * meaning "not finished yet" while these counters climb — that is progress,
 * not struggle, and must not trigger the early signal. Heuristic on purpose;
 * the durable fix is completion semantics on the registry entry, tracked in
 * the registry-owned-semantics refactor.
 */
const PROGRESS_FIELDS = ['solved', 'placed', 'matched', 'correctCount', 'revealed'] as const;

function progressReading(payload: Record<string, unknown> | undefined): number {
  if (!payload) return 0;
  let total = 0;
  for (const field of PROGRESS_FIELDS) {
    const value = payload[field];
    if (typeof value === 'number') total += value;
  }
  return total;
}

export function reportCompletionToHost(bridge: HostBridge) {
  let attempts = 0;
  let hints = 0;
  let wrongStreak = 0;
  let lastProgress = 0;
  let reported = false;
  let struggleReported = false;

  /** Shared base for both report shapes, so they cannot drift apart. */
  const resultBase = (event: Event) => ({
    kind: event.widgetKind ?? null,
    standardCode: event.standardCode ?? null,
    attempts,
    hintsUsed: hints,
  });

  return {
    track(event: Event) {
      // Every attempt at an answer counts, whatever the widget calls it.
      if (event.eventType === 'answer_checked' || event.eventType === 'attempt') {
        attempts += 1;

        const progress = progressReading(event.payload);
        if (event.correct === true || progress > lastProgress) {
          wrongStreak = 0;
        } else if (event.correct === false) {
          wrongStreak += 1;
        }
        lastProgress = Math.max(lastProgress, progress);
      }
      if (event.eventType === 'hint_requested') hints += 1;

      // One early signal, before the finish line: an agent that only hears
      // about completed work can never help with stuck work. Sent once, and
      // only for consecutive wrong checks with no visible progress — a slow
      // careful student, or one steadily solving a multi-part widget, is not
      // stuck.
      if (
        !reported &&
        !struggleReported &&
        event.eventType === 'answer_checked' &&
        event.correct === false &&
        wrongStreak >= STRUGGLE_AFTER_WRONG
      ) {
        struggleReported = true;
        void bridge.updateModelContext(
          `The student is still working through the ${event.widgetKind ?? 'activity'} and has checked ${attempts} answers without getting it yet. They have not asked for help.`,
          { type: 'widget_progress', ...resultBase(event), completed: false },
        );
      }

      if (event.eventType !== 'widget_completed' || reported) return;
      reported = true;

      // Prose for the model to respond to, plus the structured result — the
      // same shape the SDK's universal WidgetResult is converging on — so
      // exact fields survive without parsing English.
      void bridge.updateModelContext(describe(event, attempts), {
        type: 'widget_result',
        ...resultBase(event),
        completed: true,
        correct: event.correct ?? null,
        score: typeof event.payload?.score === 'number' ? event.payload.score : undefined,
        detail: event.payload ?? undefined,
      });
    },
    trackHesitation() {},
    flush() {},
    /**
     * A host can hand the same frame a new widget (a second tool result).
     * Counters describe one activity, so the shell calls this when the spec
     * changes — widget B must not inherit widget A's attempts, or its
     * already-reported silence.
     */
    reset() {
      attempts = 0;
      hints = 0;
      wrongStreak = 0;
      lastProgress = 0;
      reported = false;
      struggleReported = false;
    },
  };
}
