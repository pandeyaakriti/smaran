/**
 * MapView.jsx
 *
 * Renders a Leaflet map with:
 *   • A pulsing blue dot for the user's live location.
 *   • A marker for each saved location (coloured by category).
 *   • A highlight ring on the selected destination.
 *
 * Install:  npm install leaflet react-leaflet
 * CSS:      add  import 'leaflet/dist/leaflet.css';  in main.jsx
 *
 * Props
 * ─────
 *   currentPosition    { latitude, longitude, accuracy }  – from useNavigation
 *   locations          SavedLocation[]                    – from Redux
 *   selectedId         string | null                      – destination id
 *   onLocationClick    (location) => void                 – marker tap handler
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

// Fix Leaflet's broken default icon paths when bundled with Vite.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Colour per category (matches the badge colours in SavedLocationsList).
const CATEGORY_COLOUR = {
  home:     '#3B82F6', // blue
  medical:  '#EF4444', // red
  social:   '#10B981', // green
  shopping: '#F59E0B', // amber
  other:    '#6B7280', // grey
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

function svgIcon(colour, selected) {
  const svg = makePinSvg(colour, selected);
  return L.divIcon({
    html: svg,
    className: '',        // remove Leaflet's default white box
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

export function MapView({
  currentPosition,
  locations = [],
  selectedId = null,
  onLocationClick,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const locationMarkersRef = useRef({}); // { [id]: L.Marker }

  // ── Initialise map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return; // already created

    const defaultCenter = [27.7172, 85.3240]; // Kathmandu as initial fallback
    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Update user's live position ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPosition) return;

    const { latitude: lat, longitude: lng, accuracy } = currentPosition;
    const latlng = [lat, lng];

    if (!userMarkerRef.current) {
      // First fix — create the marker and fly to it.
      const pulseIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:18px;height:18px;
            border-radius:50%;
            background:#3B82F6;
            border:3px solid white;
            box-shadow:0 0 0 0 rgba(59,130,246,0.6);
            animation:navPulse 2s infinite;
          "></div>
          <style>
            @keyframes navPulse{
              0%{box-shadow:0 0 0 0 rgba(59,130,246,0.6)}
              70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}
              100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}
            }
          </style>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      userMarkerRef.current = L.marker(latlng, {
        icon: pulseIcon,
        zIndexOffset: 1000,
        title: 'You are here',
      }).addTo(map);

      accuracyCircleRef.current = L.circle(latlng, {
        radius: accuracy ?? 30,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map);

      map.flyTo(latlng, 16, { duration: 1.2 });
    } else {
      userMarkerRef.current.setLatLng(latlng);
      accuracyCircleRef.current.setLatLng(latlng);
      if (accuracy) accuracyCircleRef.current.setRadius(accuracy);
    }
  }, [currentPosition]);

  // ── Sync saved-location markers ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(locations.map((l) => l.id));

    // Remove markers for deleted locations.
    for (const id of Object.keys(locationMarkersRef.current)) {
      if (!currentIds.has(id)) {
        locationMarkersRef.current[id].remove();
        delete locationMarkersRef.current[id];
      }
    }

    // Add or update markers.
    for (const loc of locations) {
      const colour = CATEGORY_COLOUR[loc.category] ?? CATEGORY_COLOUR.other;
      const isSelected = loc.id === selectedId;
      const icon = svgIcon(colour, isSelected);

      if (locationMarkersRef.current[loc.id]) {
        locationMarkersRef.current[loc.id].setIcon(icon);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(map)
          .bindTooltip(loc.label, { direction: 'top', offset: [0, -36] });

        if (onLocationClick) {
          marker.on('click', () => onLocationClick(loc));
        }

        locationMarkersRef.current[loc.id] = marker;
      }
    }
  }, [locations, selectedId, onLocationClick]);

  // ── Pan to selected destination ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const loc = locations.find((l) => l.id === selectedId);
    if (loc) {
      mapRef.current.flyTo([loc.latitude, loc.longitude], 17, { duration: 1 });
    }
  }, [selectedId, locations]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '320px', zIndex: 0, position: 'relative' }}
      aria-label="Navigation map"
    />
  );
}