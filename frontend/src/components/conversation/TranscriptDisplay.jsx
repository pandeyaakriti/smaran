import { useEffect, useRef } from "react";

function TranscriptLine({ entry }) {
  const isPending = entry.pending;
  return (
    <div className={`flex gap-3 py-2 ${isPending ? "opacity-50" : ""}`}>
      <span className="text-xs text-stone-400 font-mono mt-0.5 w-16 flex-shrink-0">
        {entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "now"}
      </span>
      <p className="text-sm text-stone-700 leading-relaxed">
        {entry.transcript}
        {isPending && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" />}
      </p>
    </div>
  );
}

export default function TranscriptDisplay({ entries }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        Transcript will appear here once you start recording
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
      {entries.map((entry, i) => (
        <TranscriptLine key={entry.id ?? `pending-${i}`} entry={entry} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}