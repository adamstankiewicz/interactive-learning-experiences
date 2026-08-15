'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { SessionSummary } from '@/lib/storage/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function GradePill({ grade }: { grade: string | null }) {
  if (!grade) return null;
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
      Grade {grade}
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SessionCard({ session }: { session: SessionSummary }) {
  return (
    <Link
      href={`/pathways/${session.id}`}
      className="group block rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-snug group-hover:text-primary transition-colors">
            {session.topic}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {session.standardCode && (
              <span className="text-xs font-mono text-muted-foreground">{session.standardCode}</span>
            )}
            <GradePill grade={session.gradeHint} />
            <span className="text-xs text-muted-foreground">{formatDate(session.createdAt)}</span>
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground text-sm group-hover:text-primary transition-colors">→</span>
      </div>

      <div className="mt-4 flex items-center gap-6 border-t border-border pt-4">
        <StatBox label="opens" value={session.openCount} />
        <StatBox label="completions" value={session.completionCount} />
        {session.openCount > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold tabular-nums">
              {Math.round((session.completionCount / session.openCount) * 100)}%
            </span>
            <span className="text-xs text-muted-foreground">completion</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
      ))}
    </div>
  );
}

export function PathwaysDashboard() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pathway/sessions?limit=50')
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => setError('Failed to load pathways.'));
  }, []);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (!sessions) return <LoadingSkeleton />;

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No pathways yet. Build one from the Pathway Builder.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to Pathway Builder
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}
