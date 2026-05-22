import { useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { Plus, LogOut, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { markTeamPickedThisSession } from "@/lib/welcome-back-store";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import TeamLeagueChips from "@/components/TeamLeagueChips";
import { useOnboardingAudio } from "@/hooks/useOnboardingAudio";

export default function TeamPickerPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { teams, setSelectedTeamId, isReady } = useTeam();
  const { enabled: audioEnabled, toggle: toggleAudio } = useOnboardingAudio(true);

  const ownedTeams = useMemo(
    () => teams.filter((t: any) => t.owner_id === user?.id || !t.owner_id),
    [teams, user?.id]
  );

  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    return (
      meta.full_name ||
      meta.name ||
      meta.display_name ||
      (user?.email ? user.email.split("@")[0] : "Manager")
    );
  }, [user]);

  // Auto-bypass when user actually has 0 or 1 owned team (defensive guard).
  useEffect(() => {
    if (!isReady) return;
    if (ownedTeams.length === 0) {
      navigate("/welcome", { replace: true });
    }
  }, [isReady, ownedTeams, navigate, setSelectedTeamId]);

  const handlePick = (id: string) => {
    setSelectedTeamId(id);
    markTeamPickedThisSession();
    navigate("/", { replace: true });
  };

  const handleCreateNew = () => {
    navigate("/welcome", { state: { forceNewTeam: true } });
  };

  if (!isReady || ownedTeams.length < 1) {
    return <div className="h-screen w-full bg-background" aria-hidden />;
  }

  return (
    <div
      className="relative min-h-screen w-full bg-background text-foreground flex flex-col"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 20% 10%, hsl(var(--primary) / 0.18), transparent 55%),
          radial-gradient(ellipse at 85% 90%, hsl(var(--accent) / 0.12), transparent 55%),
          radial-gradient(ellipse at 50% 50%, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
        `,
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
        <img src={wnbaLogo} alt="WNBA" className="h-8 w-auto object-contain" />
        <img src={nbaLogo} alt="NBA" className="h-8 w-auto" />
        <span className="text-[10px] font-heading uppercase tracking-[0.3em] text-foreground/60">
          Fantasy
        </span>
      </div>

      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleAudio}
          title={audioEnabled ? "Mute" : "Unmute"}
          aria-label={audioEnabled ? "Mute background music" : "Unmute background music"}
          className="h-9 w-9 rounded-full flex items-center justify-center border border-border bg-card/70 backdrop-blur text-foreground/80 hover:text-foreground hover:bg-card transition-colors"
        >
          {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/auth", { replace: true });
          }}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11px] uppercase tracking-[0.25em] text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center flex-1 px-6 py-24 max-w-6xl mx-auto w-full">
        <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">
          Welcome back · <span className="text-foreground/80">{displayName}</span>
        </p>
        <h1
          className="font-heading font-black uppercase tracking-[0.15em] text-foreground text-center"
          style={{ fontSize: "clamp(1.75rem, 5vh, 3.25rem)", lineHeight: 1 }}
        >
          Pick <span className="text-accent">Your Team</span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-foreground/60 text-center max-w-xl">
          Which team will you manage today?
        </p>

        <div className="mt-10 grid gap-3 w-full" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
          {ownedTeams.map((t: any) => {
            const leagueLogo = getLeagueLogo(t.league_code);
            const leagueCode = (t.league_code ?? "nba").toUpperCase();
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handlePick(t.id)}
                className="group relative text-left p-4 rounded-xl border border-foreground/10 bg-gradient-to-br from-foreground/[0.04] to-transparent hover:border-accent/70 hover:from-accent/10 hover:shadow-[0_0_30px_-12px_hsl(var(--accent))] transition-all min-h-[7rem] flex flex-col justify-between gap-2 overflow-hidden"
              >
                <img
                  src={leagueLogo}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 object-contain opacity-[0.12] select-none group-hover:opacity-25 group-hover:scale-110 transition-all duration-500"
                />
                <div className="relative flex items-center gap-2">
                  <img src={leagueLogo} alt={leagueCode} className="h-6 w-6 object-contain" />
                  <span className="text-[9px] uppercase tracking-[0.3em] text-foreground/50">
                    {leagueCode}
                  </span>
                </div>
                <div className="relative flex items-end justify-between gap-2">
                  <h3 className="font-heading uppercase tracking-[0.12em] text-sm text-foreground truncate">
                    {t.name}
                  </h3>
                  <ChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
                {Array.isArray(t.league_ids) && t.league_ids.length > 0 && (
                  <div className="relative -mt-1">
                    <TeamLeagueChips
                      leagueIds={t.league_ids}
                      primaryId={t.league_id}
                      max={3}
                    />
                  </div>
                )}
                <span className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleCreateNew}
            className="group relative text-left p-4 rounded-xl border border-dashed border-foreground/15 bg-transparent hover:border-accent hover:bg-accent/5 transition-all h-28 flex flex-col justify-between overflow-hidden"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-foreground/5 text-foreground/60 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading uppercase tracking-[0.12em] text-sm text-foreground/80">
                New Team
              </h3>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                Start fresh
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}