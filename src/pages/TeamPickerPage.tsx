import { useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { Plus, Shield, LogOut } from "lucide-react";
import { markTeamPickedThisSession } from "@/lib/welcome-back-store";

export default function TeamPickerPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { teams, setSelectedTeamId, isReady } = useTeam();

  const ownedTeams = useMemo(
    () => teams.filter((t: any) => t.owner_id === user?.id || !t.owner_id),
    [teams, user?.id]
  );

  // Auto-bypass when user actually has 0 or 1 owned team (defensive guard).
  useEffect(() => {
    if (!isReady) return;
    if (ownedTeams.length === 0) {
      navigate("/welcome", { replace: true });
    } else if (ownedTeams.length === 1) {
      setSelectedTeamId(ownedTeams[0].id);
      markTeamPickedThisSession();
      navigate("/", { replace: true });
    }
  }, [isReady, ownedTeams, navigate, setSelectedTeamId]);

  const handlePick = (id: string) => {
    setSelectedTeamId(id);
    markTeamPickedThisSession();
    navigate("/", { replace: true });
  };

  const handleCreateNew = () => {
    markTeamPickedThisSession();
    navigate("/welcome", { replace: true });
  };

  if (!isReady || ownedTeams.length < 2) {
    return <div className="h-screen w-full bg-background" aria-hidden />;
  }

  return (
    <div
      className="relative h-screen w-full bg-background text-foreground overflow-hidden flex flex-col"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 20% 10%, hsl(var(--primary) / 0.18), transparent 55%),
          radial-gradient(ellipse at 85% 90%, hsl(var(--accent) / 0.12), transparent 55%),
          radial-gradient(ellipse at 50% 50%, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
        `,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <button
        type="button"
        onClick={async () => {
          await signOut();
          navigate("/auth", { replace: true });
        }}
        className="absolute top-7 right-6 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11px] uppercase tracking-[0.25em] text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors z-10"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 max-w-5xl mx-auto w-full">
        <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">Welcome back</p>
        <h1
          className="font-heading font-black uppercase tracking-[0.15em] text-foreground text-center"
          style={{ fontSize: "clamp(2rem, 6vh, 4rem)", lineHeight: 1 }}
        >
          Pick <span className="text-accent">Your Squad</span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-foreground/60 text-center max-w-xl">
          Which team will you manage today?
        </p>

        <div className="mt-10 grid gap-4 w-full" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
          {ownedTeams.map((t: any) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handlePick(t.id)}
              className="group relative text-left p-5 rounded-2xl border-2 border-foreground/10 bg-foreground/[0.02] hover:border-accent hover:bg-accent/5 hover:shadow-[0_0_40px_-15px_hsl(var(--accent))] transition-all"
            >
              <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-3 bg-foreground/10 text-foreground/70 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-heading uppercase tracking-[0.12em] text-base text-foreground truncate">
                {t.name}
              </h3>
              {t.description && (
                <p className="mt-1.5 text-xs text-foreground/60 leading-relaxed line-clamp-2">
                  {t.description}
                </p>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={handleCreateNew}
            className="group relative text-left p-5 rounded-2xl border-2 border-dashed border-foreground/15 bg-transparent hover:border-accent hover:bg-accent/5 transition-all"
          >
            <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-3 bg-foreground/5 text-foreground/60 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="font-heading uppercase tracking-[0.12em] text-base text-foreground/80">
              New Team
            </h3>
            <p className="mt-1.5 text-xs text-foreground/50 leading-relaxed">
              Spin up another franchise from scratch.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}