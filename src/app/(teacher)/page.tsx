import { Suspense } from 'react';
import { PathwayBuilder } from '@/components/PathwayBuilder';

export default function Home() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <PathwayBuilder />
    </Suspense>
  );
}
