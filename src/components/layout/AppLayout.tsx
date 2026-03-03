import { NavLink, Outlet } from "react-router-dom";
import { Home, Users, BarChart3, ArrowLeftRight, Calendar, Bot, MoreHorizontal } from "lucide-react";

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
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold tracking-tight">🏀 NBA Fantasy Manager</h1>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-primary/95 border-b border-primary/80 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    isActive
                      ? "border-nba-yellow text-nba-yellow"
                      : "border-transparent text-primary-foreground/70 hover:text-primary-foreground hover:border-primary-foreground/30"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <button className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary-foreground/50 cursor-not-allowed">
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>
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
