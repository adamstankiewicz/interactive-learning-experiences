'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ExtractedTopic = {
  topic: string;
  gradeLevel: string;
  description: string;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; filename: string; topics: ExtractedTopic[] };

const ACCEPTED = ['.txt', '.pdf'];

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

/**
 * Lets a teacher skip typing a topic by hand: drop in a lesson plan, get back
 * a shortlist of topics pulled from it, pick one to seed the same form the
 * builder already has. Picking a chip only fills the fields — same restraint
 * as the example buttons — so the teacher still reviews/edits before building
 * rather than an upload silently kicking off a build on their behalf.
 */
export function LessonPlanUpload({
  disabled,
  onPickTopic,
}: {
  disabled?: boolean;
  onPickTopic: (topic: string, gradeLevel: string) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(async (file: File) => {
    if (!hasAcceptedExtension(file.name)) {
      setStatus({ kind: 'error', message: 'Only .txt and .pdf files are supported.' });
      return;
    }

    setStatus({ kind: 'uploading', filename: file.name });

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/lesson-plan', { method: 'POST', body: formData });
      const body = (await response.json().catch(() => null)) as
        | { filename: string; topics: ExtractedTopic[] }
        | { error: string }
        | null;

      if (!response.ok || !body || 'error' in body) {
        throw new Error(body && 'error' in body ? body.error : 'Upload failed.');
      }

      setStatus({ kind: 'done', filename: body.filename, topics: body.topics });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not process that file.',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setStatus({ kind: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  if (status.kind === 'done') {
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Topics from <span className="font-medium text-foreground">{status.filename}</span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="h-6 px-2 text-xs">
            <X className="size-3.5" />
            Clear
          </Button>
        </div>

        {status.topics.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No clear topics found in that file — try a different one, or just type a topic above.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {status.topics.map((extracted) => (
              <button
                key={extracted.topic}
                type="button"
                disabled={disabled}
                onClick={() => onPickTopic(extracted.topic, extracted.gradeLevel)}
                title={extracted.description}
                className="group flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="font-medium">{extracted.topic}</span>
                <Badge variant="secondary" className="pointer-events-none">
                  Gr {extracted.gradeLevel}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !disabled) void upload(file);
        }}
        className={cn(
          'flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors',
          dragging && 'border-primary/50 bg-primary/5',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          className="sr-only"
        />

        {status.kind === 'uploading' ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <span>Reading {status.filename}…</span>
          </>
        ) : (
          <>
            <Upload className="size-4 shrink-0" />
            <span>
              Or upload a lesson plan <span className="text-muted-foreground/60">(.txt or .pdf)</span> to
              pull topics from it
            </span>
          </>
        )}
      </label>

      {status.kind === 'error' && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
          <FileText className="size-3.5 shrink-0" />
          {status.message}
        </p>
      )}
    </div>
  );
}
