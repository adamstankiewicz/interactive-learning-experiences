'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { InteractionEvent } from '@/lib/student/schema';

type TrackInput = Omit<InteractionEvent, 'elapsedMs'> & { elapsedMs?: number };

export type RemediationPayload = { insertAt: number; widget: unknown };

const FLUSH_INTERVAL_MS = 4_000;
const MAX_BATCH = 50;

/**
 * Buffers interaction events and posts them to /api/telemetry.
 *
 * Two details carry most of the signal quality:
 *  - elapsedMs is measured from hook mount, i.e. from when the widget appeared,
 *    so response latency and hesitation need no arithmetic at the call site.
 *  - the final flush uses sendBeacon, so events survive the tab closing
 *    mid-activity — which is precisely the abandonment signal worth having.
 *
 * Telemetry never blocks or breaks the lesson: every failure path is swallowed.
 */
export function useTelemetry(
  sessionId: string | null,
  studentId: string | null,
  onRemediation?: (payload: RemediationPayload) => void,
  currentStep?: number,
) {
  const queue = useRef<InteractionEvent[]>([]);
  // The clock is read from an effect, not the render body: `Date.now()` is
  // impure, and the render body runs (and is expected to be side-effect-free)
  // more often than the mount it is meant to time from. `track`/`flush` below
  // fall back to `now` when a call somehow lands before the effect has run.
  const mountedAt = useRef<number | undefined>(undefined);
  const lastEventAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    mountedAt.current = Date.now();
    lastEventAt.current = mountedAt.current;
  }, []);

  // Kept current via an effect rather than a direct render-body assignment —
  // both refs are only ever read later (inside `flush`'s callbacks), never
  // during this same render, so the one-tick-later sync an effect implies
  // costs nothing here and keeps the assignment out of the render body.
  const onRemediationRef = useRef(onRemediation);
  useEffect(() => {
    onRemediationRef.current = onRemediation;
  });

  // Ref so flush() always reads the latest step without needing to be recreated.
  const currentStepRef = useRef(currentStep);
  useEffect(() => {
    currentStepRef.current = currentStep;
  });

  const flush = useCallback(
    (useBeacon = false) => {
      if (!sessionId || !studentId || queue.current.length === 0) return;

      const events = queue.current.splice(0, MAX_BATCH);
      const body = JSON.stringify({ sessionId, studentId, events, currentStep: currentStepRef.current });

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
        return;
      }

      void fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok || !onRemediationRef.current) return;
          const json = await res.json().catch(() => null) as { remediation?: RemediationPayload } | null;
          if (json?.remediation) onRemediationRef.current(json.remediation);
        })
        .catch(() => {});
    },
    [sessionId, studentId],
  );

  const track = useCallback(
    (event: TrackInput) => {
      const now = Date.now();
      queue.current.push({
        ...event,
        // Falls back to 0 elapsed on the vanishingly unlikely event a track()
        // call beats the mount effect — never negative or NaN, just unmeasured.
        elapsedMs: event.elapsedMs ?? now - (mountedAt.current ?? now),
      });
      lastEventAt.current = now;

      if (queue.current.length >= MAX_BATCH) flush();
    },
    [flush],
  );

  /** Records a long gap since the previous event — the "stuck" signal. */
  const trackHesitation = useCallback(
    (widgetKind: string, learningComponentId: string | null) => {
      const idleMs = Date.now() - (lastEventAt.current ?? Date.now());
      if (idleMs < 4_000) return;

      track({
        eventType: 'hesitation',
        widgetKind,
        learningComponentId,
        standardCode: null,
        correct: null,
        payload: { idleMs },
      });
    },
    [track],
  );

  useEffect(() => {
    const timer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      flush(true);
    };
  }, [flush]);

  return { track, trackHesitation, flush };
}

export type Telemetry = ReturnType<typeof useTelemetry>;
