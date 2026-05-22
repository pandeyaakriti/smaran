import { useState, useEffect, useCallback } from "react";
import { personApi } from "../utils/api";
import PersonCard from "../components/memory/PersonCard";
import PersonModal from "../components/memory/PersonModal";

export default function PersonManager() {
  const [persons, setPersons]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);   // null = add, person obj = edit
  const [search, setSearch]       = useState("");
  const [deleting, setDeleting]   = useState(null);   // id being deleted

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await personApi.list();
      setPersons(res.data);
    } catch {
      setError("Could not load people. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p);   setModalOpen(true); };

  const handleSave = async (data) => {
    if (editing) {
      await personApi.update(editing.id, data);
    } else {
      await personApi.create(data);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await personApi.delete(id);
      setPersons(prev => prev.filter(p => p.id !== id));
    } catch {
      setError("Failed to delete person.");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.relation ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">People</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {persons.length} {persons.length === 1 ? "person" : "people"} enrolled
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-stone-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-stone-700 transition-colors"
        >
          <span className="text-base leading-none">+</span> Add person
        </button>
      </div>

      {/* Search */}
      {persons.length > 0 && (
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search by name or relation..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm pl-9 pr-4 py-2 text-sm border border-stone-200 rounded-md bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-44 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-lg">
          <span className="text-base">⚠</span> {error}
          <button onClick={load} className="ml-auto underline text-red-600 hover:text-red-800">Retry</button>
        </div>
      )}

      {!loading && !error && persons.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-stone-200 rounded-xl">
          <div className="text-4xl mb-3">logo aaucha yeta</div>
          <p className="text-stone-500 text-sm mb-4">No people enrolled yet.<br />Add someone to get started.</p>
          <button onClick={openAdd} className="text-sm font-medium text-stone-900 underline underline-offset-2">Add your first person</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && persons.length > 0 && (
        <p className="text-stone-500 text-sm">No results for "{search}"</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PersonCard
              key={p.id}
              person={p}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p.id)}
              deleting={deleting === p.id}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <PersonModal
          person={editing}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}