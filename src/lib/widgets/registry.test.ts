import { describe, expect, it } from 'vitest';

import { widgetKind } from '@/lib/pathway/schema';
import '@/lib/widgets/builtins';
import { listWidgetCatalogEntries } from '@/lib/widgets/types';

/**
 * The registry is open but `widgetKind`/`widgetSpec` in `pathway/schema.ts`
 * are static (see the comment atop `lib/widgets/types.ts`) — adding a kind
 * means touching both, and nothing at compile time enforces that they agree.
 * This test is that enforcement.
 */
describe('widget registry ↔ schema union', () => {
  const registered = listWidgetCatalogEntries()
    .map((entry) => entry.kind)
    .sort();
  const declared = [...widgetKind.options].sort();

  it('every registered kind is in the widgetKind enum', () => {
    expect(declared).toEqual(expect.arrayContaining(registered));
  });

  it('every declared kind has a registered catalog entry', () => {
    expect(registered).toEqual(expect.arrayContaining(declared));
  });
});

describe('catalog entries', () => {
  const entries = listWidgetCatalogEntries();

  it('registers the full built-in set', () => {
    expect(entries.length).toBeGreaterThanOrEqual(16);
  });

  it.each(listWidgetCatalogEntries().map((entry) => [entry.kind, entry] as const))(
    '%s carries what the planner and walkthrough need',
    (_kind, entry) => {
      expect(entry.plannerDescription.length).toBeGreaterThan(20);
      expect(typeof entry.assesses).toBe('boolean');
      expect(entry.schema).toBeDefined();
      expect(entry.component).toBeDefined();
    },
  );
});
