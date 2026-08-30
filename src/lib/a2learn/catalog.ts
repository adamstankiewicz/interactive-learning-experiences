import type { A2UISurfaceMessage } from '@/lib/a2learn/a2ui';

/**
 * The a2learn catalog, in draft: the registry projected as an A2UI custom
 * catalog, one component per widget kind, the kind's spec as its properties.
 *
 * This is the full-fidelity tier of the two-tier delivery story (#98). The
 * basic-catalog mapping in `a2ui.ts` is what any A2UI renderer can draw; a
 * surface written against *this* catalog renders with complete mechanics on
 * any host that implements it — the app's own component registry is the
 * reference implementation.
 *
 * Draft means draft: the id is a URN, not a fetchable schema URL, and no
 * conformance suite validates these surfaces yet. The versioned catalog
 * contract — served schema, vendoring rules, props schemas generated from
 * the registry's Zod specs so catalog and registry cannot drift — lands via
 * #98 and is a contract change in its own right. Until then nothing outside
 * this repo should program against this shape, and the demo that renders it
 * says so.
 */
export const A2LEARN_CATALOG_DRAFT = 'urn:a2learn:catalog:draft';

/** Component name for a kind: `a2learn:flashcard`, `a2learn:drag-sort`, … */
export function catalogComponentFor(kind: string): string {
  return `a2learn:${kind}`;
}

/**
 * Any valid widget spec projects — parity with the registry is by
 * construction, not per-kind mapping work. Returns null only when the value
 * has no `kind` to dispatch on.
 */
export function toA2LearnSurface(spec: unknown, surfaceId: string): A2UISurfaceMessage | null {
  if (!spec || typeof spec !== 'object' || !('kind' in spec) || typeof spec.kind !== 'string') {
    return null;
  }
  return {
    version: 'v1.0',
    createSurface: {
      surfaceId,
      catalogId: A2LEARN_CATALOG_DRAFT,
      components: [
        {
          id: 'root',
          component: catalogComponentFor(spec.kind),
          spec,
        },
      ],
    },
  };
}
