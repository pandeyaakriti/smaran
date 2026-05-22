import { useState, useEffect, useRef } from "react";

const RELATIONS = ["colleague", "friend", "family", "manager", "client", "other"];

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full text-sm px-3 py-2 border border-stone-200 rounded-md bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent";

export default function PersonModal({ person, onSave, onClose }) {
  const isEdit = !!person;
  const [form, setForm]       = useState({ name: "", nickname: "", relation: "", notes: "" });
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});
  const nameRef               = useRef(null);

  useEffect(() => {
    if (person) {
      setForm({
        name:     person.name     ?? "",
        nickname: person.nickname ?? "",
        relation: person.relation ?? "",
        notes:    person.notes    ?? "",
      });
    }
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [person]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave({
        name:     form.name.trim(),
        nickname: form.nickname.trim() || null,
        relation: form.relation || null,
        notes:    form.notes.trim() || null,
      });
    } catch {
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && e.metaKey) handleSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">
            {isEdit ? "Edit person" : "Add person"}
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-md hover:bg-stone-100 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <Field label="Full name" required>
            <input
              ref={nameRef}
              type="text"
              placeholder="e.g. Ananya Sharma"
              value={form.name}
              onChange={set("name")}
              className={`${inputClass} ${errors.name ? "border-red-300 focus:ring-red-400" : ""}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </Field>

          <Field label="Nickname / goes by">
            <input
              type="text"
              placeholder="e.g. Anya"
              value={form.nickname}
              onChange={set("nickname")}
              className={inputClass}
            />
          </Field>

          <Field label="Relation">
            <select value={form.relation} onChange={set("relation")} className={inputClass}>
              <option value="">Select a relation…</option>
              {RELATIONS.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              rows={3}
              placeholder="Topics they care about, past interactions, things to remember…"
              value={form.notes}
              onChange={set("notes")}
              className={`${inputClass} resize-none`}
            />
          </Field>

          {errors.submit && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-md">{errors.submit}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 bg-stone-50 rounded-b-2xl">
          <p className="text-xs text-stone-400">⌘ + Enter to save</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm font-medium text-stone-600 px-4 py-2 rounded-md hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="text-sm font-medium bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add person"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}