'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Sighting, DeviceInfo, CheckinResult } from '@/lib/types';
import { TAG_TEXT, formatRelativeTime, isWithin90Minutes } from '@/lib/utils';

type PinPos = { x: number; y: number; containerW: number; containerH: number };

interface Props {
  sighting: Sighting;
  device: DeviceInfo | null;
  pinScreenPos?: PinPos | null;
  onClose: () => void;
  onDetails: () => void;
  onSightingUpdate: (updated: Partial<Sighting> & { id: string }) => void;
}

const PAD = 8;   // min px from container edge
const GAP = 16;  // gap between pin centre and card edge

export default function PinPreviewCard({
  sighting,
  device,
  pinScreenPos,
  onClose,
  onDetails,
  onSightingUpdate,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Start invisible; useLayoutEffect computes the correct position before
  // the first browser paint, so the user never sees an incorrect placement.
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [localCheckinCount, setLocalCheckinCount] = useState(sighting.checkin_count);

  useEffect(() => {
    setLocalCheckinCount(sighting.checkin_count);
    setCheckinSuccess(false);
    setCheckingIn(false);
  }, [sighting.id, sighting.checkin_count]);

  // Compute clamped position using actual rendered card dimensions
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const { width: cardW, height: cardH } = el.getBoundingClientRect();
    const pos = pinScreenPos;

    if (!pos) {
      // No position data yet: safe bottom-centre fallback
      setPosStyle({
        bottom: PAD * 3,
        left: '50%',
        transform: 'translateX(-50%)',
        visibility: 'visible',
      });
      return;
    }

    const { x: pinX, y: pinY, containerW, containerH } = pos;

    // Horizontal: centre on pin, clamped to container edges
    let left = Math.round(pinX - cardW / 2);
    left = Math.max(PAD, Math.min(left, containerW - cardW - PAD));

    // Vertical: prefer above pin; flip below if top clips; clamp to container
    let top = pinY - cardH - GAP;
    if (top < PAD) top = pinY + GAP;          // flip to below
    top = Math.min(top, containerH - cardH - PAD); // clamp bottom
    top = Math.max(PAD, top);                  // safety clamp top

    setPosStyle({ left, top: Math.round(top), visibility: 'visible' });
  }, [pinScreenPos]);

  const canCheckin = isWithin90Minutes(sighting.created_at);

  async function handleCheckin() {
    if (!device || !canCheckin || checkingIn || checkinSuccess) return;
    setCheckingIn(true);
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
      if (res.ok) {
        const result = data as CheckinResult;
        setLocalCheckinCount(result.checkin_count);
        setCheckinSuccess(true);
        onSightingUpdate({
          id: sighting.id,
          checkin_count: result.checkin_count,
          last_checkin_at: result.last_checkin_at,
        });
      }
    } catch {
      // silently ignore; user can open Details for full error handling
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div
      ref={cardRef}
      className="absolute z-30 w-72 pointer-events-auto"
      style={{ ...posStyle, animation: 'slideUpFade 200ms cubic-bezier(0.32,0.72,0,1) both' }}
    >
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-2xl px-3 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TAG_TEXT[sighting.tag]}`}>
            {sighting.tag}
          </span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-0.5 -mr-0.5"
            aria-label="Close preview"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <span>{formatRelativeTime(sighting.created_at)}</span>
          <span className="text-slate-600">·</span>
          <span>{localCheckinCount} check-in{localCheckinCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleCheckin}
            disabled={!canCheckin || checkingIn || checkinSuccess}
            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
              checkinSuccess
                ? 'bg-emerald-700/40 text-emerald-400 cursor-default'
                : canCheckin
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {checkingIn ? 'Checking in…' : checkinSuccess ? '✓ Still There' : canCheckin ? 'Still There?' : 'Closed'}
          </button>
          <button
            onClick={onDetails}
            className="flex-1 py-2 rounded-xl font-medium text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors active:scale-95"
          >
            Details
          </button>
        </div>
      </div>
    </div>
  );
}
