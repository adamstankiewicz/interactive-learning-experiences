import { Nav } from '@/components/Nav';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Nav />
      {children}
    </div>
  );
}
