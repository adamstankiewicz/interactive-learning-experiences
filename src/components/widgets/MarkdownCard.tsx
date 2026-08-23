'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import type { MarkdownCardSpec } from '@/lib/pathway/schema';

type Props = { spec: MarkdownCardSpec; onComplete?: (correct: boolean) => void };

export function MarkdownCard({ spec, onComplete }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* No card chrome or header of its own — the ActivityFrame around every
          render site already draws both (design 1h). The body is the reading. */}
      <div className="p-1">
        {/* Student reading passages are the one Source Serif surface:
            17px/1.65 per the type spec. UI chrome around them stays sans. */}
        <div className="flex flex-col gap-3 font-serif text-[17px] leading-[1.65] text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-1">{children}</h3>,
              h2: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-1">{children}</h3>,
              h3: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-1">{children}</h4>,
              p: ({ children }) => <p className="leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc pl-5 flex flex-col gap-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 flex flex-col gap-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed marker:text-muted-foreground">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/40 pl-4 text-muted-foreground italic">
                  {children}
                </blockquote>
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline-offset-2 hover:underline">{children}</a>
              ),
            }}
          >
            {spec.body}
          </ReactMarkdown>
        </div>

        {spec.tip && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold text-primary">Tip: </span>
              {spec.tip}
            </p>
          </div>
        )}
      </div>

      <Button size="lg" className="w-full" onClick={() => onComplete?.(true)}>
        Got it →
      </Button>
    </div>
  );
}
