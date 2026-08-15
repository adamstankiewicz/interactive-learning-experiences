'use client';

import { createContext, useContext, useMemo } from 'react';

import type { Telemetry } from '@/hooks/useTelemetry';

/**
 * Widgets emit interaction events through context rather than props.
 *
 * That keeps `WidgetRenderer({ spec })` unchanged, so the teacher-facing
 * pathway page needs no edits and renders widgets with telemetry inert. Only
 * the student experience wraps them in a provider.
 */
const NOOP: Telemetry = {
  track: () => {},
  trackHesitation: () => {},
  flush: () => {},
};

type WidgetTelemetry = Telemetry & { standardCode: string | null };

const WidgetTelemetryContext = createContext<WidgetTelemetry>({
  ...NOOP,
  standardCode: null,
});

export function WidgetTelemetryProvider({
  telemetry,
  standardCode,
  stepIndex,
  children,
}: {
  telemetry: Telemetry;
  standardCode: string | null;
  /** Current step index — injected into widget_completed events so the server
   *  knows which step to remediate without loading the full session on every flush. */
  stepIndex: number;
  children: React.ReactNode;
}) {
  const value = useMemo<WidgetTelemetry>(() => ({
    ...telemetry,
    standardCode,
    track(event) {
      telemetry.track(
        event.eventType === 'widget_completed'
          ? { ...event, stepIndex }
          : event,
      );
    },
  }), [telemetry, standardCode, stepIndex]);

  return (
    <WidgetTelemetryContext.Provider value={value}>
      {children}
    </WidgetTelemetryContext.Provider>
  );
}

export function useWidgetTelemetry(): WidgetTelemetry {
  return useContext(WidgetTelemetryContext);
}
