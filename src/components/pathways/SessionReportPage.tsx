'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PathwayPreview, type PathwayPreviewData } from '@/components/pathways/PathwayPreview';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { SessionStudentRow, StepOutcome } from '@/lib/storage/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChildSession = {
  assignmentId: string;
  sessionId: string;
  rosterStudentId: string;
  rosterStudentName: string | null;
  topic: string;
  createdAt: string;
  plan: PathwayPlan | null;
  stepWidgets: Record<number, unknown>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number | null) {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Performance table
// ---------------------------------------------------------------------------

function AccuracyBar({ correct, attempts }: { correct: number; attempts: number }) {
  if (attempts === 0) return <span className="text-muted-foreground text-sm">—</span>;
  const pct = Math.round((correct / attempts) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-accent">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-sm">{pct}%</span>
    </div>
  );
}

/**
 * The per-step evidence strip (design 1e): one cell per plan step. Verified
 * fill = first try, warning edge = needed attempts, error = still wrong,
 * sunk = not reached (which also covers events recorded before stepIndex was
 * persisted — the strip never guesses). Each cell carries its word in the
 * tooltip and for screen readers.
 */
const STRIP_CELL: Record<StepOutcome, { className: string; label: string }> = {
  'first-try': { className: 'bg-verified', label: 'first try' },
  attempts: { className: 'border border-warning-edge bg-warning-tint', label: 'needed attempts' },
  wrong: { className: 'bg-destructive', label: 'still wrong' },
  unreached: { className: 'bg-sunk', label: 'not reached' },
};

function StepStrip({ strip }: { strip: StepOutcome[] }) {
  if (strip.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1">
      {strip.map((outcome, index) => (
        <span
          key={`${index}-${outcome}`}
          role="img"
          aria-label={`Step ${index + 1}: ${STRIP_CELL[outcome].label}`}
          title={`Step ${index + 1}: ${STRIP_CELL[outcome].label}`}
          className={`h-3 w-4 ${STRIP_CELL[outcome].className}`}
        />
      ))}
    </span>
  );
}

export function StepStripLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {(Object.keys(STRIP_CELL) as StepOutcome[]).map((outcome) => (
        <span key={outcome} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2.5 w-3.5 ${STRIP_CELL[outcome].className}`} />
          {STRIP_CELL[outcome].label}
        </span>
      ))}
    </div>
  );
}

/**
 * The report's four figures (design 1e): opens, completed, completion %, and
 * remediations — the last in the warning colour, because it is the number
 * that asks for the teacher's attention. Remediations are counted as widgets
 * the server injected beyond the plan's own steps.
 */
function ReportFigures({
  rows,
  childSessions,
}: {
  rows: SessionStudentRow[] | null;
  childSessions: ChildSession[] | null;
}) {
  const opens = rows?.length ?? null;
  const completed = rows ? rows.filter((row) => row.completed).length : null;
  const completion =
    opens != null && completed != null && opens > 0
      ? `${Math.round((completed / opens) * 100)}%`
      : null;
  const remediations = childSessions
    ? childSessions.reduce(
        (sum, child) =>
          sum +
          Math.max(0, Object.keys(child.stepWidgets).length - (child.plan?.steps.length ?? 0)),
        0,
      )
    : null;

  const figures: { label: string; value: string; warning?: boolean }[] = [
    { label: 'Opens', value: opens != null ? String(opens) : '—' },
    { label: 'Completed', value: completed != null ? String(completed) : '—' },
    { label: 'Completion', value: completion ?? '—' },
    {
      label: 'Remediations',
      value: remediations != null ? String(remediations) : '—',
      warning: remediations != null && remediations > 0,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 border border-border bg-card sm:grid-cols-4">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="border-b border-r border-border p-3.5 last:border-r-0 sm:border-b-0 nth-2:border-r-0 sm:nth-2:border-r"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {figure.label}
          </p>
          <p
            className={`mt-1 font-heading text-[26px] font-bold tabular-nums ${
              figure.warning ? 'text-warning' : 'text-foreground'
            }`}
          >
            {figure.warning && <span aria-hidden>⚠ </span>}
            {figure.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ completed }: { completed: boolean }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${completed
      ? 'border-verified-edge bg-verified-tint text-verified'
      : 'border-warning-edge bg-warning-tint text-warning'}`}>
      {completed ? '✓ Completed' : 'In progress'}
    </span>
  );
}

function PerformanceTable({ rows, children }: { rows: SessionStudentRow[]; children: (row: SessionStudentRow) => React.ReactNode }) {
  const sorted = [...rows].sort((a, b) => {
    if (a.rosterStudentName && !b.rosterStudentName) return -1;
    if (!a.rosterStudentName && b.rosterStudentName) return 1;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-muted-foreground">No students have opened this pathway yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="border-b border-border px-4 py-2">
        <StepStripLegend />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-accent/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Steps</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Accuracy</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Attempts</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Hints</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Median time</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Last seen</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row) => (
            <tr key={row.studentId} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-3">
                {row.rosterStudentName
                  ? <span className="font-medium">{row.rosterStudentName}</span>
                  : <span className="font-mono text-xs text-muted-foreground">{row.studentId.slice(0, 12)}…</span>}
              </td>
              <td className="px-4 py-3"><StatusBadge completed={row.completed} /></td>
              <td className="px-4 py-3"><StepStrip strip={row.stepStrip} /></td>
              <td className="px-4 py-3"><AccuracyBar correct={row.correctCount} attempts={row.attempts} /></td>
              <td className="px-4 py-3 text-right tabular-nums">{row.attempts}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.hintsUsed || '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMs(row.medianElapsedMs)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{formatDate(row.lastSeenAt)}</td>
              <td className="px-4 py-3 text-right">{children(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student pathway drawer
// ---------------------------------------------------------------------------

function StudentPathwayDrawer({ child }: { child: ChildSession }) {
  const [open, setOpen] = useState(false);

  const previewData: PathwayPreviewData | null =
    child.plan ? { plan: child.plan, stepWidgets: child.stepWidgets } : null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{child.rosterStudentName ?? 'Unknown student'}</span>
          <span className="text-xs text-muted-foreground">{child.topic}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/learn/${child.sessionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open →
          </Link>
          <span className="text-muted-foreground text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-border p-4">
            {previewData ? (
              <PathwayPreview data={previewData} />
            ) : (
              <p className="text-sm text-muted-foreground">No pathway data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function SessionReportPage({
  sessionId,
  parentPreview,
}: {
  sessionId: string;
  parentPreview: PathwayPreviewData | null;
}) {
  const [tab, setTab] = useState<'Performance' | 'Students' | 'Preview'>('Performance');
  const [reportRows, setReportRows] = useState<SessionStudentRow[] | null>(null);
  const [children, setChildren] = useState<ChildSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const json = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} responded ${res.status}`);
      return res.json();
    };

    Promise.all([
      json(`/api/pathway/sessions/${sessionId}/report`),
      json(`/api/pathway/sessions/${sessionId}/children`),
    ])
      .then(([rows, kids]) => {
        setReportRows(rows);
        setChildren(kids);
      })
      .catch(() => setError('Failed to load data.'));
  }, [sessionId]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  const tabs: ('Performance' | 'Students' | 'Preview')[] = ['Performance', 'Students', 'Preview'];

  // Map rosterStudentId → child session for linking from performance table
  const childByRosterId = new Map<string, ChildSession>(
    (children ?? []).map((c) => [c.rosterStudentId, c]),
  );

  return (
    <div>
      <ReportFigures rows={reportRows} childSessions={children} />
      <TabBar tabs={tabs} active={tab} onChange={(t) => setTab(t as typeof tab)} />

      {tab === 'Performance' && (
        !reportRows ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-accent animate-pulse" />)}</div>
        ) : (
          <PerformanceTable rows={reportRows}>
            {(row) => {
              const child = row.rosterStudentId ? childByRosterId.get(row.rosterStudentId) : undefined;
              if (!child) return null;
              return (
                <Link href={`#student-${child.rosterStudentId}`} onClick={() => setTab('Students')} className="text-xs text-primary hover:underline whitespace-nowrap">
                  View pathway →
                </Link>
              );
            }}
          </PerformanceTable>
        )
      )}

      {tab === 'Students' && (
        !children ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-accent animate-pulse" />)}</div>
        ) : children.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">No personalized pathways assigned yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((child) => (
              <div key={child.assignmentId} id={`student-${child.rosterStudentId}`}>
                <StudentPathwayDrawer child={child} />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'Preview' && (
        parentPreview ? (
          <PathwayPreview data={parentPreview} />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">No pathway content available.</p>
          </div>
        )
      )}
    </div>
  );
}
