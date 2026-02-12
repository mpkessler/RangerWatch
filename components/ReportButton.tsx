'use client';

interface Props {
  reportMode: boolean;
  onEnterReport: () => void;
  onCancelReport: () => void;
}

export default function ReportButton({ reportMode, onEnterReport, onCancelReport }: Props) {
  if (reportMode) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 pointer-events-auto">
        <div className="bg-slate-800/90 text-slate-200 text-sm px-4 py-2 rounded-full backdrop-blur border border-slate-600 shadow-lg">
          Tap the map to drop a pin
        </div>
        <button
          onClick={onCancelReport}
          className="bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm px-5 py-2.5 rounded-full shadow-lg border border-slate-500 transition-colors active:scale-95"
          aria-label="Cancel report"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onEnterReport}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold text-sm px-6 py-3 rounded-full shadow-2xl shadow-emerald-500/40 transition-all active:scale-95 pointer-events-auto"
      aria-label="Report a ranger sighting"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm1 10H9v-2h4v2zm0-4H9V6h4v2z"/>
      </svg>
      Report Sighting
    </button>
  );
}
