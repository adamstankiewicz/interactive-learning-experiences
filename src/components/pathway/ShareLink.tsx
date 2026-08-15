'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Appears once a generated pathway has a persisted `sessionId` — the payoff
 * of Phase 2.5's write-path fix: `/learn/[sessionId]` reads this back and
 * shows the *same* reviewed pathway, not a fresh generation, so this link is
 * the actual thing a teacher hands to a class.
 */
export function ShareLink({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);
  const href = `/learn/${sessionId}`;

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
