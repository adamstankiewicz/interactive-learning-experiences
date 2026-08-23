import Link from 'next/link';

import { SessionReportPage } from '@/components/pathways/SessionReportPage';
import type { PathwayPreviewData } from '@/components/pathways/PathwayPreview';
import { storageAdapter } from '@/lib/storage';

export default async function PathwayReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await storageAdapter().loadSession(sessionId);

  const parentPreview: PathwayPreviewData | null = session?.plan
    ? { plan: session.plan, stepWidgets: session.stepWidgets ?? {} }
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/pathways"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All pathways
        </Link>
        <h1 className="font-heading text-2xl font-bold mt-2">
          {session?.topic ?? 'Pathway report'}
        </h1>
      </div>

      <SessionReportPage
        sessionId={sessionId}
        parentPreview={parentPreview}
      />
    </main>
  );
}
