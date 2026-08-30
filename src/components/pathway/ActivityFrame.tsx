'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * The chrome that wraps every activity kind (design 1h): a 2px border in the
 * activity's edge hue, a header bar on its tint with a fill-hue marker bar,
 * the title, and a state slot. The body belongs entirely to the activity —
 * it never draws its own header or picks its own radius.
 *
 * The guest hue renders through `.activity-skin` (globals.css): four derived
 * colors from one hue at fixed lightness/chroma, so any hue keeps AA
 * contrast. The hue appears only on this frame and the activity's own skin,
 * never on page chrome.
 *
 * Hue source: the design calls for a model-chosen hue on the widget spec.
 * Until that field ships, the hue derives deterministically from the kind —
 * stable across renders, mapped around the 85–130° band the brand highlighter
 * and warning amber reserve.
 */
const RESERVED_START = 85;
const RESERVED_END = 130;

function safeHue(x: number): number {
  const span = 360 - (RESERVED_END - RESERVED_START);
  let v = (x - RESERVED_END) % span;
  if (v < 0) v += span;
  return (RESERVED_END + v) % 360;
}

export function hueForActivity(kind: string, explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return safeHue(explicit);
  let h = 0x811c9dc5;
  for (let i = 0; i < kind.length; i += 1) {
    h ^= kind.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return safeHue((h >>> 0) % 360);
}

export function kindLabel(kind: string): string {
  return kind.replace(/-/g, ' ');
}

export function ActivityFrame({
  kind,
  title,
  hue,
  state,
  children,
}: {
  kind: string;
  title: string;
  /** Model-chosen hue when the spec carries one; falls back to a stable per-kind hue. */
  hue?: number;
  /** Right-hand header slot — completion state, a review badge. */
  state?: ReactNode;
  children: ReactNode;
}) {
  const activityHue = hueForActivity(kind, hue);

  return (
    <div
      className="activity-skin w-full overflow-hidden rounded-[18px] border-2 bg-card"
      style={{ '--activity-h': activityHue, borderColor: 'var(--activity-edge)' } as CSSProperties}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ background: 'var(--activity-tint)' }}
      >
        <span
          aria-hidden="true"
          className="h-5 w-2 shrink-0 rounded-full"
          style={{ background: 'var(--activity-fill)' }}
        />
        <span className="min-w-0 flex-1 truncate font-heading text-base font-bold">{title}</span>
        <span
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--activity-text)' }}
        >
          {kindLabel(kind)}
        </span>
        {state}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
