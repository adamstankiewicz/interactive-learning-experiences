'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RosterStudent, SocialPreference } from '@/lib/roster/types';

type Props = {
  existing?: RosterStudent;
  onClose: () => void;
  onSaved: (student: RosterStudent) => void;
};

const SOCIAL_OPTIONS: { value: SocialPreference; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'small-group', label: 'Small group' },
  { value: 'whole-class', label: 'Whole class' },
];

const LEARNING_STYLES = ['visual-spatial', 'reading-writing', 'kinesthetic-tactile', 'auditory'];

function toList(v: string): string[] {
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}
function fromList(v: string[]): string {
  return v.join(', ');
}

const DURATION = 200;

export function AddStudentModal({ existing, onClose, onSaved }: Props) {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(onClose, DURATION);
  }

  const [name, setName] = useState(existing?.name ?? '');
  const [grade, setGrade] = useState(existing?.grade ?? '5');
  const [primaryStyle, setPrimaryStyle] = useState(existing?.learningStyle.primary ?? 'visual-spatial');
  const [secondaryStyle, setSecondaryStyle] = useState(existing?.learningStyle.secondary ?? 'reading-writing');
  const [preferred, setPreferred] = useState(fromList(existing?.preferredActivityTypes ?? []));
  const [avoid, setAvoid] = useState(fromList(existing?.avoidActivityTypes ?? []));
  const [adaptations, setAdaptations] = useState(existing?.adaptations ?? '');
  const [pacing, setPacing] = useState(existing?.pacingPreference ?? '');
  const [attention, setAttention] = useState(String(existing?.attentionSpanMinutes ?? 20));
  const [social, setSocial] = useState<SocialPreference>(existing?.socialPreference ?? 'pairs');
  const [motivators, setMotivators] = useState(fromList(existing?.motivators ?? []));
  const [feedback, setFeedback] = useState(existing?.feedbackStyle ?? '');
  const [readingLevel, setReadingLevel] = useState(existing?.readingLevelGrade ?? '');

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');

    const payload: Omit<RosterStudent, 'id'> = {
      name: name.trim(),
      grade,
      learningStyle: { primary: primaryStyle, secondary: secondaryStyle },
      preferredActivityTypes: toList(preferred),
      avoidActivityTypes: toList(avoid),
      adaptations,
      pacingPreference: pacing,
      attentionSpanMinutes: Number(attention) || 20,
      socialPreference: social,
      motivators: toList(motivators),
      feedbackStyle: feedback,
      readingLevelGrade: readingLevel,
    };

    try {
      let res: Response;
      if (existing) {
        res = await fetch(`/api/roster/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Save failed.');
      }

      const student = await res.json() as RosterStudent;
      setVisible(false);
      setTimeout(() => onSaved(student), DURATION);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ transitionDuration: `${DURATION}ms` }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-[opacity,backdrop-filter] ${visible ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'}`}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        style={{ transitionDuration: `${DURATION}ms` }}
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-[opacity,transform] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {existing ? 'Edit Student' : 'Add Student'}
          </h2>
          <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Name + grade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Grade</label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 5" />
            </div>
          </div>

          {/* Learning styles */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Learning style</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">Primary</p>
                <div className="flex flex-col gap-1">
                  {LEARNING_STYLES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="primary" value={s} checked={primaryStyle === s} onChange={() => setPrimaryStyle(s)} className="accent-indigo-600" />
                      <span className="text-slate-700 dark:text-slate-300">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Secondary</p>
                <div className="flex flex-col gap-1">
                  {LEARNING_STYLES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="secondary" value={s} checked={secondaryStyle === s} onChange={() => setSecondaryStyle(s)} className="accent-indigo-600" />
                      <span className="text-slate-700 dark:text-slate-300">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Social preference */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Social preference</label>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSocial(o.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    social === o.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Attention + reading level */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Attention span (min)</label>
              <Input type="number" value={attention} onChange={(e) => setAttention(e.target.value)} min={1} max={60} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Reading level (grade)</label>
              <Input value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} placeholder="e.g. 5" />
            </div>
          </div>

          {/* Preferred + avoid activities */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Preferred activities <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <Input value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="e.g. diagramming, choice-board" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Avoid activities <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <Input value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. lecture, cold-call-qa" />
          </div>

          {/* Motivators */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Motivators / interests <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <Input value={motivators} onChange={(e) => setMotivators(e.target.value)} placeholder="e.g. space, animals" />
          </div>

          {/* Pacing */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Pacing preference</label>
            <Input value={pacing} onChange={(e) => setPacing(e.target.value)} placeholder="e.g. fast, short bursts" />
          </div>

          {/* Feedback style */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Feedback style</label>
            <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. immediate verbal, written only" />
          </div>

          {/* Adaptations */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Adaptations & notes</label>
            <Textarea value={adaptations} onChange={(e) => setAdaptations(e.target.value)} placeholder="IEP notes, accommodations, or anything the pathway should account for..." rows={3} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 px-6 pb-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Button variant="ghost" onClick={dismiss} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Student'}
          </Button>
        </div>
      </div>
    </div>
  );
}
