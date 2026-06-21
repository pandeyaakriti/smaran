import ConversationPanel from "../components/conversation/ConversationPanel";

export default function Dashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Start a live session to transcribe conversations in real time
        </p>
      </div>

      <ConversationPanel />
    </div>
  );
}