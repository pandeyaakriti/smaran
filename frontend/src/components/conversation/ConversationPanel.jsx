import { useState, useCallback, useRef } from "react";
import { useSpeech } from "../../hooks/useSpeech";
import { speechApi } from "../../utils/api";
import TranscriptDisplay from "./TranscriptDisplay";

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ConversationPanel() {
  const [entries, setEntries]   = useState([]);
  const [error, setError]       = useState(null);
  const sessionIdRef            = useRef(generateSessionId());

  const handleChunk = useCallback(async (blob) => {
    // Show an optimistic "transcribing..." placeholder while we wait
    const pendingId = `pending-${Date.now()}`;
    setEntries(prev => [...prev, { id: pendingId, transcript: "Transcribing…", pending: true }]);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "chunk.webm");
      formData.append("session_id", sessionIdRef.current);

      const res = await speechApi.transcribe(formData);

      setEntries(prev => {
        const withoutPending = prev.filter(e => e.id !== pendingId);
        if (res.data.skipped || !res.data.text) return withoutPending;
        return [...withoutPending, {
          id: res.data.id,
          transcript: res.data.text,
          timestamp: new Date().toISOString(),
        }];
      });
    } catch {
      setError("Failed to transcribe. Server error");
      setEntries(prev => prev.filter(e => e.id !== pendingId));
    }
  }, []);

  const { active, error: micError, volume, start, stop } = useSpeech(handleChunk);

  const handleToggle = () => {
    if (active) {
      stop();
    } else {
      sessionIdRef.current = generateSessionId();
      setEntries([]);
      setError(null);
      start();
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Live conversation</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {active ? "Listening…" : "Start a session to transcribe in real time"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
            active
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-stone-900 text-white hover:bg-stone-700"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${active ? "bg-red-500 animate-pulse" : "bg-white"}`} />
          {active ? "Stop" : "Start listening"}
        </button>
      </div>

      {active && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-stone-400 w-16">Mic level</span>
          <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${Math.min(volume * 1.5, 100)}%` }}
            />
          </div>
        </div>
      )}

      {(micError || error) && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
          {micError || error}
        </div>
      )}

      <TranscriptDisplay entries={entries} />
    </div>
  );
}