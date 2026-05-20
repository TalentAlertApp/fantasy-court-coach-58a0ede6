import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useFirstRunGate } from "@/hooks/useFirstRunGate";
import { createTeam } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import OnboardingHero from "@/components/onboarding/OnboardingHero";
import NameStep from "@/components/onboarding/NameStep";
import DraftStep from "@/components/onboarding/DraftStep";
import ChooseLeagueStep from "@/components/onboarding/ChooseLeagueStep";
import { useOnboardingAudio } from "@/hooks/useOnboardingAudio";
import { Volume2, VolumeX } from "lucide-react";
import {
  getOnboardingState,
  setOnboardingState,
  clearOnboardingState,
  setOnboardingSkipped,
  type OnboardingStep,
} from "@/lib/onboarding-store";

type Step = OnboardingStep;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? null) as { leagueId?: string; sport?: "nba" | "wnba"; returnTo?: string } | null;
  const preselectedLeagueId = navState?.leagueId ?? null;
  const preselectedSport = navState?.sport ?? null;
  const returnTo = navState?.returnTo ?? "/";
  const { user, signOut } = useAuth();
  const { teams, setSelectedTeamId } = useTeam();
  const { shouldOnboard, ready } = useFirstRunGate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { enabled: audioEnabled, toggle: toggleAudio } = useOnboardingAudio(true);

  // Hydrate persisted onboarding state for this user (resume after refresh)
  const initial = useMemo(() => getOnboardingState(user?.id), [user?.id]);
  const [step, setStepRaw] = useState<Step>(initial?.step ?? "hero");
  const [creating, setCreating] = useState(false);
  const [createdTeamName, setCreatedTeamName] = useState(initial?.teamName ?? "");
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(initial?.teamId ?? null);
  const [pendingName, setPendingName] = useState<string>("");
  const [pendingMainSport, setPendingMainSport] = useState<"nba" | "wnba">("nba");

  const setStep = (next: Step, extra?: { teamId?: string; teamName?: string }) => {
    setStepRaw(next);
    setOnboardingState(user?.id, {
      step: next,
      teamId: extra?.teamId ?? createdTeamId ?? undefined,
      teamName: extra?.teamName ?? createdTeamName ?? undefined,
    });
  };

  // Defensive resume: if persisted step === "draft" but the saved teamId is no
  // longer in the user's owned teams (deleted, signed out etc.), fall back to
  // the name step. If valid, hydrate selectedTeamId so DraftStep works on refresh.
  useEffect(() => {
    if (!ready || step !== "draft") return;
    const ownedNow = teams.filter((t: any) => t.owner_id === user?.id);
    const stillOwns = createdTeamId && ownedNow.some((t: any) => t.id === createdTeamId);
    if (stillOwns) {
      setSelectedTeamId(createdTeamId!);
      return;
    }
    if (ownedNow.length > 0) {
      const fb = ownedNow[ownedNow.length - 1];
      setCreatedTeamId(fb.id);
      setCreatedTeamName(fb.name);
      setSelectedTeamId(fb.id);
      setOnboardingState(user?.id, { step: "draft", teamId: fb.id, teamName: fb.name });
      return;
    }
    // Zero owned teams → back to NameStep for a fresh franchise name
    setCreatedTeamId(null);
    setCreatedTeamName("");
    setStepRaw("name");
    setOnboardingState(user?.id, { step: "name" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, step, createdTeamId, teams, user?.id]);

  // If user already owns a team, kick them back home — UNLESS they arrived
  // here intentionally to create another team (preselectedLeagueId set, e.g.
  // from /scoring empty-state CTA).
  useEffect(() => {
    if (ready && !shouldOnboard && !preselectedLeagueId) {
      navigate("/", { replace: true });
    }
  }, [ready, shouldOnboard, navigate, preselectedLeagueId]);

  const submitTeam = async (
    name: string,
    args: { fantasyLeagueId?: string; leagueCode: "nba" | "wnba" }
  ) => {
    setCreating(true);
    try {
      const res = await createTeam({
        name,
        league_code: args.leagueCode,
        fantasy_league_id: args.fantasyLeagueId,
      });
      const teamId = res.team.id;
      setSelectedTeamId(teamId);
      setCreatedTeamId(teamId);
      setCreatedTeamName(res.team.name);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      await queryClient.invalidateQueries({ queryKey: ["fantasy-leagues"] });
      setStep("draft", { teamId, teamName: res.team.name });
    } catch (e: any) {
      toast({
        title: "Could not create team",
        description: e?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // NameStep submits with a leagueCode (kept for backward-compat); we capture
  // the name and either skip to draft (if a league is preselected) or go to
  // the Choose League step.
  const handleNameSubmit = async (name: string, leagueCode: "nba" | "wnba") => {
    setPendingName(name);
    setPendingMainSport(leagueCode);
    if (preselectedLeagueId) {
      // Pre-selected from LeaguesPage — skip the league chooser
      await submitTeam(name, { fantasyLeagueId: preselectedLeagueId, leagueCode });
    } else {
      setStep("league");
    }
  };

  const handleLeagueSubmit = async (args: { fantasyLeagueId?: string; leagueCode: "nba" | "wnba" }) => {
    if (!pendingName) {
      setStep("name");
      return;
    }
    await submitTeam(pendingName, args);
  };

  const handleSkip = () => {
    setOnboardingSkipped();
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleFinish = async () => {
    clearOnboardingState(user?.id);
    await queryClient.invalidateQueries({ queryKey: ["teams"] });
    await queryClient.invalidateQueries({ queryKey: ["roster-current"] });
    navigate(returnTo, { replace: true });
  };

  // Back from DraftStep: if user already owns ≥2 teams, they reached this
  // step via the "New Team" CTA on the multi-team picker — return there.
  // Otherwise, go back to the NameStep as usual.
  const handleDraftBack = () => {
    const ownedCount = teams.filter((t: any) => t.owner_id === user?.id).length;
    if (ownedCount >= 2) {
      clearOnboardingState(user?.id);
      navigate("/welcome/pick-team", { replace: true });
    } else {
      setStep("name");
    }
  };

  // Render-gate to prevent light→dark flash when bouncing back to /
  if (!ready || !shouldOnboard) {
    return <div className="h-screen w-full bg-background" aria-hidden />;
  }

  return (
    <div
      className="relative h-screen w-full bg-background text-foreground overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 20% 10%, hsl(var(--primary) / 0.18), transparent 55%),
          radial-gradient(ellipse at 85% 90%, hsl(var(--accent) / 0.12), transparent 55%),
          radial-gradient(ellipse at 50% 50%, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
        `,
      }}
    >
      {/* subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      {/* Audio toggle (shared with Court Show preference) */}
      <button
        type="button"
        onClick={toggleAudio}
        title={audioEnabled ? "Mute" : "Unmute"}
        aria-label={audioEnabled ? "Mute background music" : "Unmute background music"}
        className="absolute top-4 right-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur hover:bg-card text-foreground/80 hover:text-foreground transition-colors"
      >
        {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>

      {step === "hero" && (
        <OnboardingHero
          onStart={() => setStep("name")}
          onSignOut={handleSignOut}
          onSkip={handleSkip}
          email={user?.email}
        />
      )}
      {step === "name" && (
        <NameStep
          onBack={() => setStep("hero")}
          onSubmit={handleNameSubmit}
          submitting={creating}
          lockedSport={preselectedLeagueId ? preselectedSport : null}
        />
      )}
      {step === "league" && (
        <ChooseLeagueStep
          onBack={() => setStep("name")}
          onSubmit={handleLeagueSubmit}
          submitting={creating}
          lockedSport={pendingMainSport}
        />
      )}
      {step === "draft" && (
        <DraftStep
          teamName={createdTeamName}
          onFinish={handleFinish}
          onBack={handleDraftBack}
        />
      )}
    </div>
  );
}