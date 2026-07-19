// frontend/src/components/camera/CameraFeed.jsx
//
// Shows the live camera feed and periodically sends frames to the backend
// for face identification, drawing the results as boxes + names on top.

import { useState, useCallback, useRef } from "react";
import { useCamera } from "../../hooks/useCamera";
import { facesApi } from "../../utils/api";
import FaceOverlay from "./FaceOverlay";

// Identification is heavier than transcription (runs face detection +
// a ChromaDB query per frame), so we don't send every captured frame —
// only every Nth one. useCamera already throttles capture via
// FRAME_INTERVAL_MS; this adds a second, coarser throttle on top.
const IDENTIFY_EVERY_N_FRAMES = 5;

export default function CameraFeed({ onPersonDetected }) {
  const [faces, setFaces] = useState([]);
  const [error, setError] = useState(null);
  const frameCountRef = useRef(0);
  const inFlightRef = useRef(false); // avoid overlapping requests if one is slow

  const handleFrame = useCallback(async (blob) => {
    frameCountRef.current += 1;
    if (frameCountRef.current % IDENTIFY_EVERY_N_FRAMES !== 0) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    try {
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      const res = await facesApi.identify(formData);
      setFaces(res.data.faces || []);
      onPersonDetected?.(res.data.faces || []);
      setError(null);
    } catch {
      setError("Couldn't reach the server for face identification.");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const { videoRef, canvasRef, active, start, stop } = useCamera(handleFrame);

  const handleToggle = () => {
    if (active) {
      stop();
      setFaces([]);
      onPersonDetected?.([]);
    } else {
      setError(null);
      start();
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Live face recognition</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {active ? "Watching…" : "Start the camera to identify people in real time"}
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
          {active ? "Stop camera" : "Start camera"}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      <div className="relative w-full aspect-[4/3] bg-stone-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <FaceOverlay faces={faces} videoWidth={640} videoHeight={480} />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
            Camera is off
          </div>
        )}
      </div>

      {/* Hidden canvas used internally by useCamera to grab frames — not displayed */}
      <canvas ref={canvasRef} width={640} height={480} className="hidden" />
    </div>
  );
}