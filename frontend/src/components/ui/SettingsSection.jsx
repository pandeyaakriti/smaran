export default function SettingsSection({ icon, title, description, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-3 mb-1">

        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      </div>
      {description && (
        <p className="text-xs text-stone-400 mb-4  mt-1">{description}</p>
      )}
      <div className="pl-7 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}