import { notFound } from 'next/navigation';

import type { WalkthroughSession } from '@/components/pathway/PathwayWalkthrough';
import { SharedPathwayView } from '@/components/pathway/SharedPathwayView';
import { storageAdapter } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * Reads back a pathway `persistSession()` already wrote — the payoff of
 * giving the builder an identity (see `use-pathway-stream.ts`). A fresh
 * generation and this page render the identical `PathwayWalkthrough`; the
 * only difference is where the session data comes from.
 */
async function loadSession(sessionId: string): Promise<WalkthroughSession | null> {
  const session = await storageAdapter().loadSession(sessionId);
  if (!session) return null;

  const stepWidgets: Record<number, unknown> = {};
  for (const [key, value] of Object.entries(session.stepWidgets ?? {})) {
    stepWidgets[Number(key)] = value;
  }

  return {
    sessionId: session.id,
    topic: session.topic,
    bigIdea: session.plan?.bigIdea ?? '',
    standardCode: session.anchor?.standard?.verified ? session.anchor.standard.code : null,
    steps: session.plan?.steps ?? [],
    stepWidgets,
    stepWidgetNotes: {},
  };
}

export default async function SharedPathwayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await loadSession(sessionId);

  if (!session) notFound();

  return <SharedPathwayView session={session} />;
}
