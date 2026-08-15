'use client';

import { useEffect, useState } from 'react';

import type { SessionStudentRow } from '@/lib/storage/types';

function formatMs(ms: number | null) {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function AccuracyBar({ correct, attempts }: { correct: number; attempts: number }) {
  if (attempts === 0) return <span className="text-muted-foreground text-sm">—</span>;
  const pct = Math.round((correct / attempts) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-sm">{pct}%</span>
    </div>
  );
}

function StudentName({ row }: { row: SessionStudentRow }) {
  if (row.rosterStudentName) {
    return <span className="font-medium">{row.rosterStudentName}</span>;
  }
  return (
    <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">
      {row.studentId.slice(0, 12)}…
    </span>
  );
}

function StatusBadge({ completed }: { completed: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        completed
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      }`}
    >
      {completed ? 'Completed' : 'In Progress'}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-accent animate-pulse" />
      ))}
    </div>
  );
}

export function SessionReport({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<SessionStudentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pathway/sessions/${sessionId}/report`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setError('Failed to load report.'));
  }, [sessionId]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!rows) return <LoadingSkeleton />;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-muted-foreground">No students have opened this pathway yet.</p>
      </div>
    );
  }

  // Sort: rostered first, then by last seen desc
  const sorted = [...rows].sort((a, b) => {
    if (a.rosterStudentName && !b.rosterStudentName) return -1;
    if (!a.rosterStudentName && b.rosterStudentName) return 1;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-accent/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Accuracy</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Attempts</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Hints</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Median time</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row) => (
            <tr key={row.studentId} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-3">
                <StudentName row={row} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge completed={row.completed} />
              </td>
              <td className="px-4 py-3">
                <AccuracyBar correct={row.correctCount} attempts={row.attempts} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{row.attempts}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.hintsUsed || '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatMs(row.medianElapsedMs)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {formatDate(row.lastSeenAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
