'use client';

import type { FilterRange } from '@/lib/types';
import { FILTER_LABELS } from '@/lib/utils';

const RANGES: FilterRange[] = ['24h', '2d', '3d', '7d', '30d', '90d'];

interface Props {
  filter: FilterRange;
  recentlyMode: boolean;
  onFilterChange: (f: FilterRange) => void;
  onRecentlyToggle: () => void;
}

export default function TopBar({ filter, recentlyMode, onFilterChange, onRecentlyToggle }: Props) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 backdrop-blur border-b border-slate-700 safe-top z-20 shrink-0">
      {/* Title */}
      <div className="flex items-center gap-2 min-w-0">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-400 shrink-0" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        <span className="font-bold text-white tracking-tight text-base truncate">RangerWatch</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Filter dropdown — hidden when recently mode is on */}
        {!recentlyMode && (
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as FilterRange)}
            className="text-xs bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter time range"
          >
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {FILTER_LABELS[r]}
              </option>
            ))}
          </select>
        )}

        {/* Recently toggle */}
        <button
          onClick={onRecentlyToggle}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            recentlyMode
              ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-emerald-500 hover:text-emerald-400'
          }`}
          aria-pressed={recentlyMode}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${recentlyMode ? 'bg-white animate-pulse' : 'bg-slate-500'}`}
          />
          Recently
        </button>
      </div>
    </header>
  );
}
