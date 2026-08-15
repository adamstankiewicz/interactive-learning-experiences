import { Suspense } from 'react';
import { PathwayBuilder } from '@/components/PathwayBuilder';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Suspense fallback={<div className="min-h-screen" />}>
        <PathwayBuilder />
      </Suspense>
    </main>
  );
}
