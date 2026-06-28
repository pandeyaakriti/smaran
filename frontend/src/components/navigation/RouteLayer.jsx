/**
 * RouteLayer.jsx
 *
 * NOT a React component in the traditional sense — it's a side-effect hook
 * that draws/updates/removes Leaflet polylines on an existing map instance.
 *
 * Why not a component? MapView owns the Leaflet instance via a ref. Passing
 * the map ref down and drawing from a sibling is cleaner than wrapping
 * everything in react-leaflet's context.
 *
 * Usage (inside MapView.jsx):
 *   import { useRouteLayer } from './RouteLayer';
 *   useRouteLayer(mapRef, activeRoute, routeCandidates);
 *
 * Draws:
 *   • Faint grey lines for non-chosen candidate routes
 *   • A bold blue line for the active (best-scored) route
 *   • Colour shifts toward orange as familiarity score drops
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';

// Score → colour for the active route line.
// High familiarity = blue, low = amber.
function scoreColour(familiarityScore = 0.5) {
  if (familiarityScore >= 0.7) return '#3B82F6';  // blue
  if (familiarityScore >= 0.4) return '#F59E0B';  // amber
  return '#EF4444';                                // red (unfamiliar)
}

export function useRouteLayer(mapRef, activeRoute, routeCandidates = []) {
  const candidateLayersRef = useRef([]);
  const activeLayerRef     = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // ── Clear previous layers ──────────────────────────────────────────────
    candidateLayersRef.current.forEach(l => l.remove());
    candidateLayersRef.current = [];
    if (activeLayerRef.current) {
      activeLayerRef.current.remove();
      activeLayerRef.current = null;
    }

    if (!activeRoute) return;

    // ── Draw faint candidate routes ────────────────────────────────────────
    routeCandidates.forEach((candidate, idx) => {
      if (idx === 0) return;   // skip best — we draw it separately below
      const latlngs = candidate.geometry.map(([lng, lat]) => [lat, lng]);
      const layer   = L.polyline(latlngs, {
        color:   '#9CA3AF',
        weight:  3,
        opacity: 0.4,
        dashArray: '6 6',
      }).addTo(map);
      candidateLayersRef.current.push(layer);
    });

    // ── Draw active route ──────────────────────────────────────────────────
    const latlngs  = activeRoute.geometry.map(([lng, lat]) => [lat, lng]);
    const famScore = activeRoute.score_breakdown?.familiarity ?? 0.5;
    const colour   = scoreColour(famScore);

    // Outer glow line.
    const glowLayer = L.polyline(latlngs, {
      color:   colour,
      weight:  10,
      opacity: 0.15,
    }).addTo(map);

    // Main route line.
    const mainLayer = L.polyline(latlngs, {
      color:   colour,
      weight:  5,
      opacity: 0.85,
    }).addTo(map);

    // Bind a tooltip showing the score breakdown.
    const { time, distance, familiarity, crowd, total } =
      activeRoute.score_breakdown ?? {};
    mainLayer.bindTooltip(
      `<div style="font-size:12px;line-height:1.6">
         <strong>Route score: ${((total ?? 0) * 100).toFixed(0)}%</strong><br/>
         ⏱ Time: ${((time ?? 0) * 100).toFixed(0)}%<br/>
         📏 Distance: ${((distance ?? 0) * 100).toFixed(0)}%<br/>
         🏠 Familiarity: ${((familiarity ?? 0) * 100).toFixed(0)}%<br/>
         🏘 Quiet roads: ${((crowd ?? 0) * 100).toFixed(0)}%
       </div>`,
      { sticky: true, direction: 'top' }
    );

    // Group both layers so we can remove them together.
    activeLayerRef.current = L.layerGroup([glowLayer, mainLayer]).addTo(map);

    // Fit map to route bounds.
    if (latlngs.length > 0) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 16 });
    }

    return () => {
      candidateLayersRef.current.forEach(l => l.remove());
      candidateLayersRef.current = [];
      if (activeLayerRef.current) {
        activeLayerRef.current.remove();
        activeLayerRef.current = null;
      }
    };
  }, [activeRoute, routeCandidates, mapRef]);
}