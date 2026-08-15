'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

type Stats = { openCount: number; completionCount: number };

/**
 * Appears once a generated pathway has a persisted `sessionId` — the payoff
 * of Phase 2.5's write-path fix: `/learn/[sessionId]` reads this back and
 * shows the *same* reviewed pathway, not a fresh generation, so this link is
 * the actual thing a teacher hands to a class.
 *
 * The counts underneath are the other half of that payoff: a teacher who
 * shares a link and never hears anything back has no idea it worked. Polls
 * rather than pushing — a plain counter doesn't need a websocket.
 *
 * Unstyled at the root — it sits inside `PathwayCompletionStrip`'s box
 * rather than owning its own, so the two don't nest as double-bordered cards.
 */
export function ShareLink({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const href = `/learn/${sessionId}`;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/pathway/session/${sessionId}/stats`);
        if (!response.ok || cancelled) return;
        setStats((await response.json()) as Stats);
      } catch {
        // Best-effort — the link itself still works without this.
      }
    }

    void poll();
    const id = setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId]);

  async function copy() {
    try {
      const url = `${window.location.origin}${href}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the link is still visible and selectable below.
    }
  }

  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-violet-600 dark:text-violet-300">Share with students</p>
        <p className="truncate text-xs text-muted-foreground">{href}</p>
        {stats && (stats.openCount > 0 || stats.completionCount > 0) && (
          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {stats.openCount} student{stats.openCount === 1 ? '' : 's'} opened this
            {stats.completionCount > 0 && (
              <> · {stats.completionCount} finished it</>
            )}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-[0_4px_0_0_#5b21b6] transition-transform active:translate-y-1 active:shadow-[0_1px_0_0_#5b21b6]',
          copied ? 'bg-emerald-500 shadow-[0_4px_0_0_#047857] active:shadow-[0_1px_0_0_#047857]' : 'bg-violet-500 hover:bg-violet-400',
        )}
      >
        {copied ? (
          <>
            <Check className="size-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copy link
          </>
        )}
      </button>
    </>
  );
}
