/**
 * DeviationBanner.jsx
 *
 * Shows an escalating alert when the user deviates from the route.
 *
 * level 0 → nothing rendered
 * level 1 → amber warning  "You may be off track"
 * level 2 → red alert      "You are off track — caregiver has been notified"
 *
 * Props
 * ─────
 *   level       0 | 1 | 2
 *   onDismiss   () => void   — lets user acknowledge level-1 banner
 */

export function DeviationBanner({ level, onDismiss }) {
  if (level === 0) return null;

  if (level === 1) {
    return (
      <div className="flex items-center justify-between bg-amber-50 px-4 py-3
                      border-b border-amber-200">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">You may be off track</p>
            <p className="text-xs text-amber-600">
              Try to return to the highlighted route on the map.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 shrink-0 rounded-lg border border-amber-300 bg-amber-100
                     px-3 py-1 text-xs font-medium text-amber-700
                     hover:bg-amber-200"
        >
          I'm okay
        </button>
      </div>
    );
  }

  // level 2
  return (
    <div className="flex items-center gap-2 bg-red-50 px-4 py-3 border-b border-red-200">
      <span className="text-xl">🆘</span>
      <div>
        <p className="text-sm font-semibold text-red-800">You are off track</p>
        <p className="text-xs text-red-600">
          Your caregiver has been notified. Follow the map to get back on route.
        </p>
      </div>
    </div>
  );
}