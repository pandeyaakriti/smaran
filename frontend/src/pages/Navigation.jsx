/**
 * Navigation.jsx — Phase 1 page
 *
 * Manages the "pick on map" flow:
 *   1. User clicks "Pick on map" inside SaveLocationModal.
 *   2. Modal closes, isPicking=true — map shows crosshair cursor + banner.
 *   3. User clicks map → pickedPosition is set, modal reopens with coords filled.
 *   4. User completes the form and saves.
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

  const [modalOpen,      setModalOpen]      = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Pick-on-map flow state
  const [isPicking,       setIsPicking]       = useState(false);
  const [pickedPosition,  setPickedPosition]  = useState(null);

  const handleMarkerClick = useCallback(
    (loc) => dispatch(setSelectedDestination(loc.id)),
    [dispatch]
  );

  function handleListSelect(loc) {
    dispatch(setSelectedDestination(loc.id === selectedDestinationId ? null : loc.id));
  }

  // User clicked "Pick on map" inside the modal.
  function handlePickFromMap() {
    setModalOpen(false);   // hide modal so the map is fully visible
    setIsPicking(true);
    setPickedPosition(null);
  }

  // User clicked a point on the map while in pick mode.
  function handleMapClick(position) {
    setPickedPosition(position);
    setIsPicking(false);
    setModalOpen(true);    // reopen modal with coords pre-filled
  }

  // User cancelled or closed modal — clear pick state too.
  function handleModalClose() {
    setModalOpen(false);
    setIsPicking(false);
    setPickedPosition(null);
  }

  const filteredLocations =
    categoryFilter === 'all'
      ? locations
      : locations.filter((l) => l.category === categoryFilter);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">

      {/* Top bar */}
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
          onClick={() => { setPickedPosition(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2
                     text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
        >
          ＋ Save location
        </button>
      </header>

      {/* GPS error */}
      {gpsError && (
        <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-700">
          ⚠ {gpsError}
        </div>
      )}

      {/* Pick-mode banner */}
      {isPicking && (
        <div className="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>🗺 Tap anywhere on the map to place a pin</span>
          <button
            onClick={() => { setIsPicking(false); setModalOpen(true); }}
            className="ml-4 rounded px-2 py-0.5 text-xs font-medium text-amber-700
                       hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Nearby banner */}
      {nearbyLocation && !isPicking && (
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

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="relative h-64 w-full shrink-0 md:h-auto md:w-3/5">
          <MapView
            currentPosition={currentPosition}
            locations={locations}
            selectedId={selectedDestinationId}
            onLocationClick={handleMarkerClick}
            onMapClick={isPicking ? handleMapClick : null}
            pickPreview={isPicking ? pickedPosition : null}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col border-l bg-white md:w-2/5">

          {/* Category filter chips */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition
                  ${categoryFilter === f.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="border-b px-4 pb-2">
            <p className="text-xs text-gray-400">
              {locationsStatus === 'loading'
                ? 'Loading…'
                : `${filteredLocations.length} location${filteredLocations.length !== 1 ? 's' : ''}`}
            </p>
          </div>

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
            if (!dest) return null;
            const dist = distanceTo(dest.latitude, dest.longitude);
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

      <SaveLocationModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        currentPosition={currentPosition}
        onPickFromMap={handlePickFromMap}
        pickedPosition={pickedPosition}
      />
    </div>
  );
}