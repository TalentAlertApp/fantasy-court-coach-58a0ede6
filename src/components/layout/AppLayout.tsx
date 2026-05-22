import { NavLink, Outlet } from "react-router-dom";
import { getLeagueLogo } from "@/lib/competitions";
import { ClipboardList, ArrowLeftRight, Calendar, Shield, Shirt, Gauge, Sun, Moon, ChevronLeft, ChevronRight, Activity, LogOut, Swords, Search, MessageSquareHeart } from "lucide-react";
import TeamSwitcher from "@/components/TeamSwitcher";
import HowToPlayModal from "@/components/HowToPlayModal";
import FeedbackModal from "@/components/FeedbackModal";
import SidebarPlayerSearch from "@/components/SidebarPlayerSearch";
import PlayerModal from "@/components/PlayerModal";
import { useState, useEffect } from "react";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import euroleagueLogo from "@/assets/euroleague-logo.svg";
import { useAuth } from "@/contexts/AuthContext";
import { useLeague } from "@/contexts/LeagueContext";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function NavTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="font-heading uppercase text-[10px] tracking-[0.2em] px-2.5 py-1.5"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const navItems = [
  { to: "/", label: "My Roster", icon: ClipboardList, end: true },
  { to: "/scoring", label: "Scoring", icon: Activity },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/teams", label: "Teams", icon: Shirt },
  { to: "/leagues", label: "Leagues", icon: Swords },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/advanced", label: "Advanced", icon: Gauge },
  { to: "/commissioner", label: "Commissioner", icon: Shield },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { isWnba, league } = useLeague();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [quickPlayerId, setQuickPlayerId] = useState<number | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
    <TooltipProvider delayDuration={0} skipDelayDuration={200}>
    <div className="app-shell">
      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className={`sidebar${collapsed ? " collapsed" : ""} animate-slide-in-left`}>
        {/* Brand — NBA Logo + FANTASY + Guide */}
        <div className={`relative overflow-hidden flex items-center ${collapsed ? "justify-center px-0 py-4" : "gap-3 px-4 py-5"}`}>
          {/* Watermark logos escaping the corners */}
          {!collapsed && (
            <>
              <img
                src={nbaLogo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -top-3 -left-5 h-20 w-20 object-contain opacity-[0.08] -rotate-12 select-none"
              />
              <img
                src={wnbaLogo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -top-3 -right-5 h-24 w-24 object-contain opacity-[0.08] rotate-12 select-none"
              />
              <img
                src={euroleagueLogo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 h-16 w-16 object-contain opacity-[0.06] select-none"
              />
            </>
          )}
          {!collapsed && (
            <>
              <NavLink
                to="/"
                end
                aria-label="Go to My Roster (home)"
                className="flex flex-col leading-none truncate flex-1 relative z-10 cursor-pointer rounded-md hover:bg-white/5 transition-colors -mx-1 px-1 py-0.5"
              >
                <span className="text-sm font-heading font-bold uppercase tracking-[0.22em] truncate"
                      style={{ color: "hsl(var(--sidebar-foreground))" }}>
                  Fantasy
                </span>
                <span className="text-[8px] font-heading font-semibold uppercase tracking-[0.35em] mt-1"
                      style={{ color: "hsl(var(--accent) / 0.85)" }}>
                  Manager
                </span>
              </NavLink>
              <HowToPlayModal iconClassName="text-white/50 hover:text-white hover:bg-white/10 h-7 w-7 shrink-0 relative z-10" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(true)}
                    aria-label="Send feedback"
                    className="inline-flex items-center justify-center rounded-md text-accent/80 hover:text-accent hover:bg-accent/10 h-7 w-7 shrink-0 relative z-10 transition-colors"
                  >
                    <MessageSquareHeart className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="font-heading uppercase text-[10px] tracking-[0.2em] px-2.5 py-1.5"
                >
                  Send feedback
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {collapsed && (
            <img
              src={getLeagueLogo(league)}
              alt={isWnba ? "WNBA" : "NBA"}
              className="h-8 w-auto flex-shrink-0 relative z-10"
            />
          )}
        </div>
        <div className="sidebar-divider" />

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? "py-4 items-center" : "py-3"} flex flex-col gap-1 overflow-y-auto`}>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavTooltip key={to} collapsed={collapsed} label={label}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `nav-item${isActive ? " active" : ""}`
                }
              >
                <Icon className="nav-item-icon" />
                {!collapsed && <span className="truncate relative z-10">{label}</span>}
              </NavLink>
            </NavTooltip>
          ))}
        </nav>

        {/* Player Search */}
        {!collapsed ? (
          <>
            <div className="sidebar-divider" />
            <div className="px-3 pt-2 pb-1">
              <span className="sidebar-section-label">Player Search</span>
            </div>
            <div className="px-3 pb-2 pt-1">
              <SidebarPlayerSearch onSelect={(id) => setQuickPlayerId(id)} />
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-divider" />
            <div className="py-2 flex justify-center">
              <NavTooltip collapsed={collapsed} label="Search player">
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  aria-label="Search player"
                  className="theme-toggle"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </NavTooltip>
            </div>
          </>
        )}

        {/* Feedback (collapsed-only) */}
        {collapsed && (
          <div className="py-1 flex justify-center">
            <NavTooltip collapsed={collapsed} label="Send feedback">
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                aria-label="Send feedback"
                className="theme-toggle text-accent/80 hover:text-accent"
              >
                <MessageSquareHeart className="h-3.5 w-3.5" />
              </button>
            </NavTooltip>
          </div>
        )}

        {/* Team Switcher — above separator */}
        {!collapsed && (
          <>
            <div className="sidebar-divider" />
            <div className="px-3 pt-2 pb-1">
              <span className="sidebar-section-label">Your Team</span>
            </div>
            <div className="px-3 pb-2 pt-1">
              <TeamSwitcher />
            </div>
          </>
        )}

        {/* Bottom controls */}
        <div className="sidebar-divider" />
        {!collapsed && (
          <div className="px-3 pt-2 pb-1">
            <span className="sidebar-section-label">Account</span>
          </div>
        )}
        <div className={`flex flex-col ${collapsed ? "gap-2 px-0 py-2 items-center" : "gap-1.5 px-3 pt-1 pb-2"}`}>
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
            <NavTooltip collapsed={collapsed} label="Sign out">
              <button
                onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
                className="theme-toggle w-full"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </NavTooltip>
          )}
          <div className={collapsed ? "flex flex-col gap-2 items-center" : "grid grid-cols-2 gap-2"}>
            <NavTooltip collapsed={collapsed} label={dark ? "Switch to Light" : "Switch to Dark"}>
              <button
                onClick={() => setDark(d => !d)}
                className="theme-toggle w-full"
                aria-label={dark ? "Switch to Light theme" : "Switch to Dark theme"}
              >
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {!collapsed && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider">
                    {dark ? "Light" : "Dark"}
                  </span>
                )}
              </button>
            </NavTooltip>
            <NavTooltip collapsed={collapsed} label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <button
                onClick={() => setCollapsed(c => !c)}
                className="theme-toggle w-full"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed
                  ? <ChevronRight className="h-3.5 w-3.5" />
                  : <ChevronLeft className="h-3.5 w-3.5" />}
                {!collapsed && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider">Hide</span>
                )}
              </button>
            </NavTooltip>
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
      <PlayerModal
        playerId={quickPlayerId}
        open={quickPlayerId !== null}
        onOpenChange={(o) => { if (!o) setQuickPlayerId(null); }}
      />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
    </TooltipProvider>
  );
}
