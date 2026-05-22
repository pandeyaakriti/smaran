import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import PersonManager from "./pages/PersonManager";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

function Nav() {
  const base = "px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150";
  const active = "bg-stone-900 text-white";
  const inactive = "text-stone-500 hover:text-stone-900 hover:bg-stone-100";
  return (
    <header className="border-b border-stone-200 bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="smaran Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-lg font-semibold tracking-tight text-stone-900">smaran</span>
          <span className="text-xs text-stone-400 font-normal mt-0.5">memory assistant</span>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>Dashboard</NavLink>
          <NavLink to="/persons" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>People</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>Settings</NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-50 font-sans">
        <Nav />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/persons" element={<PersonManager />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}