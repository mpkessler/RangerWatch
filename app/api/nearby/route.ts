import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isValidLatLng } from '@/lib/utils';

// GET /api/nearby?lat=&lng=
// Returns the nearest non-deleted sighting within 25 m, created in the last 90 minutes.
// Used client-side before showing the Report form, so users are redirected to check in instead.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = params.get('lat');
  const lng = params.get('lng');

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase.rpc('find_nearby_sighting', {
      p_lat: Number(lat),
      p_lng: Number(lng),
    });

    if (error) {
      console.error('find_nearby_sighting error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const rows = data as Array<{ id: string }> | null;
    if (rows && rows.length > 0) {
      return NextResponse.json({ duplicate: true, existing_sighting_id: rows[0].id });
    }

    return NextResponse.json({ duplicate: false });
  } catch (err) {
    console.error('/api/nearby error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
