import { PathwaysDashboard } from '@/components/pathways/PathwaysDashboard';

export const metadata = { title: 'Pathways' };

export default function PathwaysPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="font-heading text-2xl font-bold mb-6">Pathways</h1>
      <PathwaysDashboard />
    </main>
  );
}
