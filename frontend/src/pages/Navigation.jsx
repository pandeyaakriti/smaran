/**
 * Navigation.jsx — Phase 1 + Phase 2
 *
 * New in Phase 2:
 *   • "Start navigation" button → calls startRoute thunk
 *   • Active route drawn on map via RouteLayer (inside MapView)
 *   • Deviation banner shown based on deviationLevel
 *   • Score breakdown panel in sidebar
 *   • "Arrived" celebration banner
 *   • Cancel route button
 */

import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  DeviationBanner,
  MapView,
  SavedLocationsList,
  SaveLocationModal,
} from '../components/navigation';
import { useNavigation } from '../hooks/useNavigation';
import { useRoute }      from '../hooks/useRoute';
import {
  applyDeviationResult,
  cancelRoute,
  clearRoute,
  setSelectedDestination,
  startRoute,
} from '../store/navigationSlice';

const CATEGORY_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'home',     label: '🏠 Home' },
  { value: 'medical',  label: '🏥 Medical' },
  { value: 'social',   label: '☕ Social' },
  { value: 'shopping', label: '🛒 Shopping' },
  { value: 'other',    label: '📍 Other' },
];

function ScoreBar({ label, value }) {
  const pct = Math.round((value ?? 0) * 100);
  const colour =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs text-gray-500">
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Navigation() {
  const dispatch = useDispatch();
  const {
    selectedDestinationId,
    activeRoute, routeCandidates, routeStatus, routeError,
    deviationLevel, arrived,
  } = useSelector(s => s.navigation);

  const { currentPosition, gpsError, locations, locationsStatus, nearbyLocation, distanceTo } =
    useNavigation();

  // Activate deviation pinging while a route is live.
  useRoute();

  const [modalOpen,      setModalOpen]      = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isPicking,      setIsPicking]      = useState(false);
  const [pickedPosition, setPickedPosition] = useState(null);

  const handleMarkerClick = useCallback(
    loc => dispatch(setSelectedDestination(loc.id)), [dispatch]
  );

  function handleListSelect(loc) {
    dispatch(setSelectedDestination(loc.id === selectedDestinationId ? null : loc.id));
  }

  function handlePickFromMap() { setModalOpen(false); setIsPicking(true); setPickedPosition(null); }
  function handleMapClick(pos) { setPickedPosition(pos); setIsPicking(false); setModalOpen(true); }
  function handleModalClose()  { setModalOpen(false); setIsPicking(false); setPickedPosition(null); }

  async function handleStartNavigation() {
    if (!currentPosition || !selectedDestinationId) return;
    const dest = locations.find(l => l.id === selectedDestinationId);
    if (!dest) return;
    dispatch(startRoute({
      origin_lat:     currentPosition.latitude,
      origin_lng:     currentPosition.longitude,
      dest_lat:       dest.latitude,
      dest_lng:       dest.longitude,
      destination_id: dest.id,
    }));
  }

  function handleCancelRoute() {
    if (activeRoute) dispatch(cancelRoute(activeRoute.id));
    else             dispatch(clearRoute());
  }

  const filteredLocations = categoryFilter === 'all'
    ? locations
    : locations.filter(l => l.category === categoryFilter);

  const isNavigating  = !!activeRoute;
  const isCalculating = routeStatus === 'loading';
  const selectedDest  = locations.find(l => l.id === selectedDestinationId);

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
        {!isNavigating ? (
          <button
            onClick={() => { setPickedPosition(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2
                       text-sm font-medium text-white hover:bg-blue-700"
          >
            ＋ Save location
          </button>
        ) : (
          <button
            onClick={handleCancelRoute}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2
                       text-sm font-medium text-red-600 hover:bg-red-100"
          >
            ✕ End navigation
          </button>
        )}
      </header>

      {/* ── Banners ── */}
      {gpsError && (
        <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-700">⚠ {gpsError}</div>
      )}

      {arrived && (
        <div className="flex items-center justify-center gap-2 bg-green-600 px-4 py-3 text-white">
          <span className="text-xl">🎉</span>
          <span className="font-semibold">You have arrived!</span>
        </div>
      )}

      {!arrived && (
        <DeviationBanner
          level={deviationLevel}
          onDismiss={() => dispatch(applyDeviationResult({ new_level: 0, arrived: false }))}
        />
      )}

      {isPicking && (
        <div className="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-800 border-b border-amber-200">
          <span>🗺 Tap anywhere on the map to place a pin</span>
          <button
            onClick={() => { setIsPicking(false); setModalOpen(true); }}
            className="ml-4 rounded px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >Cancel</button>
        </div>
      )}

      {!isNavigating && nearbyLocation && !isPicking && (
        <div className="flex items-center gap-2 bg-green-50 px-4 py-2 text-sm text-green-800 border-b">
          <span>✅</span>
          <span>You are near <strong>{nearbyLocation.label}</strong>
            {nearbyLocation.notes && <span className="ml-1 text-green-600">— {nearbyLocation.notes}</span>}
          </span>
        </div>
      )}

      {routeError && (
        <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-700">⚠ {routeError}</div>
      )}

      {/* ── Main content ── */}
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
            activeRoute={activeRoute}
            routeCandidates={routeCandidates}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col border-l bg-white md:w-2/5">

          {/* ── Active route panel ── */}
          {isNavigating && activeRoute && (
            <div className="border-b bg-blue-50 px-4 py-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Navigating
                </p>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {Math.round((activeRoute.score_breakdown?.total ?? 0) * 100)}% match
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-blue-900">
                {selectedDest?.label ?? 'Destination'}
              </p>
              <p className="mb-2 text-xs text-blue-600">
                {activeRoute.osrm_summary?.distance
                  ? `${(activeRoute.osrm_summary.distance / 1000).toFixed(1)} km · `
                  : ''}
                {activeRoute.osrm_summary?.duration
                  ? `${Math.round(activeRoute.osrm_summary.duration / 60)} min`
                  : ''}
              </p>
              {/* Score bars */}
              <div className="space-y-1.5">
                <ScoreBar label="⏱ Time"         value={activeRoute.score_breakdown?.time} />
                <ScoreBar label="📏 Distance"     value={activeRoute.score_breakdown?.distance} />
                <ScoreBar label="🏠 Familiarity"  value={activeRoute.score_breakdown?.familiarity} />
                <ScoreBar label="🏘 Quiet roads"  value={activeRoute.score_breakdown?.crowd} />
              </div>
            </div>
          )}

          {/* ── Start navigation CTA (when destination selected, no active route) ── */}
          {!isNavigating && selectedDestinationId && currentPosition && (
            <div className="border-b bg-blue-50 px-4 py-3">
              <p className="mb-1 text-xs font-medium text-blue-700">Destination selected</p>
              <p className="truncate text-sm font-semibold text-blue-900">
                {selectedDest?.label}
              </p>
              {selectedDest && (() => {
                const dist = distanceTo(selectedDest.latitude, selectedDest.longitude);
                return dist !== null ? (
                  <p className="mb-2 text-xs text-blue-600">
                    {dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`} away
                  </p>
                ) : null;
              })()}
              <div className="flex gap-2">
                <button
                  onClick={handleStartNavigation}
                  disabled={isCalculating}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold
                             text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCalculating ? 'Calculating…' : '🧭 Start navigation'}
                </button>
                <button
                  onClick={() => dispatch(setSelectedDestination(null))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* ── Category filter (only when not navigating) ── */}
          {!isNavigating && (
            <>
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
                {CATEGORY_FILTERS.map(f => (
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
            </>
          )}

          {/* ── Location list (hidden while navigating) ── */}
          {!isNavigating && (
            <div className="flex-1 overflow-y-auto">
              <SavedLocationsList
                locations={filteredLocations}
                selectedId={selectedDestinationId}
                onSelect={handleListSelect}
                distanceTo={distanceTo}
              />
            </div>
          )}

          {/* ── Route candidates list ── */}
          {isNavigating && routeCandidates.length > 1 && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Other options considered
              </p>
              {routeCandidates.slice(1).map((r, i) => (
                <div key={i} className="mb-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Option {i + 2}</span>
                    <span>{Math.round((r.score_breakdown?.total ?? 0) * 100)}% match</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {(r.distance / 1000).toFixed(1)} km · {Math.round(r.duration / 60)} min
                  </div>
                </div>
              ))}
            </div>
          )}
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
