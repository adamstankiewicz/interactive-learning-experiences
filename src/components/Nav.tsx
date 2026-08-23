'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/pathway/ThemeToggle';

const LINKS = [
  { href: '/', label: 'Builder' },
  { href: '/pathways', label: 'Pathways' },
  { href: '/roster', label: 'Roster' },
  { href: '/games', label: 'Games' },
];

/**
 * Teacher-register chrome: flat card surface, 1px rule, square. The brand
 * mark is the highlighter as a marker — a small filled square that always
 * carries its 1px ink border (the fill is 1.41:1 on its own and never
 * appears un-bordered). The active nav item is underlined by an inset
 * brand-fill bar rather than a filled pill.
 */
export function Nav({ sourceLabel }: { sourceLabel?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-6 py-3.5">
        <Link href="/pathways" className="mr-4 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-[13px] border border-foreground bg-brand-fill"
          />
          <span className="font-heading text-sm font-bold tracking-tight">Practice Pathways</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 text-[12.5px] transition-colors ${
                  active
                    ? 'bg-sunk font-semibold text-foreground shadow-[inset_0_-2px_0_var(--brand-fill)]'
                    : 'text-muted-foreground hover:bg-sunk hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {sourceLabel && (
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-verified sm:inline">
              ✓ {sourceLabel}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
