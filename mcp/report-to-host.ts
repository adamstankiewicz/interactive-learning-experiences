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
 * Deliberately quiet: one message when the activity is finished, and nothing
 * else. Narrating every keystroke into the transcript would bury the
 * conversation in a student's typing, which is the same mistake the meter
 * itself was tuned away from.
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

/** How many failed checks before the conversation hears about it early. */
const STRUGGLE_AFTER_ATTEMPTS = 3;

export function reportCompletionToHost(bridge: HostBridge) {
  let attempts = 0;
  let hints = 0;
  let reported = false;
  let struggleReported = false;

  return {
    track(event: Event) {
      // Every attempt at an answer counts, whatever the widget calls it.
      if (event.eventType === 'answer_checked' || event.eventType === 'attempt') attempts += 1;
      if (event.eventType === 'hint_requested') hints += 1;

      // One early signal, before the finish line: an agent that only hears
      // about completed work can never help with stuck work. Sent once, only
      // for repeated *wrong* checks — a slow careful student is not stuck.
      if (
        !reported &&
        !struggleReported &&
        event.eventType === 'answer_checked' &&
        event.correct === false &&
        attempts >= STRUGGLE_AFTER_ATTEMPTS
      ) {
        struggleReported = true;
        void bridge.updateModelContext(
          `The student is still working through the ${event.widgetKind ?? 'activity'} and has checked ${attempts} answers without getting it yet. They have not asked for help.`,
          {
            type: 'widget_progress',
            kind: event.widgetKind ?? null,
            standardCode: event.standardCode ?? null,
            attempts,
            hintsUsed: hints,
            completed: false,
          },
        );
      }

      if (event.eventType !== 'widget_completed' || reported) return;
      reported = true;

      // Prose for the model to respond to, plus the structured result — the
      // same shape the SDK's universal WidgetResult is converging on — so
      // exact fields survive without parsing English.
      void bridge.updateModelContext(describe(event, attempts), {
        type: 'widget_result',
        kind: event.widgetKind ?? null,
        standardCode: event.standardCode ?? null,
        completed: true,
        correct: event.correct ?? null,
        attempts,
        hintsUsed: hints,
        score: typeof event.payload?.score === 'number' ? event.payload.score : undefined,
        detail: event.payload ?? undefined,
      });
    },
    trackHesitation() {},
    flush() {},
  };
}
