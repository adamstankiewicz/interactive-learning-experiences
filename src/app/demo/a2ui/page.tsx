import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Link from 'next/link';

import { A2UIComparison } from '@/components/a2ui/A2UIComparison';
import { toA2UISurface, A2UI_SUPPORTED_KINDS } from '@/lib/a2learn/a2ui';

/**
 * The A2UI boundary, functional: the same fixture specs the conformance
 * suite proves (`spec/a2learn/fixtures/`), mapped live through
 * `toA2UISurface` at render time and drawn by a minimal renderer of the
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
        upstream schemas, mapped live on this page and rendered by a minimal renderer of the six
        component types the mapper emits.
      </p>
      <p className="mb-8 text-sm text-muted-foreground">
        The columns are deliberately different — that difference is the exhibit. The native widget
        has its full mechanics; the projection is what survives translation into a catalog any
        A2UI renderer can draw: no tap-to-flip (the basic catalog models no local state), markdown
        as literal text, front and back stacked in the open. What the projection buys is
        portability; what it costs is shown, not hidden. Mapped kinds today:{' '}
        {A2UI_SUPPORTED_KINDS.join(', ')}.
      </p>

      <div className="flex flex-col gap-10">
        {pairs.map(({ name, spec, surface }) => (
          <section key={name}>
            <h2 className="mb-1 text-lg font-medium">{name}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              <Link href={`/demo/${String(spec.kind)}`} className="underline">
                full demo of this kind →
              </Link>
            </p>
            {surface ? (
              <>
                <A2UIComparison spec={spec} surface={surface} />
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
                    A2UI createSurface message (output)
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
