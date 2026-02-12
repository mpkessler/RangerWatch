import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { CheckinResult } from '@/lib/types';

// POST /api/checkins
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sighting_id, device_uuid, anon_user_number } = body as {
    sighting_id: string;
    device_uuid: string;
    anon_user_number: number;
  };

  if (!sighting_id || !device_uuid || typeof anon_user_number !== 'number') {
    return NextResponse.json({ error: 'sighting_id, device_uuid, and anon_user_number are required.' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    // ── Sighting must exist and not be deleted ──────────────────
    const { data: sighting, error: sErr } = await supabase
      .from('sightings')
      .select('id, created_at')
      .eq('id', sighting_id)
      .eq('is_deleted', false)
      .single();

    if (sErr || !sighting) {
      return NextResponse.json({ error: 'Sighting not found.' }, { status: 404 });
    }

    // ── Check-in window: 90 minutes from creation ───────────────
    const ageMs = Date.now() - new Date(sighting.created_at).getTime();
    if (ageMs > 90 * 60 * 1000) {
      return NextResponse.json({ error: 'Check-ins are closed for this sighting (older than 90 minutes).' }, { status: 400 });
    }

    // ── Cooldown: same device cannot check-in within 10 minutes ─
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: cooldownCount, error: cdErr } = await supabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('sighting_id', sighting_id)
      .eq('device_uuid', device_uuid)
      .gte('created_at', tenMinutesAgo);

    if (cdErr) {
      console.error('Cooldown check error:', cdErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if ((cooldownCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Cooldown active: you can check in again in a few minutes.' },
        { status: 429 },
      );
    }

    // ── Insert check-in ─────────────────────────────────────────
    const { error: iErr } = await supabase.from('checkins').insert({
      sighting_id,
      device_uuid,
      anon_user_number,
    });

    if (iErr) {
      console.error('Insert checkin error:', iErr);
      return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
    }

    // ── Return updated aggregates ───────────────────────────────
    const { count: checkin_count, error: cntErr } = await supabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('sighting_id', sighting_id);

    const { data: lastRow, error: lastErr } = await supabase
      .from('checkins')
      .select('created_at')
      .eq('sighting_id', sighting_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cntErr || lastErr) {
      console.error('Aggregate query error:', cntErr ?? lastErr);
    }

    const result: CheckinResult = {
      checkin_count: checkin_count ?? 0,
      last_checkin_at: lastRow?.created_at ?? null,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('/api/checkins POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
