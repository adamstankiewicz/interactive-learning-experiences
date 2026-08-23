import { Suspense } from 'react';
import { RosterPage } from '@/components/roster/RosterPage';

export const metadata = { title: 'Class roster' };

export default function Page() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <RosterPage />
    </Suspense>
  );
}
