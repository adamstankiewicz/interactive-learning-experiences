import { Suspense } from 'react';
import { StudentHomepage } from '@/components/roster/StudentHomepage';

export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Suspense fallback={<div className="min-h-screen" />}>
        <StudentHomepage studentId={studentId} />
      </Suspense>
    </main>
  );
}
