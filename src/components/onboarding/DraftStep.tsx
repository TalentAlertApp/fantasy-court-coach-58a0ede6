import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Hand, Bot, Loader2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { autoPickRoster } from "@/lib/api";
import { useTeam } from "@/contexts/TeamContext";
import { useQueryClient } from "@tanstack/react-query";
import AICoachModal from "@/components/AICoachModal";

type Strategy = "auto" | "manual" | "ai";

interface Props {
  teamName: string;
  onFinish: () => void;
}

export default function DraftStep({ teamName, onFinish }: Props) {
  const { toast } = useToast();
  const { selectedTeamId } = useTeam();
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<Strategy>("auto");
  const [drafting, setDrafting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const runAutoDraft = async () => {
    if (!selectedTeamId) return;
    setDrafting(true);
    try {
      await autoPickRoster({ gw: 1, day: 1, strategy: "value5" }, selectedTeamId);
      await queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      toast({ title: "Squad drafted!", description: "Your starting roster is ready." });
      // small delay so the success overlay reads cleanly
      setTimeout(onFinish, 800);
    } catch (e: any) {
      toast({
        title: "Auto-draft failed",
        description: e?.message ?? "Try again or pick manually.",
        variant: "destructive",
      });
      setDrafting(false);
    }
  };

  const handleGo = () => {
    if (strategy === "auto") return runAutoDraft();
    if (strategy === "ai") return setAiOpen(true);
    // manual: just send the user to the roster page; the empty roster invites them to add players
    toast({
      title: "Ready to draft",
      description: "Use the Transactions page to hand-pick your 10 players.",
    });
    onFinish();
  };

  const options: { id: Strategy; icon: any; title: string; subtitle: string; recommended?: boolean }[] = [
    {
      id: "auto",
      icon: Zap,
      title: "Auto-Draft",
      subtitle: "Balanced 10-player squad, optimised for the next 5 games.",
      recommended: true,
    },
    {
      id: "manual",
      icon: Hand,
      title: "Manual",
      subtitle: "Hand-pick all 10 players yourself from the full pool.",
    },
    {
      id: "ai",
      icon: Bot,
      title: "AI Coach",
      subtitle: "Tell the coach your style and get a personalised roster.",
    },
  ];

  return (
    <div className="relative flex flex-col min-h-screen px-6 py-10 items-center justify-center">
      {drafting && <DraftingOverlay />}

      <StepIndicator step={2} />

      <div className="w-full max-w-4xl text-center animate-fade-in">
        <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">Step 2 of 2</p>
        <h2 className="font-heading font-black uppercase tracking-[0.15em] text-5xl md:text-7xl text-foreground">
          Draft <span className="text-accent">{teamName || "Your Squad"}</span>
        </h2>
        <p className="mt-4 text-sm md:text-base text-foreground/60">
          Pick your drafting style — you can swap players any time after.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = strategy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStrategy(opt.id)}
                className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
                  active
                    ? "border-accent bg-accent/5 shadow-[0_0_40px_-15px_hsl(var(--accent))]"
                    : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/25"
                }`}
              >
                {opt.recommended && (
                  <span className="absolute -top-2 right-4 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.2em] bg-accent text-accent-foreground">
                    Recommended
                  </span>
                )}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
                  active ? "bg-accent text-accent-foreground" : "bg-foreground/10 text-foreground/70"
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-heading uppercase tracking-[0.15em] text-base text-foreground">
                  {opt.title}
                </h3>
                <p className="mt-2 text-xs text-foreground/60 leading-relaxed">
                  {opt.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        <Button
          onClick={handleGo}
          disabled={drafting}
          size="lg"
          className="mt-12 h-16 px-12 rounded-full text-base tracking-[0.25em] shadow-[0_0_50px_-10px_hsl(var(--accent))] hover:translate-y-[-2px] hover:shadow-[0_0_70px_-10px_hsl(var(--accent))] transition-all"
        >
          {drafting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Drafting…
            </>
          ) : (
            <>
              <Trophy className="mr-2 h-5 w-5" /> Go to My Roster
            </>
          )}
        </Button>
      </div>

      <AICoachModal
        open={aiOpen}
        onOpenChange={(o) => {
          setAiOpen(o);
          if (!o) onFinish();
        }}
      />
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 1 ? "bg-accent" : "bg-foreground/20"}`} />
      <span className="h-px w-8 bg-foreground/15" />
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 2 ? "bg-accent" : "bg-foreground/20"}`} />
    </div>
  );
}

function DraftingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/30 blur-3xl animate-pulse" />
        <Trophy className="relative h-20 w-20 text-accent" />
      </div>
      <p className="mt-8 font-heading uppercase tracking-[0.4em] text-sm text-foreground/80">
        Drafting Your Squad
      </p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full w-1/3 bg-accent animate-[shimmer_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}