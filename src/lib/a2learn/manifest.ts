import type { WidgetKind } from '@/lib/pathway/schema';
import type { StandardRef } from '@/lib/standards/types';

/**
 * The a2learn layer, as code rather than only prose.
 *
 * An activity travels as two documents: a *surface* (how it renders — see
 * `a2ui.ts`, a profile of Google's A2UI) and this *manifest* (what it
 * teaches, whether it measures, where it came from, and exactly how to
 * build it). The manifest is the half an agent reads before deciding, and
 * the half a marketplace listing is made of.
 *
 * Format-versioned independently of the app: consumers pin `a2learn`, not
 * our release number.
 */

export const A2LEARN_VERSION = '0.1.0';

/** Namespace for a2learn event names on any transport (AG-UI custom events,
 *  A2UI actions): `a2learn.<domain event>`. Owned here, not in a route. */
export const A2LEARN_EVENT_PREFIX = 'a2learn.';

export type ActivityManifest = {
  /** Manifest format version — semver, bumped by RFC, not by refactor. */
  a2learn: string;
  title: string;
  /** The verified standard this activity teaches — or the honest absence. */
  standard: {
    code: string;
    verified: boolean;
    /** Which graph verified it, e.g. "Learning Commons". */
    source: string;
    description?: string;
  };
  pedagogy: {
    /** Widget kind from the registry. */
    kind: WidgetKind;
    /** Whether completing this activity records a real verdict. */
    assesses: boolean;
  };
  /** BCP-47. Generation is English-first today; the field exists so the
      format never has to break to say otherwise. */
  language: string;
  provenance: {
    generatedAt: string;
    /** Codes proposed and rejected by the graph — kept on the record. */
    rejectedCodes: string[];
  };
  /** The exact call that manufactures this activity — find → invoke. */
  invoke: {
    tool: 'show_widget';
    arguments: Record<string, unknown>;
  };
};

/**
 * No producer calls this yet — it gains one in phase 2, when find_activity's
 * listing shape converges here. Until then the conformance suite pins the
 * A2UI half; this half is pinned by tsc only. `assesses` must equal the
 * registry entry's flag for `kind` — the caller that owns the registry
 * lookup passes it, so this module stays importable without dragging every
 * widget definition into its bundle.
 */
export function buildManifest(input: {
  title: string;
  standard: StandardRef;
  kind: WidgetKind;
  assesses: boolean;
  language?: string;
  rejectedCodes?: string[];
  invokeArguments: Record<string, unknown>;
}): ActivityManifest {
  return {
    a2learn: A2LEARN_VERSION,
    title: input.title,
    standard: {
      code: input.standard.code,
      verified: input.standard.verified,
      source: input.standard.sourceLabel,
      description: input.standard.description,
    },
    pedagogy: { kind: input.kind, assesses: input.assesses },
    language: input.language ?? 'en',
    provenance: {
      generatedAt: new Date().toISOString(),
      rejectedCodes: input.rejectedCodes ?? [],
    },
    invoke: { tool: 'show_widget', arguments: input.invokeArguments },
  };
}
