'use client';

import { Flashcard } from '@/components/widgets/Flashcard';
import { MarkdownCard } from '@/components/widgets/MarkdownCard';
import { A2UISurfaceDemo } from '@/components/a2ui/A2UISurfaceView';
import type { A2UISurfaceMessage } from '@/lib/a2learn/a2ui';
import type { FlashcardSpec, MarkdownCardSpec } from '@/lib/pathway/schema';

/**
 * The two tiers of the same spec, side by side: the native widget with its
 * full mechanics, and the A2UI basic-catalog projection any compliant
 * renderer can draw. The visible gap between the columns is the exhibit —
 * what portability costs, stated in UI instead of prose.
 */

type Props = { spec: Record<string, unknown>; surface: A2UISurfaceMessage };

function NativeWidget({ spec }: { spec: Record<string, unknown> }) {
  switch (spec.kind) {
    case 'flashcard':
      return <Flashcard spec={spec as unknown as FlashcardSpec} />;
    case 'markdown-card':
      return <MarkdownCard spec={spec as unknown as MarkdownCardSpec} />;
    default:
      return (
        <p className="text-sm text-muted-foreground">
          No native preview wired for {String(spec.kind)}.
        </p>
      );
  }
}

export function A2UIComparison({ spec, surface }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Native widget — full mechanics
        </p>
        <NativeWidget spec={spec} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          A2UI basic catalog — portable projection
        </p>
        <A2UISurfaceDemo surface={surface} />
      </div>
    </div>
  );
}
