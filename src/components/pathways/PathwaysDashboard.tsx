'use client';

import Link from 'next/link';
import { Paperclip } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { SessionSummary } from '@/lib/storage/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Verification chips carry an icon and a word — colour alone never conveys
 * state. `EXPLORATION` is the pipeline's honest sentinel for "nothing
 * verified"; it gets the warning treatment, stated plainly.
 */
function StandardChip({ code }: { code: string | null }) {
  const unverified = !code || code === 'EXPLORATION';
  if (unverified) {
    return (
      <span className="inline-flex items-center gap-1 border border-warning-edge bg-warning-tint px-1.5 py-px font-mono text-[10.5px] text-warning">
        ⚠ no standard matched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 border border-verified-edge bg-verified-tint px-1.5 py-px font-mono text-[10.5px] text-verified">
      ✓ {code}
    </span>
  );
}

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

/**
 * The quick-create bar: one ink-bordered strip whose primary is the
 * highlighter with its mandatory ink border. Submitting hands off to the
 * builder, which already accepts ?topic=&grade=.
 */
function QuickCreate({ recentTopics }: { recentTopics: string[] }) {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('');
  const [focused, setFocused] = useState(false);

  function build() {
    const params = new URLSearchParams();
    if (topic.trim()) params.set('topic', topic.trim());
    if (grade) params.set('grade', grade);
    router.push(params.size ? `/?${params}` : '/');
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          build();
        }}
        className="flex items-stretch border border-foreground bg-card"
      >
        <span className="relative min-w-0 flex-1">
          {/* The bar invites typing before it is touched: a blinking caret
              sits ahead of the placeholder until focus brings the real one. */}
          {!topic && !focused && (
            <span
              aria-hidden="true"
              className="caret-blink pointer-events-none absolute top-1/2 left-3.5 h-[1.1em] w-px -translate-y-1/2 bg-foreground"
            />
          )}
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What should your students learn next?"
            aria-label="Pathway topic"
            className="w-full bg-transparent px-3.5 py-2.5 pl-4.75 text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </span>
        <Link
          href="/"
          aria-label="Attach a lesson plan"
          title="Attach a lesson plan"
          className="flex items-center border-l border-border px-3 text-[15px] text-muted-foreground transition-colors hover:bg-sunk hover:text-foreground"
        >
          <Paperclip aria-hidden="true" className="size-4" />
        </Link>
        <select
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          aria-label="Grade"
          className="border-l border-border bg-transparent px-2.5 text-[12.5px] text-ink-2 outline-none"
        >
          <option value="">Grade</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border-l border-foreground bg-brand-fill px-4 font-heading text-sm font-bold text-foreground transition-colors hover:bg-brand-fill-hover"
        >
          Build pathway →
        </button>
      </form>
      {recentTopics.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Reuse
          </span>
          {recentTopics.map((t) => (
            <Link
              key={t}
              href={`/?topic=${encodeURIComponent(t)}`}
              className="max-w-56 truncate border border-border bg-card px-2 py-0.5 text-[12px] text-ink-2 transition-colors hover:border-foreground hover:text-foreground"
            >
              {t}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_122px_96px_108px_128px_20px] items-center gap-4';

function SessionRow({ session }: { session: SessionSummary }) {
  const completion =
    session.openCount > 0 ? Math.round((session.completionCount / session.openCount) * 100) : null;

  return (
    <Link
      href={`/pathways/${session.id}`}
      className={`${ROW_GRID} border-b border-border bg-card px-[15px] py-2 transition-colors hover:bg-sunk`}
    >
      <span className="min-w-0">
        <span className="block truncate font-heading text-[15px] font-semibold">{session.topic}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <StandardChip code={session.standardCode} />
          {session.gradeHint && (
            <span className="text-[11.5px] text-muted-foreground">Grade {session.gradeHint}</span>
          )}
          {session.stepCount > 0 && (
            <span className="text-[11.5px] text-muted-foreground">
              {session.stepCount} steps · {session.activityKinds.length} activity type
              {session.activityKinds.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
      </span>
      <span className="text-right text-[13.5px] text-ink-2">{formatDate(session.createdAt)}</span>
      <span className="text-right text-[13.5px] tabular-nums text-ink-2">{session.openCount}</span>
      <span className="text-right text-[13.5px] tabular-nums text-ink-2">
        {session.completionCount}
      </span>
      {completion === null ? (
        <span className="text-right text-[12.5px] text-muted-foreground">Needs your review</span>
      ) : (
        <span className="flex items-center justify-end gap-2">
          <span className="font-heading text-base font-bold tabular-nums">{completion}%</span>
          <span aria-hidden="true" className="h-1.5 w-14 bg-sunk">
            <span
              className="block h-full bg-foreground"
              style={{ width: `${Math.min(completion, 100)}%` }}
            />
          </span>
        </span>
      )}
      <span aria-hidden="true" className="text-right text-muted-foreground">
        →
      </span>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="border-t border-border">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 animate-pulse border-b border-border bg-sunk/60" />
      ))}
    </div>
  );
}

export function PathwaysDashboard() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pathway/sessions?limit=50')
      .then((r) => {
        if (!r.ok) throw new Error(`sessions responded ${r.status}`);
        return r.json();
      })
      .then(setSessions)
      .catch(() => setError('Failed to load pathways.'));
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const recentTopics = [...new Set((sessions ?? []).map((s) => s.topic))].slice(0, 3);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-[25px] font-bold tracking-tight">Your pathways</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {today}
        </span>
      </div>

      <QuickCreate recentTopics={recentTopics} />

      <div className="mt-8">
        <div
          className={`${ROW_GRID} border-b-2 border-border px-[15px] pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground`}
        >
          <span>Pathway</span>
          <span className="text-right">Built</span>
          <span className="text-right">Opens</span>
          <span className="text-right">Completed</span>
          <span className="text-right">Completion</span>
          <span />
        </div>

        {error && (
          <p className="border-b border-border bg-card px-3.5 py-4 text-sm text-destructive">
            ⚠ {error}
          </p>
        )}

        {!error && !sessions && <LoadingSkeleton />}

        {sessions && sessions.length === 0 && (
          <div className="border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">
              No pathways yet — build the first one from the bar above.
            </p>
          </div>
        )}

        {sessions && sessions.map((s) => <SessionRow key={s.id} session={s} />)}
      </div>
    </div>
  );
}
