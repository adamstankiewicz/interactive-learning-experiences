import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Link from 'next/link';

import { A2UIComparison } from '@/components/a2ui/A2UIComparison';
import { toA2UISurface, A2UI_SUPPORTED_KINDS } from '@/lib/a2learn/a2ui';
import { toA2LearnSurface } from '@/lib/a2learn/catalog';

/**
 * The A2UI boundary, functional: the same fixture specs the conformance
 * suite proves (`spec/a2learn/fixtures/`), mapped live through
 * `toA2UISurface` at render time and drawn by the app's renderer of the
 * emitted catalog slice. Deterministic and offline — no model call, so what
 * this page shows is exactly what the conformance gate guarantees.
 */

export const metadata = { title: 'A2UI surfaces — demo' };

function fixtureSpecs(): { name: string; spec: Record<string, unknown> }[] {
  const dir = join(process.cwd(), 'spec', 'a2learn', 'fixtures');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.spec.json'))
    .map((file) => ({
      name: file.replace(/\.spec\.json$/, ''),
      spec: JSON.parse(readFileSync(join(dir, file), 'utf8')),
    }));
}

export default function A2UIDemoPage() {
  const pairs = fixtureSpecs().map(({ name, spec }) => ({
    name,
    spec,
    a2learnSurface: toA2LearnSurface(spec, `demo-a2learn-${name}`),
    surface: toA2UISurface(spec, `demo-${name}`),
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-muted-foreground">
        <Link href="/demo" className="underline">
          ← all demos
        </Link>
      </p>
      <h1 className="mb-3 text-2xl font-semibold">A2UI surfaces</h1>
      <p className="mb-2 text-base text-muted-foreground">
        Widget specs project through the boundary mapper to{' '}
        <a href="https://github.com/google/A2UI" className="underline">
          Google&apos;s A2UI
        </a>{' '}
        basic catalog — the same surfaces the conformance suite validates against the vendored
        upstream schemas, mapped live on this page and rendered by this app&apos;s renderer of the
        catalog slice the mapper emits.
      </p>
      <p className="mb-8 text-sm text-muted-foreground">
        Both columns are A2UI surfaces — the two tiers of the same spec. The first is the a2learn
        catalog (draft): its component is the widget kind itself, the registry is the renderer, so
        it is the exact native experience — flip animation, completion reporting, the same loop
        the MCP Apps shell speaks. The second is the basic-catalog projection any A2UI renderer
        can draw — and presentation is the renderer&apos;s half of the protocol, so this
        one draws it in the app&apos;s own design language: the deck pages horizontally, a tab
        switch turns the card over. What stays behind in the projection is semantics the catalog
        cannot carry — per-card progress, checked completion, links and images in text — and that gap
        is what the versioned a2learn catalog (#98) closes for hosts beyond this app.
        Basic-mapped kinds today: {A2UI_SUPPORTED_KINDS.join(', ')}.
      </p>

      <div className="flex flex-col gap-10">
        {pairs.map(({ name, spec, a2learnSurface, surface }) => (
          <section key={name}>
            <h2 className="mb-1 text-lg font-medium">{name}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              <Link href={`/demo/${String(spec.kind)}`} className="underline">
                full demo of this kind →
              </Link>
            </p>
            {surface && a2learnSurface ? (
              <>
                <A2UIComparison a2learnSurface={a2learnSurface} basicSurface={surface} />
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    widget spec (input)
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
                    {JSON.stringify(spec, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    a2learn-catalog createSurface message (full fidelity)
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
                    {JSON.stringify(a2learnSurface, null, 2)}
                  </pre>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    basic-catalog createSurface message (fallback)
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
                    {JSON.stringify(surface, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                ⚠ not mapped — {String(spec.kind)} has no A2UI mapping yet.
              </p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
