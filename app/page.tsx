'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceInfo, FilterRange, Sighting } from '@/lib/types';
import { initDevice } from '@/lib/device';
import TopBar from '@/components/TopBar';
import ReportButton from '@/components/ReportButton';
import RecentlyList from '@/components/RecentlyList';
import IOSInstallBanner from '@/components/IOSInstallBanner';

// MapLibre must be client-only (uses WebGL / browser globals)
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const PinPreviewCard = dynamic(() => import('@/components/PinPreviewCard'), { ssr: false });
const PinDetailSheet = dynamic(() => import('@/components/PinDetailSheet'), { ssr: false });
const ReportForm = dynamic(() => import('@/components/ReportForm'), { ssr: false });

export default function HomePage() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [filter, setFilter] = useState<FilterRange>('24h');
  const [recentlyMode, setRecentlyMode] = useState(false);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [pinScreenPos, setPinScreenPos] = useState<{ x: number; y: number; containerW: number; containerH: number } | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  // ── Init device identity ──────────────────────────────────────
  useEffect(() => {
    initDevice().then(setDevice);
  }, []);

  // ── Geolocation ───────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // silently fail
      { timeout: 10_000, enableHighAccuracy: false },
    );
  }, []);

  // ── Fetch sightings ───────────────────────────────────────────
  const fetchSightings = useCallback(
    async (range: FilterRange, recently: boolean) => {
      if (fetchController.current) fetchController.current.abort();
      const ctrl = new AbortController();
      fetchController.current = ctrl;

      const params = new URLSearchParams(
        recently ? { recently: '1' } : { range },
      );

      try {
        const res = await fetch(`/api/sightings?${params}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data: Sighting[] = await res.json();
        setSightings(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Fetch sightings error', err);
      }
    },
    [],
  );

  // Initial fetch + re-fetch when filter/mode changes
  useEffect(() => {
    fetchSightings(filter, recentlyMode);
    // Refresh every 60 seconds
    const timer = setInterval(() => fetchSightings(filter, recentlyMode), 60_000);
    return () => clearInterval(timer);
  }, [filter, recentlyMode, fetchSightings]);

  // ── Check for duplicates then enter form ──────────────────────
  async function handleLocationDrop(lat: number, lng: number) {
    setPendingLocation({ lat, lng });

    try {
      const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (data.duplicate && data.existing_sighting_id) {
        // Find existing sighting in our loaded list
        let existing = sightings.find((s) => s.id === data.existing_sighting_id) ?? null;

        if (!existing) {
          // Fetch it directly if not in current window
          const sr = await fetch(`/api/sightings?range=90d`);
          if (sr.ok) {
            const all: Sighting[] = await sr.json();
            existing = all.find((s) => s.id === data.existing_sighting_id) ?? null;
          }
        }

        setReportMode(false);
        setDuplicateMessage('A recent sighting is already reported here. Please check in instead.');
        setSelectedSighting(existing);
        setShowDetailSheet(true); // skip preview; show full sheet for duplicate
        return;
      }
    } catch {
      // If nearby check fails, still let user proceed (server will double-check)
    }

    setReportMode(false);
    setShowReportForm(true);
  }

  function handleSightingSelect(sighting: Sighting) {
    setDuplicateMessage(null);
    setSelectedSighting(sighting);
    setShowDetailSheet(false); // always start with compact preview
    setReportMode(false);
  }

  function handleCloseSheet() {
    setSelectedSighting(null);
    setShowDetailSheet(false);
    setDuplicateMessage(null);
    setPinScreenPos(null);
  }

  function handleReportSuccess(newSighting: Sighting) {
    setSightings((prev) => [newSighting, ...prev]);
    setShowReportForm(false);
    setPendingLocation(null);
    setSelectedSighting(newSighting);
    setShowDetailSheet(false); // show preview card after reporting
  }

  function handleSightingUpdate(updated: Partial<Sighting> & { id: string }) {
    setSightings((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
    );
    setSelectedSighting((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  }

  function enterReportMode() {
    setSelectedSighting(null);
    setShowDetailSheet(false);
    setDuplicateMessage(null);
    setShowReportForm(false);
    setReportMode(true);
  }

  function cancelReportMode() {
    setReportMode(false);
    setPendingLocation(null);
  }

  function toggleRecentlyMode() {
    setRecentlyMode((v) => {
      if (!v) {
        // Entering recently mode: cancel any active report actions
        setReportMode(false);
        setShowReportForm(false);
        setSelectedSighting(null);
        setShowDetailSheet(false);
      }
      return !v;
    });
  }

  const showReport = !recentlyMode && !showReportForm && !selectedSighting;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-900">
      {/* Top bar */}
      <TopBar
        filter={filter}
        recentlyMode={recentlyMode}
        onFilterChange={(f) => { setFilter(f); }}
        onRecentlyToggle={toggleRecentlyMode}
      />

      {/* iOS install banner — below nav, above map */}
      <IOSInstallBanner />

      {/* Recently list drawer */}
      {recentlyMode && (
        <RecentlyList
          sightings={sightings}
          onSelect={(s) => {
            handleSightingSelect(s);
          }}
        />
      )}

      {/* Map area */}
      <div className="relative flex-1 overflow-hidden">
        <MapView
          sightings={sightings}
          selectedSightingId={selectedSighting?.id ?? null}
          reportMode={reportMode}
          userLocation={userLocation}
          onSightingSelect={handleSightingSelect}
          onLocationDrop={handleLocationDrop}
          onMapBackgroundClick={handleCloseSheet}
          onSightingProjected={setPinScreenPos}
        />

        {/* Report button */}
        {showReport && (
          <ReportButton
            reportMode={reportMode}
            onEnterReport={enterReportMode}
            onCancelReport={cancelReportMode}
          />
        )}

        {/* Compact preview card (tap pin → preview) */}
        {selectedSighting && !showDetailSheet && (
          <PinPreviewCard
            key={selectedSighting.id}
            sighting={selectedSighting}
            device={device}
            pinScreenPos={pinScreenPos}
            onClose={handleCloseSheet}
            onDetails={() => setShowDetailSheet(true)}
            onSightingUpdate={handleSightingUpdate}
          />
        )}

        {/* Full detail sheet (Details button or duplicate flow) */}
        {selectedSighting && showDetailSheet && (
          <PinDetailSheet
            sighting={selectedSighting}
            device={device}
            duplicateMessage={duplicateMessage}
            onClose={handleCloseSheet}
            onSightingUpdate={handleSightingUpdate}
          />
        )}

        {/* Report form */}
        {showReportForm && pendingLocation && (
          <ReportForm
            location={pendingLocation}
            device={device}
            onSuccess={handleReportSuccess}
            onCancel={() => { setShowReportForm(false); setPendingLocation(null); }}
          />
        )}
      </div>
    </div>
  );
}
