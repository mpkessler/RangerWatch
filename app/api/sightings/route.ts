import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isValidLatLng, isValidTag, FILTER_INTERVAL } from '@/lib/utils';
import type { FilterRange, Sighting } from '@/lib/types';

// ──────────────────────────────────────────────────────────────
// GET /api/sightings?range=24h|2d|3d|7d|30d|90d&recently=0|1
// ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const recently = params.get('recently') === '1';
  const range = (params.get('range') as FilterRange) || '24h';

  let interval: string;
  if (recently) {
    interval = '90 minutes';
  } else {
    interval = FILTER_INTERVAL[range] ?? FILTER_INTERVAL['24h'];
  }

  try {
    const supabase = createServerClient();

    // Fetch sightings with checkin aggregates in a single query
    const { data: sightings, error: sErr } = await supabase
      .from('sightings')
      .select('id, created_at, tag, description, media_url, lat, lng')
      .eq('is_deleted', false)
      .gte('created_at', new Date(Date.now() - intervalToMs(interval)).toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (sErr) {
      console.error('GET sightings error:', sErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!sightings || sightings.length === 0) {
      return NextResponse.json([]);
    }

    const ids = sightings.map((s) => s.id);

    // Fetch checkin aggregates for these sightings
    const { data: checkins, error: cErr } = await supabase
      .from('checkins')
      .select('sighting_id, created_at')
      .in('sighting_id', ids);

    if (cErr) {
      console.error('GET checkins error:', cErr);
      // Non-fatal: return sightings with zero checkins
    }

    // Build lookup maps
    const countMap: Record<string, number> = {};
    const lastMap: Record<string, string> = {};
    for (const c of checkins ?? []) {
      countMap[c.sighting_id] = (countMap[c.sighting_id] ?? 0) + 1;
      if (!lastMap[c.sighting_id] || c.created_at > lastMap[c.sighting_id]) {
        lastMap[c.sighting_id] = c.created_at;
      }
    }

    const result: Sighting[] = sightings.map((s) => ({
      ...s,
      checkin_count: countMap[s.id] ?? 0,
      last_checkin_at: lastMap[s.id] ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('/api/sightings GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/sightings
// ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tag, description, lat, lng, device_uuid, anon_user_number, media_url } = body as {
    tag: string;
    description?: string;
    lat: number;
    lng: number;
    device_uuid: string;
    anon_user_number: number;
    media_url?: string;
  };

  // ── Validation ──────────────────────────────────────────────
  if (!isValidTag(tag)) {
    return NextResponse.json({ error: 'Invalid tag. Must be Sighting, Warning, or Ticket.' }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: 'Invalid lat/lng coordinates.' }, { status: 400 });
  }
  if (!device_uuid || typeof device_uuid !== 'string') {
    return NextResponse.json({ error: 'device_uuid is required.' }, { status: 400 });
  }
  if (typeof anon_user_number !== 'number') {
    return NextResponse.json({ error: 'anon_user_number is required.' }, { status: 400 });
  }

  // Validate media_url is a Supabase storage URL if provided
  if (media_url && typeof media_url === 'string') {
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!media_url.startsWith(supabaseHost + '/storage/v1/object/public/')) {
      return NextResponse.json({ error: 'Invalid media_url origin.' }, { status: 400 });
    }
  }

  try {
    const supabase = createServerClient();

    // ── Rate limit: max 3 pins per hour per device ──────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rErr } = await supabase
      .from('sightings')
      .select('*', { count: 'exact', head: true })
      .eq('device_uuid', device_uuid)
      .eq('is_deleted', false)
      .gte('created_at', oneHourAgo);

    if (rErr) {
      console.error('Rate limit check error:', rErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if ((recentCount ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Rate limit: you can only post 3 sightings per hour.' },
        { status: 429 },
      );
    }

    // ── Anti-duplicate: nearest sighting within 25 m, last 90 min ─
    const { data: nearby, error: nErr } = await supabase.rpc('find_nearby_sighting', {
      p_lat: Number(lat),
      p_lng: Number(lng),
    });

    if (nErr) {
      console.error('find_nearby_sighting error:', nErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const nearbyRows = nearby as Array<{ id: string }> | null;
    if (nearbyRows && nearbyRows.length > 0) {
      return NextResponse.json(
        { error: 'A recent sighting already exists here.', code: 'DUPLICATE', existing_sighting_id: nearbyRows[0].id },
        { status: 409 },
      );
    }

    // ── Insert ──────────────────────────────────────────────────
    const { data: created, error: iErr } = await supabase
      .from('sightings')
      .insert({
        tag,
        description: description || null,
        media_url: media_url || null,
        lat: Number(lat),
        lng: Number(lng),
        // PostGIS POINT: WKT format (longitude first!)
        location: `POINT(${Number(lng)} ${Number(lat)})`,
        anon_user_number,
        device_uuid,
      })
      .select('id, created_at, tag, description, media_url, lat, lng')
      .single();

    if (iErr || !created) {
      console.error('Insert sighting error:', iErr);
      return NextResponse.json({ error: 'Failed to create sighting' }, { status: 500 });
    }

    const result: Sighting = { ...created, checkin_count: 0, last_checkin_at: null };
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('/api/sightings POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────
function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    '90 minutes': 90 * 60 * 1000,
    '24 hours':   24 * 60 * 60 * 1000,
    '2 days':      2 * 24 * 60 * 60 * 1000,
    '3 days':      3 * 24 * 60 * 60 * 1000,
    '7 days':      7 * 24 * 60 * 60 * 1000,
    '30 days':    30 * 24 * 60 * 60 * 1000,
    '90 days':    90 * 24 * 60 * 60 * 1000,
  };
  return map[interval] ?? map['24 hours'];
}
