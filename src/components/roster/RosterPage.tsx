'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RosterStudent } from '@/lib/roster/types';
import { AddStudentModal } from './AddStudentModal';
import { StudentCard } from './StudentCard';

export function RosterPage() {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetch('/api/roster')
      .then((r) => r.json())
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function onStudentAdded(student: RosterStudent) {
    setStudents((prev) => [...prev, student]);
    setAddOpen(false);
  }

  function onStudentUpdated(updated: RosterStudent) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 pb-20 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Class roster</h1>
          {!loading && (
            <Badge variant="secondary">{students.length} student{students.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add student</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-4xl">👩‍🎓</div>
          <p className="text-muted-foreground text-sm max-w-xs">
            No students yet. Add your first student to start building personalized pathways.
          </p>
          <Button onClick={() => setAddOpen(true)}>Add first student</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} onUpdated={onStudentUpdated} />
          ))}
        </div>
      )}

      {addOpen && (
        <AddStudentModal onClose={() => setAddOpen(false)} onSaved={onStudentAdded} />
      )}
    </div>
  );
}
