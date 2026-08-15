import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateStructured } from '@/lib/structured';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PROMPT_CHARS = 12_000;

const extraction = z.object({
  topics: z
    .array(
      z.object({
        topic: z.string().describe('A concrete, teachable learning topic or objective'),
        gradeLevel: z
          .string()
          .describe('Grade level as it appears or is implied in the document, e.g. "4" or "K"'),
        description: z.string().describe('One sentence on what students will learn'),
      }),
    )
    .describe('The 5-8 most important learning topics found in the document'),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function extractText(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isText = file.type.startsWith('text/plain') || file.name.toLowerCase().endsWith('.txt');

  if (isPdf) {
    // Imported from lib/pdf-parse.js, not the package root: the root's
    // index.js runs a debug branch on any `require.parent`-less load (true
    // under Next's bundler) that reads a fixture file from the package's own
    // test directory and throws ENOENT since that file isn't shipped.
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (isText) return file.text();

  throw new Error('UNSUPPORTED_TYPE');
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Expected a multipart form with a file.', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return errorResponse('No file provided.', 400);
  if (file.size === 0) return errorResponse('The file is empty.', 400);
  if (file.size > MAX_FILE_BYTES) return errorResponse('File is too large (15 MB max).', 400);

  let text: string;
  try {
    text = await extractText(file);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNSUPPORTED_TYPE') {
      return errorResponse('Only .txt and .pdf files are supported.', 400);
    }
    console.error('[lesson-plan] could not extract text', error);
    return errorResponse('Could not read that file — is it a valid PDF or text file?', 400);
  }

  if (!text.trim()) {
    return errorResponse('No readable text was found in that file.', 400);
  }

  try {
    const result = await generateStructured({
      schema: extraction,
      system: [
        'You extract learning topics and objectives from lesson plan documents.',
        'Identify concrete, teachable topics that can be mapped to curriculum standards.',
        'Look for learning objectives, standards codes, unit titles, and lesson goals.',
        'Extract the grade level from the document, or infer it from content complexity.',
        'Focus on topics that would work well as the seed for a single-topic lesson.',
      ].join(' '),
      prompt: ['Extract learning topics from this lesson plan:', '', text.slice(0, MAX_PROMPT_CHARS)].join(
        '\n',
      ),
    });

    return NextResponse.json({ filename: file.name, topics: result.topics });
  } catch (error) {
    console.error('[lesson-plan] extraction failed', error);
    return errorResponse('Could not extract topics from that file.', 500);
  }
}
