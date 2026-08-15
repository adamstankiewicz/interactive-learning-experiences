import { memoryStorageAdapter } from '@/lib/storage/memory';
import { supabaseStorageAdapter } from '@/lib/storage/supabase';
import type { StorageAdapter } from '@/lib/storage/types';

export type {
  InteractionEvent,
  MasteryRollupRow,
  PersistedSession,
  RecentInteraction,
  StorageAdapter,
} from '@/lib/storage/types';

/**
 * Same shape as `model.ts`/`standardsSource()`: an env var picks the
 * implementation, resolved lazily and memoised.
 *
 * STORAGE_ADAPTER=supabase (explicit) — Supabase, the real backend.
 * STORAGE_ADAPTER=memory   (explicit) — in-process, no external service.
 * Unset — Supabase if `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
 *   are configured, otherwise memory automatically — the app works out of
 *   the box with no persistence setup at all, degrading gracefully exactly
 *   like the scattered `supabaseConfigured()` checks used to, just now as a
 *   real adapter instead of null-checks repeated in five files.
 */

const REGISTRY: Record<string, StorageAdapter> = {
  supabase: supabaseStorageAdapter,
  memory: memoryStorageAdapter,
};

let cached: StorageAdapter | null = null;

export function storageAdapter(): StorageAdapter {
  if (cached) return cached;

  const explicit = process.env.STORAGE_ADAPTER?.toLowerCase();
  if (explicit) {
    const adapter = REGISTRY[explicit];
    if (!adapter) {
      throw new Error(`Unknown STORAGE_ADAPTER "${explicit}". Known adapters: ${Object.keys(REGISTRY).join(', ')}.`);
    }
    cached = adapter;
    return cached;
  }

  cached = supabaseStorageAdapter.configured() ? supabaseStorageAdapter : memoryStorageAdapter;
  return cached;
}
