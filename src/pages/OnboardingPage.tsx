import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useFirstRunGate } from "@/hooks/useFirstRunGate";
import { createTeam } from "@/lib/api";
import { deleteTeam } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { FUNCTIONS_BASE, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";
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
  getOnboardingDraft,
  setOnboardingDraft,
  clearOnboardingDraft,
  type OnboardingStep,
} from "@/lib/onboarding-store";

type Step = OnboardingStep;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? null) as {
    leagueId?: string;
    sport?: "nba" | "wnba";
    returnTo?: string;
    forceNewTeam?: boolean;
    resumeChooseLeague?: boolean;
    newLeagueId?: string;
  } | null;
  const preselectedLeagueId = navState?.leagueId ?? null;
  const preselectedSport = navState?.sport ?? null;
  const returnTo = navState?.returnTo ?? "/";
  const forceNewTeam = navState?.forceNewTeam === true;
  const resumeChooseLeague = navState?.resumeChooseLeague === true;
  const resumedNewLeagueId = navState?.newLeagueId ?? null;
  const { user, signOut } = useAuth();
  const { teams, setSelectedTeamId } = useTeam();
  const { shouldOnboard, ready } = useFirstRunGate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { enabled: audioEnabled, toggle: toggleAudio } = useOnboardingAudio(true);

  // Hydrate persisted onboarding state for this user (resume after refresh).
  // When forceNewTeam is set (returning user clicked "New Team" on the picker),
  // ignore stale state and start fresh at the NameStep.
  // When resumeChooseLeague is set (user returning from /leagues/create), hydrate
  // from the in-progress draft and jump straight to the league step.
  const draft = useMemo(
    () => (resumeChooseLeague ? getOnboardingDraft(user?.id) : null),
    [user?.id, resumeChooseLeague]
  );
  const initial = useMemo(
    () => (forceNewTeam || resumeChooseLeague ? null : getOnboardingState(user?.id)),
    [user?.id, forceNewTeam, resumeChooseLeague]
  );
  const [step, setStepRaw] = useState<Step>(
    resumeChooseLeague && draft ? "league" : (initial?.step ?? (forceNewTeam ? "name" : "hero"))
  );
  const [creating, setCreating] = useState(false);
  const [createdTeamName, setCreatedTeamName] = useState(
    forceNewTeam || resumeChooseLeague ? "" : (initial?.teamName ?? "")
  );
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(
    forceNewTeam || resumeChooseLeague ? null : (initial?.teamId ?? null)
  );

  // When forcing a new team, wipe any stale persisted onboarding state.
  useEffect(() => {
    if (forceNewTeam) clearOnboardingState(user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceNewTeam, user?.id]);
  const [pendingName, setPendingName] = useState<string>(draft?.name ?? "");
  const [pendingMainSport, setPendingMainSport] = useState<"nba" | "wnba">(draft?.sport ?? "nba");
  const [resumedExtraLeagueIds, setResumedExtraLeagueIds] = useState<string[]>(() => {
    if (!draft) return [];
    const ids = [...draft.extraLeagueIds];
    if (resumedNewLeagueId && !ids.includes(resumedNewLeagueId)) ids.push(resumedNewLeagueId);
    return ids;
  });

  // Clear the consumed draft once hydrated. We intentionally keep location.state
  // intact so RequireAuth continues to honor resumeChooseLeague and doesn't
  // bounce returning users to the multi-team picker mid-flow.
  useEffect(() => {
    if (resumeChooseLeague) clearOnboardingDraft(user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (ready && !shouldOnboard && !preselectedLeagueId && !forceNewTeam && !resumeChooseLeague) {
      navigate("/", { replace: true });
    }
  }, [ready, shouldOnboard, navigate, preselectedLeagueId, forceNewTeam, resumeChooseLeague]);

  const submitTeam = async (
    name: string,
    args: { fantasyLeagueId?: string; leagueCode: "nba" | "wnba"; extraLeagueIds?: string[] }
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

      // Attach team to any extra leagues the user picked.
      const extras = (args.extraLeagueIds ?? []).filter(Boolean);
      let attachedCount = 0;
      for (const leagueId of extras) {
        try {
          // Use direct fetch (not supabase.functions.invoke) so non-2xx
          // responses like 409 ALREADY_HAS_TEAM don't trigger the SDK's
          // internal console.error (which the runtime-error reporter picks
          // up as a fatal RUNTIME_ERROR).
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token ?? "";
          const res = await fetch(`${FUNCTIONS_BASE}/leagues-manage/attach-team`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ league_id: leagueId, team_id: teamId }),
          });
          const body: any = await res.json().catch(() => ({}));
          const errCode: string | undefined = body?.error?.code;
          const errMsg: string | undefined = body?.error?.message;
          if (errCode === "ALREADY_HAS_TEAM") {
            attachedCount++;
            continue;
          }
          if (!res.ok || errCode) throw new Error(errMsg ?? `attach failed (${res.status})`);
          attachedCount++;
        } catch (e: any) {
          if (e?.message && /already have a team/i.test(e.message)) {
            attachedCount++;
            continue;
          }
          console.error("[onboarding] attach-team failed:", leagueId, e);
          toast({
            title: "Could not attach to a league",
            description: e?.message ?? "Skipped one league; continuing.",
            variant: "destructive",
          });
        }
      }
      if (attachedCount > 0) {
        toast({
          title: `Added to ${attachedCount + 1} league${attachedCount + 1 === 1 ? "" : "s"}`,
        });
      }

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

  const handleLeagueSubmit = async (args: { fantasyLeagueId: string; extraLeagueIds: string[]; leagueCode: "nba" | "wnba" }) => {
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

  // Back from DraftStep:
  //  - ≥2 owned teams → came via "New Team" CTA on the picker; return there.
  //  - preselected league (Step 2 was skipped) → back to Step 1 (Name).
  //  - otherwise → back to Step 2 (Choose League).
  // In all cases, delete the team we just created so the user doesn't end up
  // with an orphan empty franchise after re-picking name/league.
  const handleDraftBack = async () => {
    const ownedCount = teams.filter((t: any) => t.owner_id === user?.id).length;
    const justCreatedId = createdTeamId;
    if (justCreatedId) {
      try { await deleteTeam(justCreatedId); } catch (e) { console.error("[onboarding] team delete failed:", e); }
      setCreatedTeamId(null);
      setCreatedTeamName("");
      setSelectedTeamId(null as any);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    }
    if (ownedCount >= 2) {
      clearOnboardingState(user?.id);
      navigate("/welcome/pick-team", { replace: true });
      return;
    }
    const nextStep: Step = preselectedLeagueId ? "name" : "league";
    setStepRaw(nextStep);
    setOnboardingState(user?.id, { step: nextStep });
  };

  // Render-gate to prevent light→dark flash when bouncing back to /
  if (!ready || (!shouldOnboard && !preselectedLeagueId && !forceNewTeam && !resumeChooseLeague)) {
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
        className="absolute top-4 right-16 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur hover:bg-card text-foreground/80 hover:text-foreground transition-colors"
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
          initialSelectedIds={resumedExtraLeagueIds}
          onBeforeCreateLeague={(selectedIds) => {
            setOnboardingDraft(user?.id, {
              name: pendingName,
              sport: pendingMainSport,
              extraLeagueIds: selectedIds,
            });
          }}
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