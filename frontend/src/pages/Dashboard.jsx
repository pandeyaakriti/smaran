export default function Dashboard() {
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