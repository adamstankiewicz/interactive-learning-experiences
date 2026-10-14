'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DrawTheCurve } from '@/components/widgets/DrawTheCurve';
import type { DrawTheCurveSpec } from '@/lib/pathway/schema';

/**
 * The English example is the one that makes the case. Freytag's pyramid is
 * already a curve — teachers draw it on whiteboards constantly — and a chart
 * widget turning up in a literature lesson is the clearest possible evidence
 * that this isn't a maths tool wearing a costume.
 */
const SPECS: { label: string; standard: string; spec: DrawTheCurveSpec }[] = [
  {
    label: 'English',
    standard: 'RL.6.3 · plot and its arc',
    spec: {
      kind: 'draw-the-curve',
      learningComponentId: null,
      prompt: 'Drag each point to show how the tension changes across a story.',
      setup:
        'Think about almost any story you have read. It opens by introducing people and a place, a problem develops and gets worse, everything comes to a head, and then things settle before the ending.',
      xAxis: {
        label: 'Stage of the story',
        points: [
          { id: 'exposition', label: 'Exposition' },
          { id: 'rising', label: 'Rising action' },
          { id: 'climax', label: 'Climax' },
          { id: 'falling', label: 'Falling action' },
          { id: 'resolution', label: 'Resolution' },
        ],
      },
      yAxis: { label: 'Tension', lowLabel: 'calm', highLabel: 'intense' },
      actual: [
        { pointId: 'exposition', value: 15 },
        { pointId: 'rising', value: 55 },
        { pointId: 'climax', value: 95 },
        { pointId: 'falling', value: 40 },
        { pointId: 'resolution', value: 12 },
      ],
      reveal:
        'Tension climbs through the rising action as the conflict builds, spikes at the climax where it finally breaks, then drops away fast. The fall is steeper than the climb — once the conflict resolves, a story rarely lingers.',
      hint: 'Think about where the story is most uncomfortable to read, and what happens to that feeling afterwards.',
    },
  },
  {
    label: 'Science',
    standard: 'MS-PS2 · motion graphs',
    spec: {
      kind: 'draw-the-curve',
      learningComponentId: null,
      prompt: "Drag each point to show how far Ana is from home during her walk.",
      setup:
        "Ana leaves home and walks steadily to the corner shop, arriving after five minutes. She spends the next five minutes inside choosing what to buy. Then she walks on to her friend's house, arriving fifteen minutes after she set off, and stays there.",
      xAxis: {
        label: 'Time',
        points: [
          { id: 't0', label: 'Leaves' },
          { id: 't1', label: '5 min' },
          { id: 't2', label: '10 min' },
          { id: 't3', label: '15 min' },
          { id: 't4', label: '20 min' },
        ],
      },
      yAxis: { label: 'Distance from home', lowLabel: 'at home', highLabel: 'far away' },
      actual: [
        { pointId: 't0', value: 0 },
        { pointId: 't1', value: 45 },
        { pointId: 't2', value: 45 },
        { pointId: 't3', value: 90 },
        { pointId: 't4', value: 90 },
      ],
      reveal:
        'Ana walks away from home, stops for five minutes at the shop, walks further, then arrives and stays. A flat stretch does not mean she went back — it means she stopped. Distance stays the same while she is standing still.',
      hint: 'What does a flat line mean on a distance graph? It is not the same as walking back.',
    },
  },
  {
    label: 'History',
    standard: 'RH.6-8 · change over time',
    spec: {
      kind: 'draw-the-curve',
      learningComponentId: null,
      prompt: "Drag each point to show a typical industrial city's population across the 1800s.",
      setup:
        'In 1800 this was a small market town. The first factories opened in the 1820s, and more followed every decade as machines replaced handwork. Railways arrived mid-century, making it far easier for people to leave farms and come to the city for work.',
      xAxis: {
        label: 'Decade',
        points: [
          { id: 'd1800', label: '1800' },
          { id: 'd1830', label: '1830' },
          { id: 'd1860', label: '1860' },
          { id: 'd1890', label: '1890' },
        ],
      },
      yAxis: { label: 'Population', lowLabel: 'small town', highLabel: 'large city' },
      actual: [
        { pointId: 'd1800', value: 10 },
        { pointId: 'd1830', value: 30 },
        { pointId: 'd1860', value: 70 },
        { pointId: 'd1890', value: 95 },
      ],
      reveal:
        'Industrial cities grew slowly at first, then far faster as factories drew workers in from the countryside. The curve steepens rather than climbing evenly — each new decade of industry pulled in more people than the one before.',
      hint: 'Growth was not steady. Think about when the factories arrived and what that did to the rate.',
    },
  },
  {
    label: 'Math',
    standard: '8.F · linear and nonlinear',
    spec: {
      kind: 'draw-the-curve',
      learningComponentId: null,
      prompt: 'A ball is thrown straight up. Drag each point to show its height over time.',
      setup:
        'Someone throws a ball straight up from the ground. It slows as it climbs, stops for an instant at its highest point two seconds later, then falls back and lands four seconds after the throw.',
      xAxis: {
        label: 'Time after the throw',
        points: [
          { id: 'p0', label: '0s' },
          { id: 'p1', label: '1s' },
          { id: 'p2', label: '2s' },
          { id: 'p3', label: '3s' },
          { id: 'p4', label: '4s' },
        ],
      },
      yAxis: { label: 'Height', lowLabel: 'ground', highLabel: 'highest' },
      actual: [
        { pointId: 'p0', value: 5 },
        { pointId: 'p1', value: 70 },
        { pointId: 'p2', value: 95 },
        { pointId: 'p3', value: 70 },
        { pointId: 'p4', value: 5 },
      ],
      reveal:
        'The ball rises, slows to a stop at the top, then falls back — a symmetric arc, not a straight line up and a straight line down. It spends longest near the peak, which is why the curve flattens there.',
      hint: 'Does the ball climb at the same rate the whole way up? Think about what happens just before it turns around.',
    },
  },
];

export default function DrawTheCurveDemo() {
  const [index, setIndex] = useState(0);
  const active = SPECS[index]!;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/demo"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Widget gallery
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Draw the curve</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shape the line by dragging its points, then see the real one drawn over your guess. Checked
          on shape, not numbers — so a story&apos;s tension arc works the same way a motion graph does.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SPECS.map((entry, i) => (
          <Button
            key={entry.label}
            variant={i === index ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIndex(i)}
          >
            {entry.label}
          </Button>
        ))}
      </div>
      <p className="mb-6 text-xs text-muted-foreground">{active.standard}</p>

      <Card>
        <CardContent>
          {/* Keyed so switching subjects resets the chart rather than carrying
              one prediction's heights into the next. */}
          <DrawTheCurve key={active.label} spec={active.spec} />
        </CardContent>
      </Card>
    </main>
  );
}
