'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/pathway/ThemeToggle';

const LINKS = [
  { href: '/', label: 'Pathway Builder' },
  { href: '/pathways', label: 'Pathways' },
  { href: '/roster', label: 'Roster' },
  { href: '/games', label: 'Games' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-6 py-3">
        <span className="font-heading text-sm font-semibold tracking-tight text-primary mr-3">
          Pathways
        </span>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
