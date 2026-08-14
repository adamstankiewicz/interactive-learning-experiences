import { NextResponse } from 'next/server';

import { generatePathway } from '@/lib/pathway/generate';

export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { topic?: unknown; gradeHint?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return NextResponse.json({ error: 'A topic is required.' }, { status: 400 });
  }

  const gradeHint = typeof body.gradeHint === 'string' && body.gradeHint.trim() ? body.gradeHint.trim() : undefined;

  try {
    const result = await generatePathway(topic, gradeHint);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pathway generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
