import { Nav } from '@/components/Nav';

/** "learning-commons" → "Learning Commons" for the nav's source indicator. */
function activeSourceLabel(): string {
  const id = (process.env.STANDARDS_SOURCE ?? 'learning-commons').split(',')[0]?.trim() ?? '';
  return id
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Nav sourceLabel={activeSourceLabel()} />
      {children}
    </div>
  );
}
