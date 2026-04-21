import { useEffect, useState } from "react";
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

type Step = "hero" | "name" | "draft";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { setSelectedTeamId } = useTeam();
  const { shouldOnboard, ready } = useFirstRunGate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("hero");
  const [creating, setCreating] = useState(false);
  const [createdTeamName, setCreatedTeamName] = useState("");

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
      setCreatedTeamName(res.team.name);
      // Refresh teams list so the gate sees the new ownership
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setStep("draft");
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleFinish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["teams"] });
    await queryClient.invalidateQueries({ queryKey: ["roster-current"] });
    navigate("/", { replace: true });
  };

  return (
    <div
      className="relative min-h-screen w-full bg-background text-foreground overflow-hidden"
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
        <DraftStep teamName={createdTeamName} onFinish={handleFinish} />
      )}
    </div>
  );
}