'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/pathway/ThemeToggle';

type ExtractedTopic = {
  topic: string;
  gradeLevel: string;
  description: string;
};

type UploadResponse = {
  filename: string;
  topics: ExtractedTopic[];
  textLength: number;
};

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/lesson-plan', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data: UploadResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const handleGeneratePathway = (topic: string, gradeLevel: string) => {
    const params = new URLSearchParams({
      topic,
      grade: gradeLevel,
    });
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_3%,var(--background)),var(--background)_60%)]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-3">
          <Link href="/" className="font-heading text-sm font-semibold tracking-tight text-primary hover:underline">
            Pathways
          </Link>
          <span className="text-xs text-muted-foreground">Upload Lesson Plan</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20">
        <div className="pt-14">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
            Upload a lesson plan <span className="text-primary">to extract topics</span>.
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
            Upload a text file (.txt) with your lesson plan and we&rsquo;ll extract the learning topics from it. Then you can
            generate standards-grounded pathways for each topic using the Learning Commons knowledge graph.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 font-heading text-lg font-semibold">Select Text File</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-foreground
                    file:mr-4 file:rounded-md file:border-0
                    file:bg-primary file:px-4 file:py-2
                    file:text-sm file:font-medium file:text-primary-foreground
                    hover:file:bg-primary/90"
                  disabled={uploading}
                />
              </div>

              {file && (
                <div className="flex items-center justify-between rounded-md bg-muted p-3">
                  <span className="text-sm text-muted-foreground">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    size="sm"
                  >
                    {uploading ? 'Processing...' : 'Extract Topics'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-lg font-semibold">
                    Extracted Topics ({result.topics.length})
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    from {result.filename}
                  </span>
                </div>

                {result.topics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No topics found in the lesson plan. Try a different file or enter topics manually.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {result.topics.map((topic, index) => (
                      <div
                        key={index}
                        className="rounded-md border border-border bg-background p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-medium">{topic.topic}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {topic.description}
                            </p>
                            <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Grade {topic.gradeLevel}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleGeneratePathway(topic.topic, topic.gradeLevel)}
                          >
                            Generate Pathway
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-center">
                <Link href="/">
                  <Button variant="outline">
                    Back to Manual Entry
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
