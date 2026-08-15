'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';

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
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">Share with students</p>
        <p className="truncate text-xs text-muted-foreground">{href}</p>
        {stats && (stats.openCount > 0 || stats.completionCount > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.openCount} student{stats.openCount === 1 ? '' : 's'} opened this
            {stats.completionCount > 0 && (
              <> · {stats.completionCount} finished it</>
            )}
          </p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? (
          <>
            <Check className="size-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copy link
          </>
        )}
      </Button>
    </div>
  );
}
