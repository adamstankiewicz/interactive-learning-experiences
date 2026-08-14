import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase/client';

export const runtime = 'nodejs';

/**
 * POST /api/student — mints an anonymous learner.
 *
 * Stand-in for auth. Wiring up Supabase Auth means setting `auth_user_id` here;
 * the RLS policies in supabase/schema.sql already key off that column.
 */
export async function POST() {
  if (!supabaseConfigured()) {
    return Response.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin()
    .from('students')
    .insert({ display_name: 'Learner' })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[student] insert failed', error);
    return Response.json({ error: 'Could not create learner' }, { status: 500 });
  }

  return Response.json({ studentId: data.id });
}
