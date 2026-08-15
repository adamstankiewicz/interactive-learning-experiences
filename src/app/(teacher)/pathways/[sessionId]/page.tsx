import Link from 'next/link';

import { SessionReport } from '@/components/pathways/SessionReport';
import { storageAdapter } from '@/lib/storage';

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await storageAdapter().loadSession(sessionId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/pathways"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All Pathways
        </Link>
        <h1 className="font-heading text-2xl font-bold mt-2">
          {session?.topic ?? 'Pathway Report'}
        </h1>
      </div>

      <SessionReport sessionId={sessionId} />
    </main>
  );
}
