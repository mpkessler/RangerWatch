'use client';

import { useEffect, useState } from 'react';

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari when NOT already installed as PWA
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window.navigator as Navigator & { standalone?: boolean }).standalone;

    const isDismissed = localStorage.getItem('rw_ios_banner_dismissed') === '1';

    if (isIOS && !isDismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem('rw_ios_banner_dismissed', '1');
    setShow(false);
  }

  return (
    <div
      role="banner"
      className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center gap-3 z-40 shrink-0"
      style={{ animation: 'slideUpFade 300ms cubic-bezier(0.32,0.72,0,1) both' }}
    >
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm1 10H9v-2h4v2zm0-4H9V6h4v2z"/>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white mb-0.5">Install RangerWatch</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Tap{' '}
          <svg viewBox="0 0 24 24" className="inline w-3.5 h-3.5 mb-0.5" fill="currentColor">
            <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
          </svg>{' '}
          Share → <strong className="text-slate-200">Add to Home Screen</strong>
        </p>
      </div>
      <button
        onClick={dismiss}
        className="text-slate-500 hover:text-slate-300 shrink-0 p-0.5"
        aria-label="Dismiss install banner"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

    </div>
  );
}
