'use client';

import { createContext, useContext } from 'react';

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
  children,
}: {
  telemetry: Telemetry;
  standardCode: string | null;
  children: React.ReactNode;
}) {
  return (
    <WidgetTelemetryContext.Provider value={{ ...telemetry, standardCode }}>
      {children}
    </WidgetTelemetryContext.Provider>
  );
}

export function useWidgetTelemetry(): WidgetTelemetry {
  return useContext(WidgetTelemetryContext);
}
