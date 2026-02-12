'use client';

import { useEffect, useRef, useState } from 'react';
import type { Sighting, DeviceInfo, CheckinResult } from '@/lib/types';
import {
  TAG_TEXT,
  formatRelativeTime,
  formatExactTime,
  isWithin90Minutes,
} from '@/lib/utils';

interface Props {
  sighting: Sighting;
  device: DeviceInfo | null;
  duplicateMessage?: string | null;
  onClose: () => void;
  onSightingUpdate: (updated: Partial<Sighting> & { id: string }) => void;
}

export default function PinDetailSheet({
  sighting,
  device,
  duplicateMessage,
  onClose,
  onSightingUpdate,
}: Props) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [localCheckinCount, setLocalCheckinCount] = useState(sighting.checkin_count);
  const [localLastCheckin, setLocalLastCheckin] = useState(sighting.last_checkin_at);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync when sighting prop changes (e.g. after a refresh)
  useEffect(() => {
    setLocalCheckinCount(sighting.checkin_count);
    setLocalLastCheckin(sighting.last_checkin_at);
    setCheckinSuccess(false);
    setCheckinError(null);
  }, [sighting.id, sighting.checkin_count, sighting.last_checkin_at]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const canCheckin = isWithin90Minutes(sighting.created_at);

  async function handleCheckin() {
    if (!device || !canCheckin || checkingIn) return;
    setCheckingIn(true);
    setCheckinError(null);
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sighting_id: sighting.id,
          device_uuid: device.device_uuid,
          anon_user_number: device.anon_user_number,
        }),
      });
      const data: CheckinResult | { error: string } = await res.json();
      if (!res.ok) {
        setCheckinError((data as { error: string }).error || 'Failed to check in.');
      } else {
        const result = data as CheckinResult;
        setLocalCheckinCount(result.checkin_count);
        setLocalLastCheckin(result.last_checkin_at);
        setCheckinSuccess(true);
        onSightingUpdate({
          id: sighting.id,
          checkin_count: result.checkin_count,
          last_checkin_at: result.last_checkin_at,
        });
      }
    } catch {
      setCheckinError('Network error. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  }

  const isVideo = sighting.media_url
    ? /\.(mp4|webm|mov|ogg)(\?|$)/i.test(sighting.media_url)
    : false;

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-end pointer-events-none"
      onClick={handleBackdropClick}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative pointer-events-auto bg-slate-900 rounded-t-2xl border-t border-slate-700 shadow-2xl max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 260ms cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-slate-400 hover:text-white p-1"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 pb-8 pt-2 flex flex-col gap-4">
          {/* Duplicate warning */}
          {duplicateMessage && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm px-3 py-2.5 rounded-lg">
              {duplicateMessage}
            </div>
          )}

          {/* Tag + time */}
          <div className="flex items-start justify-between gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TAG_TEXT[sighting.tag]}`}
            >
              {sighting.tag}
            </span>
            <div className="text-right text-xs text-slate-400">
              <div className="font-medium text-slate-200">{formatRelativeTime(sighting.created_at)}</div>
              <div>{formatExactTime(sighting.created_at)}</div>
            </div>
          </div>

          {/* Description */}
          {sighting.description && (
            <p className="text-sm text-slate-300 leading-relaxed">{sighting.description}</p>
          )}

          {/* Media */}
          {sighting.media_url && (
            <div className="rounded-xl overflow-hidden bg-slate-800 max-h-60">
              {isVideo ? (
                <video
                  src={sighting.media_url}
                  controls
                  playsInline
                  className="w-full max-h-60 object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sighting.media_url}
                  alt="Sighting media"
                  className="w-full max-h-60 object-cover"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {/* Check-in stats */}
          <div className="bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-xs mb-0.5">Check-ins</div>
              <div className="text-white font-bold text-xl">{localCheckinCount}</div>
            </div>
            {localLastCheckin && (
              <div className="text-right">
                <div className="text-slate-400 text-xs mb-0.5">Last check-in</div>
                <div className="text-slate-200 text-sm">{formatRelativeTime(localLastCheckin)}</div>
              </div>
            )}
          </div>

          {/* Check-in button */}
          <div className="flex flex-col gap-2">
            {checkinError && (
              <p className="text-red-400 text-xs text-center">{checkinError}</p>
            )}
            {checkinSuccess && (
              <p className="text-emerald-400 text-xs text-center">✓ Checked in!</p>
            )}
            <button
              onClick={handleCheckin}
              disabled={!canCheckin || checkingIn || checkinSuccess}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                canCheckin && !checkinSuccess
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {checkingIn
                ? 'Checking in…'
                : checkinSuccess
                ? '✓ Still There'
                : canCheckin
                ? 'Still There?'
                : 'Check-ins closed'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
