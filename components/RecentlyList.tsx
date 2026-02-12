'use client';

import type { Sighting } from '@/lib/types';
import { TAG_TEXT, formatRelativeTime, isWithin90Minutes } from '@/lib/utils';

interface Props {
  sightings: Sighting[];
  onSelect: (sighting: Sighting) => void;
}

export default function RecentlyList({ sightings, onSelect }: Props) {
  // Show only pins within 90 minutes, sorted newest first
  const recent = sightings
    .filter((s) => isWithin90Minutes(s.created_at))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 max-h-48 overflow-y-auto shrink-0">
      <div className="px-3 py-2 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active now · {recent.length} pin{recent.length !== 1 ? 's' : ''}
        </h2>
      </div>

      {recent.length === 0 ? (
        <div className="px-3 py-4 text-center text-slate-500 text-sm">
          No sightings in the last 90 minutes.
        </div>
      ) : (
        <ul>
          {recent.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-800/60 active:bg-slate-800 border-b border-slate-800/60 last:border-0 transition-colors flex items-center gap-3"
              >
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TAG_TEXT[s.tag]}`}
                >
                  {s.tag}
                </span>
                <div className="flex-1 min-w-0">
                  {s.description ? (
                    <p className="text-sm text-slate-300 truncate">{s.description}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No description</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">{formatRelativeTime(s.created_at)}</div>
                  {s.checkin_count > 0 && (
                    <div className="text-xs text-emerald-400 font-medium">
                      {s.checkin_count} ✓
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
