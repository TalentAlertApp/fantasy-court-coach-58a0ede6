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
        <div className="relative overflow-hidden flex items-center gap-3 px-4 py-5">
          {/* Watermark logo escaping the corner */}
          {!collapsed && (
            <img
              src={nbaLogo}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -top-4 -right-6 h-24 w-24 object-contain opacity-[0.08] rotate-12 select-none"
            />
          )}
          <img src={nbaLogo} alt="NBA" className="h-9 w-auto flex-shrink-0 relative z-10" />
          {!collapsed && (
            <>
              <div className="flex flex-col leading-none truncate flex-1 relative z-10">
                <span className="text-sm font-heading font-bold uppercase tracking-[0.22em] truncate"
                      style={{ color: "hsl(var(--sidebar-foreground))" }}>
                  Fantasy
                </span>
                <span className="text-[8px] font-heading font-semibold uppercase tracking-[0.35em] mt-1"
                      style={{ color: "hsl(var(--accent) / 0.85)" }}>
                  Manager
                </span>
              </div>
              <HowToPlayModal iconClassName="text-white/50 hover:text-white hover:bg-white/10 h-7 w-7 shrink-0 relative z-10" />
            </>
          )}
        </div>
        <div className="sidebar-divider" />

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-1 overflow-y-auto">
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
              <Icon className="nav-item-icon" />
              {!collapsed && <span className="truncate relative z-10">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Team Switcher — above separator */}
        {!collapsed && (
          <>
            <div className="sidebar-divider" />
            <div className="px-3 pt-3 pb-1">
              <span className="sidebar-section-label">Your Team</span>
            </div>
            <div className="px-3 pb-3 pt-1.5">
              <TeamSwitcher />
            </div>
          </>
        )}

        {/* Bottom controls */}
        <div className="sidebar-divider" />
        {!collapsed && (
          <div className="px-3 pt-3 pb-1">
            <span className="sidebar-section-label">Account</span>
          </div>
        )}
        <div className="flex flex-col gap-2 p-3">
          {user && !collapsed && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                 style={{ background: "hsl(0 0% 100% / 0.03)", boxShadow: "inset 0 0 0 1px hsl(var(--sidebar-border) / 0.5)" }}>
              <span className="text-[10px] uppercase tracking-wider truncate flex-1"
                    style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}
                    title={user.email ?? ""}>
                {user.email}
              </span>
              <button
                onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
                className="theme-toggle h-7 w-7"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {user && collapsed && (
            <button
              onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
              className="theme-toggle w-full"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
          <div className={collapsed ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"}>
            <button
              onClick={() => setDark(d => !d)}
              className="theme-toggle w-full"
              title={dark ? "Switch to Light" : "Switch to Dark"}
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {!collapsed && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wider">
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
                <span className="ml-1.5 text-[10px] uppercase tracking-wider">Hide</span>
              )}
            </button>
          </div>
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
