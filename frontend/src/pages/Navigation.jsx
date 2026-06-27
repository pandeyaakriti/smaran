/**
 * Navigation.jsx  –  Phase 1 page
 *
 * Layout
 * ──────
 *   Desktop: map (left 60%) | sidebar (right 40%)
 *   Mobile:  map (top, fixed height) | sidebar scrolls below
 *
 * What's shown
 * ────────────
 *   • Live location dot on map
 *   • All saved locations as coloured pin markers
 *   • Nearby location banner when the user is within 100 m of a saved spot
 *   • Sidebar: list of saved locations, filterable by category
 *   • "Save location" button → opens SaveLocationModal
 *   • GPS error banner
 */

import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  MapView,
  SavedLocationsList,
  SaveLocationModal,
} from '../components/navigation';
import { useNavigation } from '../hooks/useNavigation';
import { setSelectedDestination } from '../store/navigationSlice';

const CATEGORY_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'home',     label: '🏠 Home' },
  { value: 'medical',  label: '🏥 Medical' },
  { value: 'social',   label: '☕ Social' },
  { value: 'shopping', label: '🛒 Shopping' },
  { value: 'other',    label: '📍 Other' },
];

export default function Navigation() {
  const dispatch = useDispatch();
  const { selectedDestinationId } = useSelector((s) => s.navigation);

  const { currentPosition, gpsError, locations, locationsStatus, nearbyLocation, distanceTo } =
    useNavigation();

  const [modalOpen, setModalOpen]     = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Memoised so MapView doesn't re-render on unrelated state changes.
  const handleMarkerClick = useCallback(
    (loc) => dispatch(setSelectedDestination(loc.id)),
    [dispatch]
  );

  function handleListSelect(loc) {
    dispatch(setSelectedDestination(loc.id === selectedDestinationId ? null : loc.id));
  }

  const filteredLocations =
    categoryFilter === 'all'
      ? locations
      : locations.filter((l) => l.category === categoryFilter);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Navigation</h1>
          <p className="text-xs text-gray-400">
            {currentPosition
              ? `GPS active · accuracy ±${Math.round(currentPosition.accuracy ?? 0)} m`
              : 'Waiting for GPS…'}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2
                     text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
        >
          <span>＋</span> Save location
        </button>
      </header>

      {/* ── GPS error banner ── */}
      {gpsError && (
        <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          ⚠ {gpsError}
        </div>
      )}

      {/* ── Nearby banner ── */}
      {nearbyLocation && (
        <div className="flex items-center gap-2 bg-green-50 px-4 py-2 text-sm text-green-800">
          <span className="text-base">✅</span>
          <span>
            You are near <strong>{nearbyLocation.label}</strong>
            {nearbyLocation.notes && (
              <span className="ml-1 text-green-600">— {nearbyLocation.notes}</span>
            )}
          </span>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map — fills remaining height on mobile, left panel on desktop */}
        <div className="relative h-64 w-full shrink-0 md:h-auto md:w-3/5">
          <MapView
            currentPosition={currentPosition}
            locations={locations}
            selectedId={selectedDestinationId}
            onLocationClick={handleMarkerClick}
          />

          {/* "Locate me" button overlaid on map */}
          {currentPosition && (
            <button
              onClick={() => {
                // Re-centre map: dispatching a dummy selectedDestination clear
                // will not re-fly; instead we communicate via a custom event.
                // A simpler approach: expose a ref from MapView. For Phase 1,
                // a page reload is fine — real centering comes in Phase 2.
                window.dispatchEvent(
                  new CustomEvent('nav:recenter', { detail: currentPosition })
                );
              }}
              title="Centre on my location"
              className="absolute bottom-4 right-4 z-[1000] rounded-full bg-white p-3
                         shadow-md hover:bg-gray-50 active:bg-gray-100"
            >
              🎯
            </button>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col border-l bg-white md:w-2/5">
          {/* Category filter chips */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition
                  ${categoryFilter === f.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Count */}
          <div className="border-b px-4 pb-2">
            <p className="text-xs text-gray-400">
              {locationsStatus === 'loading'
                ? 'Loading…'
                : `${filteredLocations.length} location${filteredLocations.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            <SavedLocationsList
              locations={filteredLocations}
              selectedId={selectedDestinationId}
              onSelect={handleListSelect}
              distanceTo={distanceTo}
            />
          </div>

          {/* Selected destination footer */}
          {selectedDestinationId && (() => {
            const dest = locations.find((l) => l.id === selectedDestinationId);
            const dist = dest ? distanceTo(dest.latitude, dest.longitude) : null;
            if (!dest) return null;
            return (
              <div className="border-t bg-blue-50 px-4 py-3">
                <p className="text-xs font-medium text-blue-700">Destination selected</p>
                <p className="truncate text-sm font-semibold text-blue-900">{dest.label}</p>
                {dist !== null && (
                  <p className="text-xs text-blue-600">
                    {dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`} away
                  </p>
                )}
                <button
                  onClick={() => dispatch(setSelectedDestination(null))}
                  className="mt-1 text-xs text-blue-500 underline"
                >
                  Clear
                </button>
              </div>
            );
          })()}
        </aside>
      </div>

      {/* Save location modal */}
      <SaveLocationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentPosition={currentPosition}
      />
    </div>
  );
}