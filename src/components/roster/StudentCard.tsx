'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RosterStudent } from '@/lib/roster/types';
import { AddStudentModal } from './AddStudentModal';

const SOCIAL_LABEL: Record<string, string> = {
  solo: 'Solo',
  pairs: 'Pairs',
  'small-group': 'Small group',
  'whole-class': 'Whole class',
};

const STYLE_COLOR: Record<string, string> = {
  'visual-spatial': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'reading-writing': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'kinesthetic-tactile': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  auditory: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function styleClass(style: string) {
  return STYLE_COLOR[style] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function StudentCard({ student, onUpdated }: { student: RosterStudent; onUpdated: (s: RosterStudent) => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
        {/* Card body */}
        <div className="flex flex-col gap-3">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">{student.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Grade {student.grade} · Reading level gr. {student.readingLevelGrade}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} className="shrink-0 text-xs">
              Edit
            </Button>
          </div>

          {/* Learning style badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styleClass(student.learningStyle.primary)}`}>
              {student.learningStyle.primary}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium opacity-70 ${styleClass(student.learningStyle.secondary)}`}>
              {student.learningStyle.secondary}
            </span>
            <Badge variant="outline" className="text-xs">
              {SOCIAL_LABEL[student.socialPreference] ?? student.socialPreference}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {student.attentionSpanMinutes} min
            </Badge>
          </div>

          {/* Motivators */}
          {student.motivators.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">Motivators: </span>
              {student.motivators.join(', ')}
            </p>
          )}

          {/* Expandable adaptations */}
          {student.adaptations && (
            <div>
              <button
                className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '▲ Hide adaptations' : '▼ Show adaptations'}
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                    {student.adaptations}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Student link — always pinned to the bottom */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <a
            href={`/student/${student.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Log in as student →
          </a>
        </div>
      </div>

      {editOpen && (
        <AddStudentModal
          existing={student}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            onUpdated(updated);
            setEditOpen(false);
          }}
        />
      )}
    </>
  );
}
