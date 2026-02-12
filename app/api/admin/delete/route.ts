import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// Auth is handled by middleware.ts for /api/admin/* paths.
// This route only soft-deletes a sighting.

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sighting_id } = body as { sighting_id?: string };
  if (!sighting_id) {
    return NextResponse.json({ error: 'sighting_id is required.' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('sightings')
      .update({ is_deleted: true })
      .eq('id', sighting_id)
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Sighting not found or already deleted.' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: data.id });
  } catch (err) {
    console.error('/api/admin/delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
