/**
 * SaveLocationModal.jsx
 *
 * Three ways to set coordinates:
 *   1. "Use my current location" — one tap, fills from GPS.
 *   2. "Pick on map" — closes modal, user clicks map, modal reopens with coords filled.
 *   3. Manual lat/lng fields — for power users / caregivers.
 *
 * Props
 * ─────
 *   isOpen          boolean
 *   onClose         () => void
 *   currentPosition { latitude, longitude } | null
 *   onPickFromMap   () => void   — called when user wants to pick on map;
 *                                  parent switches to pick mode and feeds
 *                                  coords back via pickedPosition prop.
 *   pickedPosition  { latitude, longitude } | null — fed in from parent after pick
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearMutationError, createLocation } from '../../store/navigationSlice';

const CATEGORIES = [
  { value: 'home',     label: '🏠 Home' },
  { value: 'medical',  label: '🏥 Medical' },
  { value: 'social',   label: '☕ Social' },
  { value: 'shopping', label: '🛒 Shopping' },
  { value: 'other',    label: '📍 Other' },
];

export function SaveLocationModal({
  isOpen,
  onClose,
  currentPosition,
  onPickFromMap,
  pickedPosition,
}) {
  const dispatch = useDispatch();
  const { mutationStatus, mutationError } = useSelector((s) => s.navigation);

  const [label,     setLabel]     = useState('');
  const [notes,     setNotes]     = useState('');
  const [category,  setCategory]  = useState('other');
  const [isPinned,  setIsPinned]  = useState(false);
  const [lat,       setLat]       = useState('');
  const [lng,       setLng]       = useState('');

  // Fill coords from GPS on first open.
  useEffect(() => {
    if (isOpen && currentPosition && !lat && !lng) {
      setLat(currentPosition.latitude.toFixed(6));
      setLng(currentPosition.longitude.toFixed(6));
    }
  }, [isOpen, currentPosition]);

  // Fill coords when parent feeds back a map-picked position.
  useEffect(() => {
    if (pickedPosition) {
      setLat(pickedPosition.latitude.toFixed(6));
      setLng(pickedPosition.longitude.toFixed(6));
    }
  }, [pickedPosition]);

  // Close after successful save.
  useEffect(() => {
    if (mutationStatus === 'succeeded') handleClose();
  }, [mutationStatus]);

  function handleClose() {
    dispatch(clearMutationError());
    setLabel(''); setNotes(''); setCategory('other');
    setIsPinned(false); setLat(''); setLng('');
    onClose();
  }

  function useCurrentLocation() {
    if (currentPosition) {
      setLat(currentPosition.latitude.toFixed(6));
      setLng(currentPosition.longitude.toFixed(6));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim() || !lat || !lng) return;
    dispatch(createLocation({
      label:     label.trim(),
      notes:     notes.trim() || null,
      latitude:  parseFloat(lat),
      longitude: parseFloat(lng),
      category,
      is_pinned: isPinned,
    }));
  }

  if (!isOpen) return null;

  const isSaving   = mutationStatus === 'loading';
  const hasCoords  = lat && lng;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Save location</h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">

          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Home, Dr. Sharma's clinic…"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`rounded-full border px-3 py-1 text-sm transition
                    ${category === c.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location picker */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Location <span className="text-red-500">*</span>
            </label>

            {/* Three source buttons */}
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={!currentPosition}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5
                           text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600
                           disabled:cursor-not-allowed disabled:opacity-40"
              >
                🎯 My location
              </button>
              <button
                type="button"
                onClick={onPickFromMap}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5
                           text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600"
              >
                🗺 Pick on map
              </button>
            </div>

            {/* Coordinate preview / manual fields */}
            {hasCoords ? (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
                <span className="text-xs text-blue-700">
                  📍 {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => { setLat(''); setLng(''); }}
                  className="text-xs text-blue-400 hover:text-blue-600"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Latitude</label>
                  <input
                    type="number" step="any" value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="27.7172"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Longitude</label>
                  <input
                    type="number" step="any" value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="85.3240"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Turn left at the blue gate"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Pin toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Pin to top of list
          </label>

          {/* Error */}
          {mutationError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{mutationError}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !label.trim() || !hasCoords}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : 'Save location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}