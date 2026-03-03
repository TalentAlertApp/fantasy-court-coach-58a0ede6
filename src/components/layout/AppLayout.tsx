import { NavLink, Outlet } from "react-router-dom";
import { Home, Users, BarChart3, ArrowLeftRight, Calendar, Bot } from "lucide-react";
import TeamSwitcher from "@/components/TeamSwitcher";

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/roster", label: "Edit Line-up", icon: Users },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/players", label: "Waiver Wire", icon: Users },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/ai", label: "AI Hub", icon: Bot },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — deep navy */}
      <header className="bg-nba-navy text-white">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <h1 className="text-xl font-heading font-bold tracking-widest">🏀 NBA FANTASY MANAGER</h1>
          <TeamSwitcher />
        </div>
      </header>

      {/* Navigation — white bar with yellow active indicator */}
      <nav className="bg-card border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2.5 text-sm font-heading font-semibold uppercase tracking-wide whitespace-nowrap transition-colors border-b-[3px] ${
                    isActive
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
