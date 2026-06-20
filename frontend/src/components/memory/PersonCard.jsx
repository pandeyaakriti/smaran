import { useState } from "react";
import FaceEnrollModal from "./FaceEnrollModal";

const RELATION_COLORS = {
  colleague: "bg-blue-50 text-blue-700",
  friend:    "bg-emerald-50 text-emerald-700",
  family:    "bg-amber-50 text-amber-700",
  manager:   "bg-purple-50 text-purple-700",
  client:    "bg-rose-50 text-rose-700",
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Shows initials when there is no enrolled photo
function Avatar({ name }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = [
    "bg-stone-200 text-stone-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-purple-100 text-purple-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

// Shows the enrolled photo when photo_path is present
function PhotoAvatar({ photoPath, name }) {
  const [imgError, setImgError] = useState(false);

  // photoPath is stored as "/uploads/faces/person_1_abc123.jpg"
  // Prepend the API base so the browser fetches from the backend static mount.
  const src = `${API_BASE}${photoPath}`;

  if (imgError) {
    // Fall back to initials if the image fails to load
    return <Avatar name={name} />;
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setImgError(true)}
      className="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-stone-200"
    />
  );
}

export default function PersonCard({ person, onEdit, onDelete, deleting, onFaceEnrolled }) {
  const [enrollOpen, setEnrollOpen] = useState(false);

  const relationClass =
    RELATION_COLORS[person.relation?.toLowerCase()] ?? "bg-stone-100 text-stone-600";

  const handleEnrollSuccess = () => {
    setEnrollOpen(false);
    // Tell PersonManager to re-fetch the list so photo_path updates
    onFaceEnrolled?.();
  };

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col gap-4 hover:border-stone-300 hover:shadow-sm transition-all duration-150">

        {/* Top row — photo/avatar + name/relation */}
        <div className="flex items-start gap-3">
          {person.photo_path ? (
            <PhotoAvatar photoPath={person.photo_path} name={person.name} />
          ) : (
            <Avatar name={person.name} />
          )}

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 text-sm truncate">{person.name}</p>
            {person.nickname && (
              <p className="text-xs text-stone-400 truncate">"{person.nickname}"</p>
            )}
            {person.relation && (
              <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${relationClass}`}>
                {person.relation}
              </span>
            )}
          </div>

          {/* Face enrollment status badge */}
          <div className="flex-shrink-0">
            {person.photo_path ? (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                ✓ Face enrolled
              </span>
            ) : (
              <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full font-medium">
                No face
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        {person.notes ? (
          <p className="text-xs text-stone-500 leading-relaxed line-clamp-3 border-t border-stone-100 pt-3">
            {person.notes}
          </p>
        ) : (
          <p className="text-xs text-stone-300 italic border-t border-stone-100 pt-3">No notes yet</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={onEdit}
            className="flex-1 text-xs font-medium text-stone-600 border border-stone-200 rounded-md py-1.5 hover:bg-stone-50 hover:border-stone-300 transition-colors"
          >
            Edit
          </button>

          {/* Enroll / Re-enroll face button */}
          <button
            onClick={() => setEnrollOpen(true)}
            className="flex-1 text-xs font-medium text-stone-600 border border-stone-200 rounded-md py-1.5 hover:bg-stone-50 hover:border-stone-300 transition-colors"
          >
            {person.photo_path ? "Re-enroll" : "Enroll face"}
          </button>

          <button
            onClick={onDelete}
            disabled={deleting}
            className="flex-1 text-xs font-medium text-red-500 border border-red-100 rounded-md py-1.5 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Face enroll modal — rendered outside the card so it overlays everything */}
      {enrollOpen && (
        <FaceEnrollModal
          person={person}
          onClose={() => setEnrollOpen(false)}
          onSuccess={handleEnrollSuccess}
        />
      )}
    </>
  );
}