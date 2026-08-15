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
  children,
}: {
  telemetry: Telemetry;
  standardCode: string | null;
  children: React.ReactNode;
}) {
  // A fresh object here would re-render every widget on the surface whenever
  // the page re-rendered, and would re-fire any widget effect that depends on
  // the telemetry handle — the draft meter's scoring call among them.
  const value = useMemo(
    () => ({ ...telemetry, standardCode }),
    [telemetry, standardCode],
  );

  return (
    <WidgetTelemetryContext.Provider value={value}>{children}</WidgetTelemetryContext.Provider>
  );
}

export function useWidgetTelemetry(): WidgetTelemetry {
  return useContext(WidgetTelemetryContext);
}
