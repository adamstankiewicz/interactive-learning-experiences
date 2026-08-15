import { storageAdapter } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * POST /api/student — mints an anonymous learner.
 *
 * Stand-in for auth. Wiring up Supabase Auth means setting `auth_user_id` on
 * the `students` row in whichever `StorageAdapter` is active; the RLS
 * policies in supabase/migrations/*_init.sql already key off that column.
 */
export async function POST() {
  const studentId = await storageAdapter().createStudent();

  if (!studentId) {
    return Response.json({ error: 'Could not create learner' }, { status: 500 });
  }

  return Response.json({ studentId });
}
