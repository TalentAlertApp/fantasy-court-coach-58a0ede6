import { NavLink, Outlet } from "react-router-dom";
import { ClipboardList, ArrowLeftRight, Calendar, Shield, Shirt, Gauge, Sun, Moon, ChevronLeft, ChevronRight, Trophy, LogOut } from "lucide-react";
import TeamSwitcher from "@/components/TeamSwitcher";
import HowToPlayModal from "@/components/HowToPlayModal";
import { useState, useEffect } from "react";
import nbaLogo from "@/assets/nba-logo.svg";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const navItems = [
  { to: "/", label: "My Roster", icon: ClipboardList, end: true },
  { to: "/scoring", label: "Scoring", icon: Trophy },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/teams", label: "Teams", icon: Shirt },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/advanced", label: "Advanced", icon: Gauge },
  { to: "/commissioner", label: "Commissioner", icon: Shield },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() =>
    localStorage.getItem("nba_theme") === "dark" ||
    (!localStorage.getItem("nba_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );

  useEffect(() => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add("dark");
      localStorage.setItem("nba_theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("nba_theme", "light");
    }
  }, [dark]);

  return (
    <div className="app-shell">
      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className={`sidebar${collapsed ? " collapsed" : ""} animate-slide-in-left`}>
        {/* Brand — NBA Logo + FANTASY + Guide */}
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <img src={nbaLogo} alt="NBA" className="h-8 w-auto flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="text-sm font-heading font-bold uppercase tracking-[0.2em] truncate flex-1"
                    style={{ color: "hsl(var(--sidebar-foreground))" }}>
                Fantasy
              </span>
              <HowToPlayModal iconClassName="text-white/50 hover:text-white hover:bg-white/10 h-7 w-7 shrink-0" />
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0 text-[hsl(var(--nba-yellow))]" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Team Switcher — above separator */}
        <div className="px-3 pb-2 flex flex-col gap-2" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          {!collapsed && <TeamSwitcher />}
        </div>

        {/* Bottom controls */}
        <div className="flex flex-col gap-2 p-3 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          {user && (
            <div className={`flex items-center gap-2 px-1 ${collapsed ? "justify-center" : ""}`}>
              {!collapsed && (
                <span className="text-[10px] uppercase tracking-wider truncate flex-1"
                      style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}
                      title={user.email ?? ""}>
                  {user.email}
                </span>
              )}
              <button
                onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
                className="theme-toggle"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={() => setDark(d => !d)}
            className="theme-toggle w-full"
            title={dark ? "Switch to Light" : "Switch to Dark"}
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {!collapsed && (
              <span className="ml-2 text-[10px] uppercase tracking-wider">
                {dark ? "Light" : "Dark"}
              </span>
            )}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            className="theme-toggle w-full"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />}
            {!collapsed && (
              <span className="ml-2 text-[10px] uppercase tracking-wider">Collapse</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <div className="main-content">
        <main className="page-scroll">
          <div className="animate-fade-in w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
