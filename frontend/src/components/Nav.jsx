import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/ledger", label: "Ledger" },
  { to: "/learn", label: "Learn" },
  { to: "/invest", label: "Invest" },
  { to: "/agent", label: "AI Agent" },
  { to: "/settings", label: "Settings" },
];

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="border-b border-ink/10 bg-paper/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-paper font-display text-lg">
            F
          </span>
          <span className="font-display text-xl tracking-tight">FinTrack</span>
          <span className="hidden sm:inline text-xs text-ink/40 font-medium ml-2 tracking-wide uppercase">
            Track → Learn → Invest
          </span>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-ink text-paper"
                    : "text-ink/70 hover:text-ink hover:bg-ink/5"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="w-8 h-8 rounded-full bg-ink/10 text-ink/70 flex items-center justify-center text-sm font-semibold"
            title={user?.email}
          >
            {initial}
          </span>
          <button
            onClick={onLogout}
            className="text-sm font-medium text-ink/50 hover:text-coral px-2 py-1"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
