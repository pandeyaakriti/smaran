// frontend/src/pages/Dashboard.jsx

import { useEffect, useState } from "react";
import ConversationPanel from "../components/conversation/ConversationPanel";
import { personApi } from "../utils/api";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [hasPeople, setHasPeople] = useState(false);

  useEffect(() => {
    const checkPeople = async () => {
      try {
        const res = await personApi.list();
        setHasPeople(res.data.length > 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkPeople();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-stone-500">
        Loading...
      </div>
    );
  }

  // Empty state (no enrolled people)
  if (!hasPeople) {
    return (
      <div className="text-center py-20">
        <div className="mb-3 flex justify-center">
          <img
            src="/logo.png"
            alt="Smaran Logo"
            className="w-20 h-20 object-contain"
          />
        </div>

        <h1 className="text-2xl font-semibold text-stone-900 mb-2 tracking-tight">
          smaran
        </h1>

        <p className="text-stone-500 text-sm max-w-sm mx-auto">
          Real-time memory assistant. Start by adding people in the{" "}
          <a
            href="/persons"
            className="underline underline-offset-2 text-stone-700"
          >
            People
          </a>{" "}
          tab, then come back here to run a live session.
        </p>
      </div>
    );
  }

  // Normal dashboard
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Start a live session to transcribe conversations in real time
        </p>
      </div>

      <ConversationPanel />
    </div>
  );
}