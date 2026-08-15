import { notFound } from 'next/navigation';

import { SharedPathwayView } from '@/components/pathway/SharedPathwayView';
import type { Anchor } from '@/lib/pathway/events';
import type { PathwayPlan } from '@/lib/pathway/schema';
import type { WalkthroughSession } from '@/components/pathway/PathwayWalkthrough';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/client';

export const runtime = 'nodejs';

type PathwaySessionRow = {
  id: string;
  topic: string;
  anchor: Anchor;
  plan: PathwayPlan;
  step_widgets: Record<string, unknown>;
};

/**
 * Reads back a pathway `persistSession()` already wrote — the payoff of
 * giving the builder an identity (see `use-pathway-stream.ts`). A fresh
 * generation and this page render the identical `PathwayWalkthrough`; the
 * only difference is where the session data comes from.
 */
async function loadSession(sessionId: string): Promise<WalkthroughSession | null> {
  if (!supabaseConfigured()) return null;

  const { data, error } = await supabaseAdmin()
    .from('pathway_sessions')
    .select('id, topic, anchor, plan, step_widgets')
    .eq('id', sessionId)
    .maybeSingle<PathwaySessionRow>();

  if (error || !data) return null;

  const stepWidgets: Record<number, unknown> = {};
  for (const [key, value] of Object.entries(data.step_widgets ?? {})) {
    stepWidgets[Number(key)] = value;
  }

  return {
    sessionId: data.id,
    topic: data.topic,
    bigIdea: data.plan?.bigIdea ?? '',
    standardCode: data.anchor?.standard?.verified ? data.anchor.standard.code : null,
    steps: data.plan?.steps ?? [],
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
