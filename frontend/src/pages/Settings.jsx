import { useState, useEffect, useCallback } from "react";
import { settingsApi } from "../utils/api";
import { supabase } from "../utils/supabase";
import SettingsSection from "../components/ui/SettingsSection";

const selectClass = "text-sm border border-stone-200 rounded-md px-2.5 py-1.5 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900";

export default function Settings() {
  const [settings, setSettings]   = useState(null);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [user, setUser]           = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, statsRes, sessionRes] = await Promise.all([
        settingsApi.get(),
        settingsApi.stats(),
        supabase.auth.getSession(),
      ]);
      setSettings(settingsRes.data);
      setStats(statsRes.data);
      setUser(sessionRes.data.session?.user ?? null);
    } catch {
      setError("Could not load settings. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (field, value) => {
    setSettings(s => ({ ...s, [field]: value }));
    setSaving(true);
    try {
      await settingsApi.update({ [field]: value });
    } catch {
      setError("Failed to save setting.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await settingsApi.deleteAll();
      setConfirmDelete(false);
      load();
    } catch {
      setError("Failed to delete data.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="h-8 w-32 bg-stone-100 rounded mb-6 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-stone-100 rounded-xl mb-4 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Settings</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Configure how smaran recognizes, listens, and remembers
          {saving && <span className="text-stone-400 ml-2">· saving…</span>}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3   text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={load} className="ml-auto underline text-red-600 hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Account */}
      <SettingsSection title="Account" description="Signed in via Google">
        <div className="flex items-center gap-3">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="w-9 h-9 rounded-full" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600">
              {(user?.user_metadata?.full_name ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">{user?.user_metadata?.full_name ?? "—"}</p>
            <p className="text-xs text-stone-500">{user?.email}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs font-medium text-red-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </SettingsSection>

      {/* Face recognition */}
      <SettingsSection title="Face recognition" description="Controls how confidently smaran matches a face">
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-sm text-stone-700">Match sensitivity</label>
            <span className="text-sm font-medium text-stone-900">
              {Math.round((settings.face_similarity_threshold ?? 0.6) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="90"
            step="1"
            value={Math.round((settings.face_similarity_threshold ?? 0.6) * 100)}
            onChange={(e) => patch("face_similarity_threshold", Number(e.target.value) / 100)}
            className="w-full"
          />
          <p className="text-xs text-stone-400 mt-1">Higher = stricter matches, fewer false positives</p>
        </div>

        <div className="flex justify-between items-center">
          <label className="text-sm text-stone-700">Camera frame rate</label>
          <select
            value={settings.face_frame_skip ?? 3}
            onChange={(e) => patch("face_frame_skip", Number(e.target.value))}
            className={selectClass}
          >
            <option value={1}>Every frame</option>
            <option value={3}>Every 3rd frame</option>
            <option value={5}>Every 5th frame</option>
          </select>
        </div>
      </SettingsSection>

      {/* Speech */}
      <SettingsSection title="Speech transcription" description="Whisper model used to transcribe conversations">
        {/* <div className="flex justify-between items-center">
          <label className="text-sm text-stone-700">Model size</label>
          <select
            value={settings.whisper_model_size ?? "base"}
            onChange={(e) => patch("whisper_model_size", e.target.value)}
            className={selectClass}
          >
            <option value="tiny">Tiny — fastest</option>
            <option value="base">Base — balanced</option>
            <option value="small">Small — more accurate</option>
          </select>
        </div> */}
        <div className="flex justify-between items-center">
          <label className="text-sm text-stone-700">Language</label>
          <select
            value={settings.whisper_language ?? "en"}
            onChange={(e) => patch("whisper_language", e.target.value)}
            className={selectClass}
          >
            <option value="en">English</option>
            <option value="ne">Nepali</option>
            <option value="auto">Auto-detect</option>
          </select>
        </div>
      </SettingsSection>

      {/* Memory / LLM */}
      <SettingsSection title="Memory assistant" description="The LLM that generates contextual cues">
        <div className="flex justify-between items-center">
          <label className="text-sm text-stone-700">Ollama model</label>
          <select
            value={settings.ollama_model ?? "llama3.2"}
            onChange={(e) => patch("ollama_model", e.target.value)}
            className={selectClass}
          >
            <option value="llama3.2">llama3.2</option>
            {/* <option value="mistral">mistral</option>
            <option value="gemma2">gemma2</option> */}
          </select>
        </div>
      </SettingsSection>

      {/* Data & privacy */}
      <SettingsSection  title="Data & privacy" description="Manage what smaran has stored about you">
        <div className="flex justify-between items-center">
          <span className="text-sm text-stone-700">
            {stats?.person_count ?? 0} people enrolled · {stats?.face_embedding_count ?? 0} face embeddings
          </span>
        </div>

        <div className="border-t border-stone-100 pt-3">
          {!confirmDelete ? (
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-500">Delete all my data</span>
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-medium text-red-400  hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="bg-red-0 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-red-700 mb-3">
                This permanently deletes all enrolled people, face data, and settings. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs font-medium text-stone-600 px-3 py-1.5 rounded-md hover:text-stone-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="text-xs font-medium text-red-400 px-3 py-1.5 rounded-md hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}