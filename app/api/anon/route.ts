import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(_req: NextRequest) {
  try {
    const supabase = createServerClient();

    // Atomically increment anon_user_number and return the new value
    const { data, error } = await supabase.rpc('increment_counter', {
      p_name: 'anon_user_number',
    });

    if (error) {
      console.error('increment_counter error:', error);
      return NextResponse.json({ error: 'Failed to assign user number' }, { status: 500 });
    }

    return NextResponse.json({ anon_user_number: data as number });
  } catch (err) {
    console.error('/api/anon error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
