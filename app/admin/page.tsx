// Auth is enforced by middleware.ts — this page never renders without valid credentials.
import { createServerClient } from '@/lib/supabase-server';
import { formatExactTime } from '@/lib/utils';
import DeleteButton from './DeleteButton';

export const dynamic = 'force-dynamic';

interface AdminSighting {
  id: string;
  created_at: string;
  tag: string;
  lat: number;
  lng: number;
  device_uuid: string;
  anon_user_number: number;
  is_deleted: boolean;
  checkin_count: number;
}

interface SpammerRow {
  device_uuid: string;
  count: number;
}

async function getData() {
  const supabase = createServerClient();

  // Last 200 sightings (including deleted for admin visibility)
  const { data: sightings, error: sErr } = await supabase
    .from('sightings')
    .select('id, created_at, tag, lat, lng, device_uuid, anon_user_number, is_deleted')
    .order('created_at', { ascending: false })
    .limit(200);

  if (sErr) throw sErr;

  const ids = (sightings ?? []).map((s) => s.id);

  // Checkin counts
  const { data: checkins } = await supabase
    .from('checkins')
    .select('sighting_id')
    .in('sighting_id', ids);

  const countMap: Record<string, number> = {};
  for (const c of checkins ?? []) {
    countMap[c.sighting_id] = (countMap[c.sighting_id] ?? 0) + 1;
  }

  const enriched: AdminSighting[] = (sightings ?? []).map((s) => ({
    ...s,
    checkin_count: countMap[s.id] ?? 0,
  }));

  // Top spammers by post volume in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('sightings')
    .select('device_uuid')
    .gte('created_at', oneDayAgo);

  const spamMap: Record<string, number> = {};
  for (const r of recent ?? []) {
    spamMap[r.device_uuid] = (spamMap[r.device_uuid] ?? 0) + 1;
  }
  const spammers: SpammerRow[] = Object.entries(spamMap)
    .map(([device_uuid, count]) => ({ device_uuid, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { sightings: enriched, spammers };
}

export default async function AdminPage() {
  const { sightings, spammers } = await getData();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 font-mono text-sm">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-6">
          RangerWatch Admin
          <span className="ml-2 text-xs text-slate-500 font-normal">
            {sightings.length} sightings shown
          </span>
        </h1>

        {/* Top spammers */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Top Devices (Last 24h)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 pr-4">Device UUID</th>
                  <th className="text-right py-2">Pins (24h)</th>
                </tr>
              </thead>
              <tbody>
                {spammers.map((s) => (
                  <tr key={s.device_uuid} className="border-b border-slate-900 hover:bg-slate-900">
                    <td className="py-2 pr-4 text-slate-400">{s.device_uuid}</td>
                    <td
                      className={`py-2 text-right font-bold ${
                        s.count >= 3 ? 'text-red-400' : 'text-slate-300'
                      }`}
                    >
                      {s.count}
                    </td>
                  </tr>
                ))}
                {spammers.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-3 text-slate-600 text-center">
                      No activity in last 24h
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sightings list */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Last 200 Sightings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 pr-3">Created</th>
                  <th className="text-left py-2 pr-3">Tag</th>
                  <th className="text-left py-2 pr-3">Lat / Lng</th>
                  <th className="text-left py-2 pr-3">Device UUID</th>
                  <th className="text-right py-2 pr-3">Anon #</th>
                  <th className="text-right py-2 pr-3">Check-ins</th>
                  <th className="text-right py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sightings.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-900 hover:bg-slate-900 ${
                      s.is_deleted ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
                      {formatExactTime(s.created_at)}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          s.tag === 'Sighting'
                            ? 'bg-blue-900 text-blue-300'
                            : s.tag === 'Warning'
                            ? 'bg-amber-900 text-amber-300'
                            : 'bg-red-900 text-red-300'
                        }`}
                      >
                        {s.is_deleted ? '🗑 ' : ''}{s.tag}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500">
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </td>
                    <td className="py-2 pr-3 text-slate-500 truncate max-w-[180px]">
                      {s.device_uuid}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-400">{s.anon_user_number}</td>
                    <td className="py-2 pr-3 text-right text-slate-400">{s.checkin_count}</td>
                    <td className="py-2 text-right">
                      {!s.is_deleted && <DeleteButton sighting_id={s.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
