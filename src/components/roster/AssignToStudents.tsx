'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RosterStudent } from '@/lib/roster/types';

type AssignEvent =
  | { type: 'started'; studentId: string; name: string }
  | { type: 'done'; studentId: string; name: string; sessionId: string; assignmentId: string }
  | { type: 'error'; studentId: string; name: string; message: string }
  | { type: 'complete' };

type StudentStatus = 'idle' | 'generating' | 'done' | 'error';

export function AssignToStudents({ topic, gradeHint }: { topic: string; gradeHint?: string }) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, StudentStatus>>({});
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    fetch('/api/roster')
      .then((r) => r.json())
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoadingRoster(false);
      })
      .catch(() => setLoadingRoster(false));
  }, []);

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
    setAllDone(false);
    setSessionIds({});

    const initialStatuses: Record<string, StudentStatus> = {};
    for (const id of selected) initialStatuses[id] = 'idle';
    setStatuses(initialStatuses);

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, gradeHint, rosterStudentIds: [...selected] }),
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
            } else if (event.type === 'error') {
              setStatuses((prev) => ({ ...prev, [event.studentId]: 'error' }));
            } else if (event.type === 'complete') {
              setAllDone(true);
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
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
      No students in your roster yet.{' '}
      <a href="/roster" className="text-indigo-600 dark:text-indigo-400 hover:underline">Add students</a> to assign this pathway.
    </div>
  );

  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Assign to students</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Select students to generate a personalized version of this pathway for each one.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        {students.map((student) => {
          const status = statuses[student.id];
          const sid = sessionIds[student.id];
          return (
            <label
              key={student.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border cursor-pointer transition-colors ${
                selected.has(student.id) && !assigning
                  ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={selected.has(student.id)}
                disabled={assigning}
                onChange={() => toggle(student.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{student.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gr. {student.grade} · {student.learningStyle.primary}
                </p>
              </div>
              {status === 'generating' && (
                <span className="text-xs text-indigo-500 animate-pulse">Generating…</span>
              )}
              {status === 'done' && sid && (
                <a
                  href={`/learn/${sid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open →
                </a>
              )}
              {status === 'error' && (
                <span className="text-xs text-red-500">Failed</span>
              )}
            </label>
          );
        })}
      </div>

      {allDone && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3 font-medium">
          All personalized pathways generated. Students can view them on their homepages.
        </p>
      )}

      <Button
        size="sm"
        onClick={assign}
        disabled={selected.size === 0 || assigning}
        className="w-full"
      >
        {assigning
          ? 'Generating personalized pathways…'
          : `Assign to ${selected.size} student${selected.size !== 1 ? 's' : ''}`}
      </Button>

      {selected.size > 0 && !assigning && (
        <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
          This will generate a separate AI-personalized pathway for each selected student.
        </p>
      )}
    </div>
  );
}
