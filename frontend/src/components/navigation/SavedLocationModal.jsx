/**
 * SaveLocationModal.jsx
 *
 * Modal that lets the user (or caregiver) save a new named location.
 * Pre-fills latitude/longitude with the user's current GPS position
 * so they can tap "Save here" with minimal effort.
 *
 * Props
 * ─────
 *   isOpen          boolean
 *   onClose         () => void
 *   currentPosition { latitude, longitude } | null
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

export function SaveLocationModal({ isOpen, onClose, currentPosition }) {
  const dispatch = useDispatch();
  const { mutationStatus, mutationError } = useSelector((s) => s.navigation);

  const [label, setLabel]       = useState('');
  const [notes, setNotes]       = useState('');
  const [category, setCategory] = useState('other');
  const [isPinned, setIsPinned] = useState(false);
  const [lat, setLat]           = useState('');
  const [lng, setLng]           = useState('');

  // Pre-fill GPS when modal opens.
  useEffect(() => {
    if (isOpen && currentPosition) {
      setLat(currentPosition.latitude.toFixed(6));
      setLng(currentPosition.longitude.toFixed(6));
    }
  }, [isOpen, currentPosition]);

  // Close after successful save.
  useEffect(() => {
    if (mutationStatus === 'succeeded') {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationStatus]);

  function handleClose() {
    dispatch(clearMutationError());
    setLabel('');
    setNotes('');
    setCategory('other');
    setIsPinned(false);
    setLat('');
    setLng('');
    onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;

    dispatch(
      createLocation({
        label: label.trim(),
        notes: notes.trim() || null,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        category,
        is_pinned: isPinned,
      })
    );
  }

  if (!isOpen) return null;

  const isSaving = mutationStatus === 'loading';

  return (
    /* Backdrop */
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
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Label */}
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
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                           focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                           focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {currentPosition && (
            <button
              type="button"
              onClick={() => {
                setLat(currentPosition.latitude.toFixed(6));
                setLng(currentPosition.longitude.toFixed(6));
              }}
              className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              Use my current location
            </button>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes <span className="text-gray-400">(optional)</span>
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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {mutationError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700
                         hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !label.trim()}
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