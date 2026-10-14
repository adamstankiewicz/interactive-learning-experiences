import { PathwaysDashboard } from '@/components/pathways/PathwaysDashboard';

export const metadata = { title: 'Pathways' };

export default function PathwaysPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <PathwaysDashboard />
    </main>
  );
}
