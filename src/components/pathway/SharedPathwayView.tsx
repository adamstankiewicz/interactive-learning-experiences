'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { PathwayWalkthrough, type WalkthroughSession } from '@/components/pathway/PathwayWalkthrough';

/**
 * The client half of `/learn/[sessionId]`: the server component fetches the
 * persisted row, this just mints a viewer identity (same anonymous pattern
 * as a live `/learn` build — a student opening a shared link still gets
 * their own telemetry, tied to the shared `sessionId`) and renders the same
 * walkthrough a live build ends in.
 */
export function SharedPathwayView({ session }: { session: WalkthroughSession }) {
  const [studentId, setStudentId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('studentId'),
  );

  useEffect(() => {
    if (studentId) return;
    void fetch('/api/student', { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { studentId?: string } | null) => {
        if (!data?.studentId) return;
        localStorage.setItem('studentId', data.studentId);
        setStudentId(data.studentId);
      })
      .catch(() => {});
  }, [studentId]);

  // Record a unique open once we have both the session and the student identity.
  useEffect(() => {
    if (!studentId) return;
    void fetch(`/api/pathway/sessions/${session.sessionId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    }).catch(() => {});
  }, [session.sessionId, studentId]);

  return (
    <div className="light-surface min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center gap-6 px-5 py-10">
        <p className="text-center text-lg font-black text-balance">{session.topic}</p>

        <PathwayWalkthrough session={session} studentId={studentId} />

        <Link href="/learn" className="text-xs font-bold text-violet-500 underline underline-offset-2">
          Build your own pathway →
        </Link>
      </main>
    </div>
  );
}
