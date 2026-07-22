import { useState } from "react";
import { personApi } from "../../utils/api";

export default function FaceEnrollModal({ person, onClose, onSuccess }) {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
    setError("");
    // Generate a local preview URL so the user can see their photo before uploading
    if (chosen) {
      setPreview(URL.createObjectURL(chosen));
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please choose an image first.");
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      // Key must be "image" — matches FastAPI's: image: UploadFile = File(...)
      formData.append("image", file);

      await personApi.enrollFace(person.id, formData);

      // Let PersonCard know enrollment succeeded
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail ?? "Failed to enroll face. Make sure the photo shows a clear, front-facing face."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      // Click outside to close (unless uploading)
      onClick={(e) => e.target === e.currentTarget && !uploading && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">

        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-stone-900">Enroll Face</h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-stone-400 hover:text-stone-600 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-md hover:bg-stone-100 transition-colors"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-stone-500 mb-5">
          Upload a clear, front-facing photo for{" "}
          <span className="font-medium text-stone-800">{person.name}</span>.
        </p>

        {/* File picker */}
        <label className="block w-full cursor-pointer border-2 border-dashed border-stone-200 rounded-xl p-6 text-center hover:border-stone-400 transition-colors">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="mx-auto w-32 h-32 rounded-xl object-cover border border-stone-200"
            />
          ) : (
            <div className="text-stone-400 text-sm">
              <div className="text-3xl mb-2">📷</div>
              Click to choose a photo
            </div>
          )}
          {file && (
            <p className="text-xs text-stone-500 mt-2 truncate">{file.name}</p>
          )}
        </label>

        {/* Error message */}
        {error && (
          <p className="text-red-600 text-sm mt-3 bg-red-50 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-sm font-medium text-stone-600 px-4 py-2 rounded-md hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="text-sm font-medium bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Enroll Face"}
          </button>
        </div>

      </div>
    </div>
  );
}