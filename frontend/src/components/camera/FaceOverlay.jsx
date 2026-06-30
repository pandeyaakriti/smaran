// frontend/src/components/camera/FaceOverlay.jsx
//
// Renders bounding boxes + names on top of the video feed. Boxes come back
// from the backend in the coordinate space of the captured frame (640x480,
// see useCamera's canvas size), so we scale them to whatever size the
// video element is actually displayed at on screen via the SVG viewBox.

export default function FaceOverlay({ faces, videoWidth = 640, videoHeight = 480 }) {
  if (!faces || faces.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${videoWidth} ${videoHeight}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {faces.map((face, i) => {
        const [x1, y1, x2, y2] = face.bbox;
        const w = x2 - x1;
        const h = y2 - y1;
        const known = Boolean(face.name);
        const color = known ? "#10b981" : "#f59e0b"; // emerald for known, amber for unknown
        const label = known
          ? `${face.name}${face.similarity != null ? ` (${Math.round(face.similarity * 100)}%)` : ""}`
          : "Unknown";

        return (
          <g key={i}>
            <rect
              x={x1}
              y={y1}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth={2}
              rx={4}
            />
            <rect
              x={x1}
              y={Math.max(y1 - 22, 0)}
              width={Math.max(w, label.length * 7 + 12)}
              height={20}
              fill={color}
              rx={3}
            />
            <text
              x={x1 + 6}
              y={Math.max(y1 - 22, 0) + 14}
              fontSize="12"
              fontWeight="600"
              fill="white"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}