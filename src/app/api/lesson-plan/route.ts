import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { pathwayModel } from '@/lib/model';

const topicExtraction = z.object({
  topics: z.array(
    z.object({
      topic: z.string().describe('The learning topic or objective'),
      gradeLevel: z.string().describe('Grade level (e.g., "3", "4-5", "middle school")'),
      description: z.string().describe('Brief description of what students will learn'),
    })
  ).describe('List of topics extracted from the lesson plan'),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.type.includes('text/plain') && !file.name.endsWith('.txt')) {
      return NextResponse.json(
        { error: 'Only text (.txt) files are supported' },
        { status: 400 }
      );
    }

    const text = await file.text();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF' },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: pathwayModel(),
      output: Output.object({ schema: topicExtraction }),
      system: [
        'You extract learning topics and objectives from lesson plan documents.',
        'Identify concrete, teachable topics that can be mapped to curriculum standards.',
        'Look for learning objectives, standards codes, unit titles, and lesson goals.',
        'Extract the grade level from the document or infer it from content complexity.',
        'Focus on topics that would work well for generating learning pathways.',
        'Limit to the 5-8 most important topics to avoid overwhelming the user.',
      ].join(' '),
      prompt: [
        'Extract learning topics from this lesson plan:',
        '',
        text.slice(0, 8000), // Limit text to avoid token limits
      ].join('\n'),
    });

    return NextResponse.json({
      filename: file.name,
      topics: result.output.topics,
      textLength: text.length,
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
