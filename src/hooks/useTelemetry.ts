'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { InteractionEvent } from '@/lib/student/schema';

type TrackInput = Omit<InteractionEvent, 'elapsedMs'> & { elapsedMs?: number };

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
export function useTelemetry(sessionId: string | null, studentId: string | null) {
  const queue = useRef<InteractionEvent[]>([]);
  const mountedAt = useRef(Date.now());
  const lastEventAt = useRef(Date.now());

  const flush = useCallback(
    (useBeacon = false) => {
      if (!sessionId || !studentId || queue.current.length === 0) return;

      const events = queue.current.splice(0, MAX_BATCH);
      const body = JSON.stringify({ sessionId, studentId, events });

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
        return;
      }

      void fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    },
    [sessionId, studentId],
  );

  const track = useCallback(
    (event: TrackInput) => {
      const now = Date.now();
      queue.current.push({
        ...event,
        elapsedMs: event.elapsedMs ?? now - mountedAt.current,
      });
      lastEventAt.current = now;

      if (queue.current.length >= MAX_BATCH) flush();
    },
    [flush],
  );

  /** Records a long gap since the previous event — the "stuck" signal. */
  const trackHesitation = useCallback(
    (widgetKind: string, learningComponentId: string | null) => {
      const idleMs = Date.now() - lastEventAt.current;
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

  // The three functions are already stable; the object holding them has to be
  // too, or every consumer sees a new handle on each render.
  return useMemo(
    () => ({ track, trackHesitation, flush }),
    [track, trackHesitation, flush],
  );
}

export type Telemetry = ReturnType<typeof useTelemetry>;
