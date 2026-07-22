import { useEffect, useState, useRef } from "react";
import { memoryApi } from "../../utils/api";

/**
 * Shows a short recall cue as soon as a person is detected on screen,
 * e.g. "Last time you spoke about her trip to Pune" — giving the
 * patient context before the conversation even starts.
 *
 * person: { id, name } | null
 */
export default function MemoryCue({ person }) {
  const [cue, setCue]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const lastPersonId          = useRef(null);

  useEffect(() => {
    if (!person?.id) {
      setCue(null);
      lastPersonId.current = null;
      return;
    }

    // Fetch once per detection, not on every re-render while they stay on screen
    if (lastPersonId.current === person.id) return;
    lastPersonId.current = person.id;

    let cancelled = false;
    setLoading(true);
    setError(null);

    memoryApi.recall(person.id)
      .then(res => {
        if (!cancelled) setCue(res.data.cue || null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load memory cue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [person?.id]);

  if (!person) return null;

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 text-sm">
        ✦
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800 mb-1">About {person.name}</p>
        {loading && <p className="text-xs text-amber-600">Recalling…</p>}
        {error && <p className="text-xs text-amber-600">{error}</p>}
        {!loading && !error && cue && (
          <p className="text-sm text-amber-900 leading-relaxed">{cue}</p>
        )}
        {!loading && !error && !cue && (
          <p className="text-xs text-amber-500 italic">No history yet — this looks like a fresh start.</p>
        )}
      </div>
    </div>
  );
}