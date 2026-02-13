'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import type { DeviceInfo, Sighting, Tag } from '@/lib/types';
import { VALID_TAGS, TAG_TEXT } from '@/lib/utils';
import { supabaseClient } from '@/lib/supabase-client';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;   // 8 MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;  // 25 MB

interface Props {
  location: { lat: number; lng: number };
  device: DeviceInfo | null;
  onSuccess: (sighting: Sighting) => void;
  onCancel: () => void;
}

export default function ReportForm({ location, device, onSuccess, onCancel }: Props) {
  const [tag, setTag] = useState<Tag>('Sighting');
  const [description, setDescription] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { track('ReportModalOpen'); }, []);

  function handleCancel() {
    track('ReportModalClose');
    onCancel();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video/');
    const maxBytes = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (file.size > maxBytes) {
      setError(`File too large. Max ${isVid ? '25 MB' : '8 MB'} allowed.`);
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Only image or video files are allowed.');
      e.target.value = '';
      return;
    }

    setError(null);
    setMediaFile(file);
    setIsVideo(isVid);
    setMediaPreview(URL.createObjectURL(file));
  }

  function removeMedia() {
    setMediaFile(null);
    setMediaPreview(null);
    setIsVideo(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!device) {
      setError('Device not initialised. Please refresh.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let media_url: string | undefined;

      // ── Upload media to Supabase Storage if provided ──────────
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop() ?? 'bin';
        const path = `${device.device_uuid}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabaseClient.storage
          .from('media')
          .upload(path, mediaFile, { cacheControl: '3600', upsert: false });

        if (uploadErr || !uploadData) {
          throw new Error('Media upload failed: ' + (uploadErr?.message ?? 'unknown'));
        }

        const { data: urlData } = supabaseClient.storage.from('media').getPublicUrl(uploadData.path);
        media_url = urlData.publicUrl;
      }

      // ── POST sighting ─────────────────────────────────────────
      const res = await fetch('/api/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag,
          description: description.trim() || undefined,
          lat: location.lat,
          lng: location.lng,
          device_uuid: device.device_uuid,
          anon_user_number: device.anon_user_number,
          media_url,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If a duplicate slipped through, propagate the error
        throw new Error(data.error ?? 'Failed to create sighting.');
      }

      onSuccess(data as Sighting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end pointer-events-none">
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={handleCancel} />

      {/* Sheet */}
      <div
        className="relative pointer-events-auto bg-slate-900 rounded-t-2xl border-t border-slate-700 shadow-2xl max-h-[90vh] flex flex-col"
        style={{ animation: 'slideUp 260ms cubic-bezier(0.32,0.72,0,1) both' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-slate-800">
          <h2 className="font-semibold text-white">New Sighting Report</h2>
          <button onClick={handleCancel} className="text-slate-400 hover:text-white p-1" aria-label="Cancel">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Location display */}
          <div className="text-xs text-slate-500 font-mono">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </div>

          {/* Tag picker */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Type</label>
            <div className="flex gap-2">
              {VALID_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                    tag === t
                      ? `${TAG_TEXT[t]} border-current`
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-slate-400 mb-2">
              Description <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Any details about the sighting…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Media upload */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Photo / Video <span className="text-slate-600">(optional · max 8 MB image / 25 MB video)</span>
            </label>
            {mediaPreview ? (
              <div className="relative rounded-xl overflow-hidden bg-slate-800">
                {isVideo ? (
                  <video src={mediaPreview} className="w-full max-h-40 object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview} alt="Preview" className="w-full max-h-40 object-cover" />
                )}
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"
                  aria-label="Remove media"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl py-6 text-slate-500 hover:text-slate-400 text-sm transition-colors flex flex-col items-center gap-1"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                Tap to add photo or video
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-95 mt-1"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>
      </div>

    </div>
  );
}
