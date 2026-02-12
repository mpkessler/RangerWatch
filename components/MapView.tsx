'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { Sighting } from '@/lib/types';
import { getRecencyColor, isOlderThan24h } from '@/lib/utils';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

type PinPos = { x: number; y: number; containerW: number; containerH: number };

interface Props {
  sightings: Sighting[];
  selectedSightingId: string | null;
  reportMode: boolean;
  userLocation: { lat: number; lng: number } | null;
  onSightingSelect: (sighting: Sighting) => void;
  onLocationDrop: (lat: number, lng: number) => void;
  onMapBackgroundClick?: () => void;
  onSightingProjected?: (pos: PinPos | null) => void;
}

function sightingsToGeoJSON(sightings: Sighting[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sightings.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        tag: s.tag,
        created_at: s.created_at,
        faded: isOlderThan24h(s.created_at) ? 1 : 0,
        color: getRecencyColor(s.created_at),
        checkin_count: s.checkin_count,
      },
    })),
  };
}

export default function MapView({
  sightings,
  selectedSightingId,
  reportMode,
  userLocation,
  onSightingSelect,
  onLocationDrop,
  onMapBackgroundClick,
  onSightingProjected,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // Use refs for values used inside map event handlers to avoid stale closures
  const reportModeRef = useRef(reportMode);
  reportModeRef.current = reportMode;
  const sightingsRef = useRef(sightings);
  sightingsRef.current = sightings;
  const onSightingSelectRef = useRef(onSightingSelect);
  onSightingSelectRef.current = onSightingSelect;
  const onLocationDropRef = useRef(onLocationDrop);
  onLocationDropRef.current = onLocationDrop;
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  onMapBackgroundClickRef.current = onMapBackgroundClick;
  const onSightingProjectedRef = useRef(onSightingProjected);
  onSightingProjectedRef.current = onSightingProjected;
  const selectedSightingIdRef = useRef(selectedSightingId);
  selectedSightingIdRef.current = selectedSightingId;
  const hasFlewRef = useRef(false);

  // ── Initialise map ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : [-98.5795, 39.8283]; // continental US fallback

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('error', (evt) => {
      // eslint-disable-next-line no-console
      console.error('MapLibre error:', evt.error ?? evt);
    });

    // ── Sources + layers ──────────────────────────────────────────
    // style.load fires on initial load; keeping it here is safe and mirrors
    // how it works if setStyle() were ever called in the future.
    map.on('style.load', () => {
      if (!mapRef.current) return;

      if (!map.getSource('sightings')) {
        map.addSource('sightings', {
          type: 'geojson',
          data: sightingsToGeoJSON([]),
          cluster: true,
          clusterMaxZoom: 16,
          clusterRadius: 30,
        });

        // Cluster circles
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'sightings',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#475569',
            'circle-radius': ['step', ['get', 'point_count'], 12, 10, 16, 30, 20],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#94a3b8',
          },
        });

        // Cluster count label
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'sightings',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
            'text-size': 13,
          },
          paint: { 'text-color': '#f1f5f9' },
        });

        // Individual pin circles
        map.addLayer({
          id: 'pins',
          type: 'circle',
          source: 'sightings',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-opacity': ['case', ['==', ['get', 'faded'], 1], 0.35, 1.0],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
            'circle-stroke-opacity': ['case', ['==', ['get', 'faded'], 1], 0.35, 1.0],
          },
        });

        // Selected pin highlight ring
        map.addLayer({
          id: 'pin-selected',
          type: 'circle',
          source: 'sightings',
          filter: ['==', ['get', 'id'], ''],
          paint: {
            'circle-color': 'rgba(0,0,0,0)',
            'circle-radius': 10,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#fff',
          },
        });
      }

      // Restore data and selection state
      (map.getSource('sightings') as maplibregl.GeoJSONSource | undefined)
        ?.setData(sightingsToGeoJSON(sightingsRef.current));
      if (map.getLayer('pin-selected')) {
        map.setFilter('pin-selected', ['==', ['get', 'id'], selectedSightingIdRef.current ?? '']);
      }
    });

    // ── One-time setup: resize + event listeners ──────────────────
    map.on('load', () => {
      if (!mapRef.current) return;

      map.resize();

      // Click on individual pin
      map.on('click', 'pins', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as { id: string };
        const found = sightingsRef.current.find((s) => s.id === props.id);
        if (found) onSightingSelectRef.current(found);
      });

      // Click on cluster → zoom in
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const src = map.getSource('sightings') as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: zoom ?? 14 });
        }).catch(() => {});
      });

      // Map background click — drop pin in report mode, or dismiss preview otherwise
      map.on('click', (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['pins', 'clusters'] });
        if (hit.length > 0) return;
        if (reportModeRef.current) {
          onLocationDropRef.current(e.lngLat.lat, e.lngLat.lng);
        } else {
          onMapBackgroundClickRef.current?.();
        }
      });

      // Pointer cursors
      map.on('mouseenter', 'pins', () => { if (!reportModeRef.current) map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'pins', () => { if (!reportModeRef.current) map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'clusters', () => { if (!reportModeRef.current) map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { if (!reportModeRef.current) map.getCanvas().style.cursor = ''; });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to user location when it becomes available (once) ──────
  useEffect(() => {
    if (!userLocation || hasFlewRef.current) return;
    const map = mapRef.current;
    if (!map) return;

    hasFlewRef.current = true;
    if (map.isStyleLoaded()) {
      map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, speed: 1.5 });
    } else {
      map.once('load', () => {
        map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, speed: 1.5 });
      });
    }
  }, [userLocation]);

  // ── Update sightings source when data changes ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource('sightings') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(sightingsToGeoJSON(sightings));
    };
    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once('style.load', update);
    }
  }, [sightings]);

  // ── Highlight selected pin + project its screen position ─────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('pin-selected')) return;
    map.setFilter('pin-selected', ['==', ['get', 'id'], selectedSightingId ?? '']);

    if (selectedSightingId && onSightingProjectedRef.current) {
      const s = sightingsRef.current.find((s) => s.id === selectedSightingId);
      if (s) {
        const pt = map.project([s.lng, s.lat]);
        const canvas = map.getCanvas();
        onSightingProjectedRef.current({
          x: pt.x, y: pt.y,
          containerW: canvas.offsetWidth, containerH: canvas.offsetHeight,
        });
      }
    } else {
      onSightingProjectedRef.current?.(null);
    }
  }, [selectedSightingId]);

  // ── Drop mode cursor ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = reportMode ? 'crosshair' : '';
  }, [reportMode]);

  // ── User location dot marker ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      return;
    }
    const el = document.createElement('div');
    el.style.cssText = `
      width:14px;height:14px;border-radius:50%;
      background:#3B82F6;border:2px solid #fff;
      box-shadow:0 0 0 4px rgba(59,130,246,0.3);
    `;
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
  }, [userLocation]);

  // ── Expose flyToSighting on the container element ─────────────
  const flyToSighting = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2 });
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as HTMLElement & { flyToSighting?: typeof flyToSighting }).flyToSighting = flyToSighting;
    }
  }, [flyToSighting]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      aria-label="Map"
    />
  );
}
