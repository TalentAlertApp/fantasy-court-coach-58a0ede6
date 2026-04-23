import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useFirstRunGate } from "@/hooks/useFirstRunGate";
import { createTeam } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import OnboardingHero from "@/components/onboarding/OnboardingHero";
import NameStep from "@/components/onboarding/NameStep";
import DraftStep from "@/components/onboarding/DraftStep";
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
  const { user, signOut } = useAuth();
  const { teams, setSelectedTeamId } = useTeam();
  const { shouldOnboard, ready } = useFirstRunGate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hydrate persisted onboarding state for this user (resume after refresh)
  const initial = useMemo(() => getOnboardingState(user?.id), [user?.id]);
  const [step, setStepRaw] = useState<Step>(initial?.step ?? "hero");
  const [creating, setCreating] = useState(false);
  const [createdTeamName, setCreatedTeamName] = useState(initial?.teamName ?? "");
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(initial?.teamId ?? null);

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

  // If user already owns a team, kick them back home.
  useEffect(() => {
    if (ready && !shouldOnboard) {
      navigate("/", { replace: true });
    }
  }, [ready, shouldOnboard, navigate]);

  const handleCreateTeam = async (name: string) => {
    setCreating(true);
    try {
      const res = await createTeam({ name });
      const teamId = res.team.id;
      setSelectedTeamId(teamId);
      setCreatedTeamId(teamId);
      setCreatedTeamName(res.team.name);
      // Refresh teams list so the gate sees the new ownership
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
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
    navigate("/", { replace: true });
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
          onSubmit={handleCreateTeam}
          submitting={creating}
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