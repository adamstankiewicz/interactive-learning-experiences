'use client';

import { useEffect, useState } from 'react';
import type { RosterStudent } from '@/lib/roster/types';

type AssignEvent =
  | { type: 'started'; studentId: string; name: string }
  | { type: 'done'; studentId: string; name: string; sessionId: string; assignmentId: string }
  | { type: 'error'; studentId: string; name: string; message: string }
  | { type: 'complete' };

type StudentStatus = 'idle' | 'generating' | 'done' | 'error';

export function AssignToStudents({ topic, gradeHint, parentSessionId }: { topic: string; gradeHint?: string; parentSessionId?: string }) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, StudentStatus>>({});
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  // students already assigned this topic (persisted or just completed this session)
  const [alreadyAssigned, setAlreadyAssigned] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/roster')
      .then((r) => r.json())
      .then(async (data: unknown) => {
        const roster: RosterStudent[] = Array.isArray(data) ? data : [];
        setStudents(roster);

        // Fetch existing assignments for all students in parallel, mark those
        // who already have this topic assigned so they appear disabled.
        const results = await Promise.all(
          roster.map((s) =>
            fetch(`/api/roster/${s.id}/assignments`)
              .then((r) => r.json())
              .then((assignments: unknown) => ({ id: s.id, assignments }))
              .catch(() => ({ id: s.id, assignments: [] })),
          ),
        );
        const assigned = new Set<string>();
        for (const { id, assignments } of results) {
          if (
            Array.isArray(assignments) &&
            assignments.some((a: { topic?: string }) => a.topic === topic)
          ) {
            assigned.add(id);
          }
        }
        setAlreadyAssigned(assigned);
        setLoadingRoster(false);
      })
      .catch(() => setLoadingRoster(false));
  }, [topic]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assign() {
    if (selected.size === 0 || assigning) return;
    setAssigning(true);
    setComplete(false);
    setSessionIds({});
    setStatuses(Object.fromEntries([...selected].map((id) => [id, 'idle' as StudentStatus])));

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, gradeHint, parentSessionId: parentSessionId ?? null, rosterStudentIds: [...selected] }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as AssignEvent;
            if (event.type === 'started') {
              setStatuses((prev) => ({ ...prev, [event.studentId]: 'generating' }));
            } else if (event.type === 'done') {
              setStatuses((prev) => ({ ...prev, [event.studentId]: 'done' }));
              setSessionIds((prev) => ({ ...prev, [event.studentId]: event.sessionId }));
              setAlreadyAssigned((prev) => new Set([...prev, event.studentId]));
            } else if (event.type === 'error') {
              setStatuses((prev) => ({ ...prev, [event.studentId]: 'error' }));
            } else if (event.type === 'complete') {
              setComplete(true);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      console.error('Assignment failed:', err);
    } finally {
      setAssigning(false);
    }
  }

  if (loadingRoster) return null;
  if (students.length === 0) return (
    <div className="mt-4 rounded-2xl border-2 border-dashed border-violet-200 p-4 text-sm text-muted-foreground dark:border-violet-900">
      No students in your roster yet.{' '}
      <a href="/roster" className="font-medium text-violet-600 hover:underline dark:text-violet-400">Add students</a> to assign this pathway.
    </div>
  );

  return (
    <div className="mt-4 rounded-3xl border-3 border-violet-200 bg-card p-5 dark:border-violet-900">
      <h3 className="font-heading text-base font-black">🎒 Assign to students</h3>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        Select students to generate a personalized version of this pathway for each one.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        {students.map((student) => {
          const status = statuses[student.id];
          const sid = sessionIds[student.id];
          const isAssigned = alreadyAssigned.has(student.id);
          const isDisabled = assigning || isAssigned;
          return (
            <label
              key={student.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-colors ${
                isAssigned
                  ? 'border-border opacity-50 cursor-not-allowed'
                  : isDisabled
                  ? 'border-border cursor-not-allowed'
                  : selected.has(student.id)
                  ? 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40 cursor-pointer'
                  : 'border-border hover:border-violet-200 dark:hover:border-violet-800 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                className="accent-violet-600"
                checked={selected.has(student.id)}
                disabled={isDisabled}
                onChange={() => toggle(student.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
                <p className="text-xs text-muted-foreground">
                  Gr. {student.grade} · {student.learningStyle.primary}
                </p>
              </div>
              {isAssigned && !status && (
                <span className="text-xs text-muted-foreground shrink-0">Assigned</span>
              )}
              {status === 'generating' && (
                <span className="text-xs font-medium text-violet-500 animate-pulse">Generating…</span>
              )}
              {status === 'done' && sid && (
                <a
                  href={`/learn/${sid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open →
                </a>
              )}
              {status === 'error' && (
                <span className="text-xs font-medium text-destructive">Failed</span>
              )}
            </label>
          );
        })}
      </div>

      {complete && (() => {
        const vals = Object.values(statuses);
        const succeeded = vals.filter((s) => s === 'done').length;
        const failed = vals.filter((s) => s === 'error').length;
        if (succeeded === 0) return (
          <p className="text-xs text-destructive mb-3 font-medium">
            Generation failed for all students. Check the console for details.
          </p>
        );
        if (failed > 0) return (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 font-medium">
            {succeeded} pathway{succeeded !== 1 ? 's' : ''} generated — {failed} failed. Retry the failed students.
          </p>
        );
        return (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3 font-medium">
            🎉 All personalized pathways generated. Students can view them on their homepages.
          </p>
        );
      })()}

      {students.every((s) => alreadyAssigned.has(s.id)) ? (
        <p className="text-center text-xs text-muted-foreground py-1">
          All students have been assigned this pathway.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={assign}
            disabled={selected.size === 0 || assigning}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-amber-950 shadow-[0_4px_0_0_#b45309] transition-transform active:translate-y-1 active:shadow-[0_1px_0_0_#b45309] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
          >
            {assigning
              ? 'Generating personalized pathways…'
              : `Assign to ${selected.size} student${selected.size !== 1 ? 's' : ''} 🚀`}
          </button>

          {selected.size > 0 && !assigning && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              This will generate a separate AI-personalized pathway for each selected student.
            </p>
          )}
        </>
      )}
    </div>
  );
}
