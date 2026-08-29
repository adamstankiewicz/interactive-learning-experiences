import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Serves the adopter docs (the markdown under `docs/`) from the app itself,
 * so a hosted instance carries its own documentation. The files stay plain
 * markdown — GitHub remains a first-class reader — and this route is just a
 * themed renderer over them: a whitelist of slugs, not a filesystem walk, so
 * a request can never read outside `docs/`.
 */

const REPO_BLOB = 'https://github.com/adamstankiewicz/interactive-learning-experiences/blob/main';

const PAGES: Record<string, { file: string; title: string; nav: string }> = {
  '': { file: 'README.md', title: 'Docs', nav: 'Overview' },
  quickstart: { file: 'quickstart.md', title: 'Quickstart', nav: 'Quickstart' },
  registry: { file: 'registry.md', title: 'The widget registry', nav: 'Registry' },
  'mcp-tools': { file: 'mcp-tools.md', title: 'MCP tools', nav: 'MCP tools' },
  evidence: { file: 'evidence.md', title: 'The evidence contract', nav: 'Evidence' },
  architecture: { file: 'architecture.md', title: 'Architecture', nav: 'Architecture' },
};

/**
 * The markdown's relative links are written for GitHub. In the app they
 * resolve to: sibling `.md` pages → their `/docs` route; the static landing →
 * `/open.html`; anything reaching out of `docs/` (source files, CONTRIBUTING)
 * → the file on GitHub.
 */
function rewriteHref(href: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href;
  const [target, hash = ''] = href.split('#');
  const anchor = hash ? `#${hash}` : '';
  const clean = target.replace(/^\.\//, '');

  if (clean === 'index.html') return '/open.html';
  if (clean.startsWith('../')) return `${REPO_BLOB}/${clean.replace(/^(\.\.\/)+/, '')}${anchor}`;
  if (clean.endsWith('.md')) {
    const name = clean.slice(0, -3);
    return name === 'README' ? `/docs${anchor}` : `/docs/${name}${anchor}`;
  }
  return href;
}

function pageFor(slug: string[] | undefined) {
  const key = (slug ?? []).join('/');
  return key in PAGES ? PAGES[key] : null;
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((key) => ({ slug: key ? key.split('/') : [] }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const page = pageFor((await params).slug);
  return { title: page ? `${page.title} · a2learn docs` : 'Docs' };
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = pageFor(slug);
  if (!page) notFound();

  const markdown = await readFile(path.join(process.cwd(), 'docs', page.file), 'utf8');
  const activeKey = (slug ?? []).join('/');

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline gap-x-5 gap-y-1 px-6 py-3">
          <Link href="/docs" className="font-mono text-sm font-medium">
            a2learn docs
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {Object.entries(PAGES).map(([key, entry]) => (
              <Link
                key={entry.file}
                href={key ? `/docs/${key}` : '/docs'}
                className={
                  key === activeKey
                    ? 'font-medium text-foreground underline underline-offset-4'
                    : 'text-muted-foreground hover:text-foreground'
                }
              >
                {entry.nav}
              </Link>
            ))}
          </nav>
          <a
            href="/open.html"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            About →
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-4 text-3xl font-bold tracking-tight">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-10 mb-3 border-t border-border pt-6 text-xl font-semibold">
                {children}
              </h2>
            ),
            h3: ({ children }) => <h3 className="mt-6 mb-2 text-base font-semibold">{children}</h3>,
            p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            a: ({ href, children }) => {
              const target = rewriteHref(href ?? '');
              const external = /^https?:/.test(target);
              return external ? (
                <a href={target} className="underline underline-offset-3 hover:text-primary" rel="noopener">
                  {children}
                </a>
              ) : (
                <Link href={target} className="underline underline-offset-3 hover:text-primary">
                  {children}
                </Link>
              );
            },
            code: ({ children, className }) =>
              className ? (
                // Block code (```lang) — the wrapping <pre> handles the box.
                <code className={className}>{children}</code>
              ) : (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
                  {children}
                </code>
              ),
            pre: ({ children }) => (
              <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-[13px] leading-relaxed">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="mb-4 border-l-2 border-warning pl-4 text-muted-foreground [&_p]:mb-0">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b-2 border-border px-3 py-2 text-left font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-border px-3 py-2 align-top">{children}</td>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </main>
    </div>
  );
}
