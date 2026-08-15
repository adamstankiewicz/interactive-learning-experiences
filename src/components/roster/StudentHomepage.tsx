'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/pathway/ThemeToggle';
import { savedProgress } from '@/components/pathway/PathwayWalkthrough';
import { Badge } from '@/components/ui/badge';
import type { Assignment, RosterStudent } from '@/lib/roster/types';

const STYLE_EMOJI: Record<string, string> = {
  'visual-spatial': '🎨',
  'reading-writing': '📝',
  'kinesthetic-tactile': '🤸',
  auditory: '🎵',
};

type Progress = { step: number; stars: number; done: boolean } | null;

export function StudentHomepage({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<RosterStudent | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [studentRes, assignmentRes] = await Promise.all([
          fetch(`/api/roster/${studentId}`),
          fetch(`/api/roster/${studentId}/assignments`),
        ]);

        if (studentRes.status === 404) { setNotFound(true); setLoading(false); return; }

        const studentData = await studentRes.json() as RosterStudent;
        const assignmentData = await assignmentRes.json() as Assignment[];
        const list: Assignment[] = Array.isArray(assignmentData) ? assignmentData : [];

        // Read localStorage progress for each assignment (client-only, safe here).
        const prog: Record<string, Progress> = {};
        for (const a of list) prog[a.sessionId] = savedProgress(a.sessionId);

        setStudent(studentData);
        setAssignments(list);
        setProgress(prog);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Student not found</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          This link may be outdated. Ask your teacher for an updated link.
        </p>
      </div>
    );
  }

  const emoji = STYLE_EMOJI[student.learningStyle.primary] ?? '📚';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* Profile card */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-900 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-2xl">
              {emoji}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{student.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Grade {student.grade}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-0">
              {student.learningStyle.primary}
            </Badge>
            {student.motivators.slice(0, 3).map((m) => (
              <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
            ))}
          </div>
        </div>

        {/* Assigned pathways */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Your learning pathways
          </h2>

          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
              <p className="text-3xl mb-3">🌱</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No pathways assigned yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {assignments.map((assignment) => (
                <PathwayCard
                  key={assignment.id}
                  assignment={assignment}
                  progress={progress[assignment.sessionId] ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PathwayCard({ assignment, progress }: { assignment: Assignment; progress: Progress }) {
  const date = new Date(assignment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (progress?.done) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-lg shrink-0">
          🎉
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{assignment.topic}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Completed · {progress.stars} ⭐
          </p>
        </div>
        <Link
          href={`/learn/${assignment.sessionId}`}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
        >
          Redo
        </Link>
      </div>
    );
  }

  if (progress && progress.step > 0) {
    return (
      <Link
        href={`/learn/${assignment.sessionId}`}
        className="group rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-4 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-lg shrink-0">
          ▶️
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{assignment.topic}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
            In progress · {progress.stars} ⭐ so far
          </p>
        </div>
        <span className="text-slate-400 group-hover:text-amber-500 transition-colors text-lg shrink-0">→</span>
      </Link>
    );
  }

  return (
    <Link
      href={`/learn/${assignment.sessionId}`}
      className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-lg shrink-0">
        🗺️
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{assignment.topic}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Assigned {date}</p>
      </div>
      <span className="text-slate-400 group-hover:text-indigo-500 transition-colors text-lg shrink-0">→</span>
    </Link>
  );
}
