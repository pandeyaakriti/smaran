
/**
 * MapView.jsx — Phase 1 + Phase 2
 *
 * Added in Phase 2:
 *   • useRouteLayer hook draws the active route + candidate lines
 *   • onMapClick / pickPreview remain from Phase 1
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { useRouteLayer } from './RouteLayer';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORY_COLOUR = {
  home:     '#3B82F6',
  medical:  '#EF4444',
  social:   '#10B981',
  shopping: '#F59E0B',
  other:    '#6B7280',
};

function makePinSvg(colour, selected = false) {
  const ring = selected
    ? `<circle cx="12" cy="12" r="16" fill="none" stroke="${colour}" stroke-width="3" opacity="0.4"/>`
    : '';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      ${ring}
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
            fill="${colour}"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`;
}

function svgIcon(colour, selected = false) {
  return L.divIcon({
    html: makePinSvg(colour, selected),
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

const PICK_ICON = L.divIcon({
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
            fill="#6B7280" stroke="white" stroke-width="1.5" stroke-dasharray="3 2"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`,
  className: '',
  iconSize: [28, 42],
  iconAnchor: [14, 42],
});

export function MapView({
  currentPosition,
  locations       = [],
  selectedId      = null,
  onLocationClick,
  onMapClick      = null,
  pickPreview     = null,
  // Phase 2
  activeRoute     = null,
  routeCandidates = [],
}) {
  const containerRef       = useRef(null);
  const mapRef             = useRef(null);
  const userMarkerRef      = useRef(null);
  const accuracyCircleRef  = useRef(null);
  const locationMarkersRef = useRef({});
  const pickMarkerRef      = useRef(null);
  const onMapClickRef      = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // ── Route layer (Phase 2) ────────────────────────────────────────────────
  useRouteLayer(mapRef, activeRoute, routeCandidates);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, { center: [27.7172, 85.3240], zoom: 15 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      }
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Crosshair cursor ─────────────────────────────────────────────────────
  useEffect(() => {
    if (containerRef.current)
      containerRef.current.style.cursor = onMapClick ? 'crosshair' : '';
  }, [onMapClick]);

  // ── Pick preview pin ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickPreview) {
      const latlng = [pickPreview.latitude, pickPreview.longitude];
      if (pickMarkerRef.current) { pickMarkerRef.current.setLatLng(latlng); }
      else { pickMarkerRef.current = L.marker(latlng, { icon: PICK_ICON, zIndexOffset: 900 }).addTo(map); }
    } else {
      if (pickMarkerRef.current) { pickMarkerRef.current.remove(); pickMarkerRef.current = null; }
    }
  }, [pickPreview]);

  // ── Live position ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPosition) return;
    const { latitude: lat, longitude: lng, accuracy } = currentPosition;
    const latlng = [lat, lng];
    if (!userMarkerRef.current) {
      const pulseIcon = L.divIcon({
        className: '',
        html: `
          <div style="width:18px;height:18px;border-radius:50%;background:#3B82F6;
            border:3px solid white;box-shadow:0 0 0 0 rgba(59,130,246,0.6);
            animation:navPulse 2s infinite;"></div>
          <style>@keyframes navPulse{
            0%{box-shadow:0 0 0 0 rgba(59,130,246,0.6)}
            70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}
            100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}
          }</style>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      userMarkerRef.current = L.marker(latlng, { icon: pulseIcon, zIndexOffset: 1000, title: 'You are here' }).addTo(map);
      accuracyCircleRef.current = L.circle(latlng, {
        radius: accuracy ?? 30, color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.08, weight: 1,
      }).addTo(map);
      map.flyTo(latlng, 16, { duration: 1.2 });
    } else {
      userMarkerRef.current.setLatLng(latlng);
      accuracyCircleRef.current.setLatLng(latlng);
      if (accuracy) accuracyCircleRef.current.setRadius(accuracy);
    }
  }, [currentPosition]);

  // ── Saved location markers ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentIds = new Set(locations.map(l => l.id));
    for (const id of Object.keys(locationMarkersRef.current)) {
      if (!currentIds.has(id)) { locationMarkersRef.current[id].remove(); delete locationMarkersRef.current[id]; }
    }
    for (const loc of locations) {
      const colour    = CATEGORY_COLOUR[loc.category] ?? CATEGORY_COLOUR.other;
      const isSelected = loc.id === selectedId;
      const icon      = svgIcon(colour, isSelected);
      if (locationMarkersRef.current[loc.id]) {
        locationMarkersRef.current[loc.id].setIcon(icon);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(map)
          .bindTooltip(loc.label, { direction: 'top', offset: [0, -36] });
        if (onLocationClick) marker.on('click', () => onLocationClick(loc));
        locationMarkersRef.current[loc.id] = marker;
      }
    }
  }, [locations, selectedId, onLocationClick]);

  // ── Pan to selected destination ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedId || activeRoute) return;
    const loc = locations.find(l => l.id === selectedId);
    if (loc) mapRef.current.flyTo([loc.latitude, loc.longitude], 17, { duration: 1 });
  }, [selectedId, locations, activeRoute]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '320px', zIndex: 0, position: 'relative' }}
      aria-label="Navigation map"
    />
  );
}
