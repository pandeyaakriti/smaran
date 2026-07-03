/**
 * SavedLocationsList.jsx
 *
 * Scrollable sidebar list of all saved locations.
 * Tapping a row selects it as the destination (highlights it on the map).
 * The pin / delete actions call Redux thunks directly.
 *
 * Props
 * ─────
 *   locations          SavedLocation[]
 *   selectedId         string | null
 *   onSelect           (location) => void
 *   currentPosition    { latitude, longitude } | null   – for distance display
 *   distanceTo         (lat, lon) => metres | null       – from useNavigation
 */

import { useDispatch } from 'react-redux';
import { deleteLocation, updateLocation } from '../../store/navigationSlice';

const CATEGORY_META = {
    home: { emoji: '🏠', colour: 'bg-blue-100 text-blue-700' },
    medical: { emoji: '🏥', colour: 'bg-red-100 text-red-700' },
    social: { emoji: '☕', colour: 'bg-green-100 text-green-700' },
    shopping: { emoji: '🛒', colour: 'bg-amber-100 text-amber-700' },
    other: { emoji: '📍', colour: 'bg-gray-100 text-gray-600' },
};

function formatDistance(metres) {
    if (metres === null || metres === undefined) return null;
    if (metres < 1000) return `${Math.round(metres)} m`;
    return `${(metres / 1000).toFixed(1)} km`;
}

export function SavedLocationsList({
    locations = [],
    selectedId,
    onSelect,
    distanceTo,
}) {
    const dispatch = useDispatch();

    function handleDelete(e, id) {
        e.stopPropagation();
        if (window.confirm('Remove this saved location?')) {
            dispatch(deleteLocation(id));
        }
    }

    function handleTogglePin(e, loc) {
        e.stopPropagation();
        dispatch(updateLocation({ id: loc.id, changes: { is_pinned: !loc.is_pinned } }));
    }

    if (locations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-gray-400">
                <span className="text-4xl">📍</span>
                <p className="text-sm">No saved locations yet.</p>
                <p className="text-xs">Tap "Save location" to add your first place.</p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-gray-100">
            {locations.map((loc) => {
                const meta = CATEGORY_META[loc.category] ?? CATEGORY_META.other;
                const isSelected = loc.id === selectedId;
                const dist = distanceTo ? distanceTo(loc.latitude, loc.longitude) : null;

                return (
                    <li
                        key={loc.id}
                        onClick={() => onSelect(loc)}
                        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition
              hover:bg-gray-50 active:bg-gray-100
              ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    >
                        {/* Category emoji badge */}
                        <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center
                          rounded-full text-lg ${meta.colour}`}
                        >
                            {meta.emoji}
                        </div>

                        {/* Text */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                {loc.is_pinned && (
                                    <span className="text-xs text-blue-500" title="Pinned">📌</span>
                                )}
                                <span
                                    className={`truncate text-sm font-medium
                    ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}
                                >
                                    {loc.label}
                                </span>
                            </div>

                            {loc.notes && (
                                <p className="mt-0.5 truncate text-xs text-gray-400">{loc.notes}</p>
                            )}

                            <div className="mt-1 flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.colour}`}>
                                    {loc.category}
                                </span>
                                {dist !== null && (
                                    <span className="text-xs text-gray-400">{formatDistance(dist)} away</span>
                                )}
                                {loc.visit_count > 0 && (
                                    <span className="text-xs text-gray-400">
                                        {loc.visit_count} visit{loc.visit_count !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 flex-col gap-1 pl-1">
                            <button
                                onClick={(e) => handleTogglePin(e, loc)}
                                title={loc.is_pinned ? 'Unpin' : 'Pin to top'}
                                className="rounded p-1 text-gray-300 hover:text-blue-500"
                            >
                                {loc.is_pinned ? '📌' : '📍'}
                            </button>
                            <button
                                onClick={(e) => handleDelete(e, loc.id)}
                                title="Delete"
                                className="rounded p-1 text-gray-300 hover:text-red-500"
                            >
                                🗑
                            </button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}