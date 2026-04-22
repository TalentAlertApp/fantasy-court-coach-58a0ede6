import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Zap, Hand, Bot, Loader2, Trophy, Check, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { autoPickRoster, saveRoster } from "@/lib/api";
import { useTeam } from "@/contexts/TeamContext";
import { useQueryClient } from "@tanstack/react-query";
import AICoachModal from "@/components/AICoachModal";
import PlayerPickerDialog from "@/components/PlayerPickerDialog";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { getCurrentGameday } from "@/lib/deadlines";
import { PlayerListItemSchema } from "@/lib/contracts";

type Strategy = "auto" | "manual" | "ai";
type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

const SALARY_CAP = 100;

interface Props {
  teamName: string;
  onFinish: () => void;
  onBack?: () => void;
}

export default function DraftPicker({ teamName, onFinish, onBack }: Props) {
  const { toast } = useToast();
  const { selectedTeamId } = useTeam();
  const queryClient = useQueryClient();
  const { refetch: refetchRoster } = useRosterQuery();

  const [strategy, setStrategy] = useState<Strategy>("auto");
  const [drafting, setDrafting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [picks, setPicks] = useState<PlayerListItem[]>([]);
  const playersQuery = usePlayersQuery({ limit: 1000 });
  const allPlayers: PlayerListItem[] = (playersQuery.data?.items ?? []) as PlayerListItem[];

  const fcCount = picks.filter((p) => p.core.fc_bc === "FC").length;
  const bcCount = picks.filter((p) => p.core.fc_bc === "BC").length;
  const totalSalary = picks.reduce((s, p) => s + (p.core.salary ?? 0), 0);
  const bankRemaining = SALARY_CAP - totalSalary;
  const rosterIds = useMemo(() => new Set(picks.map((p) => p.core.id)), [picks]);
  const rosterTeams = useMemo(() => picks.map((p) => p.core.team), [picks]);

  const isManualValid =
    picks.length === 10 && fcCount === 5 && bcCount === 5 && totalSalary <= SALARY_CAP;

  const handoff = async () => {
    setSuccess(true);
    if (selectedTeamId) {
      await queryClient.invalidateQueries({ queryKey: ["roster-current", selectedTeamId] });
    }
    await queryClient.invalidateQueries({ queryKey: ["teams"] });
    setTimeout(onFinish, 900);
  };

  const runAutoDraft = async () => {
    if (!selectedTeamId) return;
    setDrafting(true);
    try {
      const { gw, day } = getCurrentGameday();
      await autoPickRoster({ gw, day, strategy: "value5" }, selectedTeamId);
      toast({ title: "Squad drafted!", description: `Saved under GW${gw} · Day ${day}.` });
      await handoff();
    } catch (e: any) {
      toast({
        title: "Auto-draft failed",
        description: e?.message ?? "Try again or pick manually.",
        variant: "destructive",
      });
      setDrafting(false);
    }
  };

  const handlePick = (p: PlayerListItem) => {
    setPicks((prev) => {
      const next = [...prev, p];
      if (next.length < 10) {
        setTimeout(() => setManualOpen(true), 0);
      }
      return next;
    });
  };

  const removePick = (id: number) => {
    setPicks((prev) => prev.filter((p) => p.core.id !== id));
  };

  const submitManual = async () => {
    if (!selectedTeamId || !isManualValid) return;
    setDrafting(true);
    try {
      const { gw, day } = getCurrentGameday();
      const sorted = [...picks].sort((a, b) => (b.last5?.fp5 ?? 0) - (a.last5?.fp5 ?? 0));
      const starters: PlayerListItem[] = [];
      const bench: PlayerListItem[] = [];
      let fcStart = 0, bcStart = 0;
      for (const p of sorted) {
        const isFC = p.core.fc_bc === "FC";
        if (starters.length < 5) {
          const remainingSlots = 5 - starters.length;
          const needFC = Math.max(0, 2 - fcStart);
          const needBC = Math.max(0, 2 - bcStart);
          const reservedForOther = (isFC ? needBC : needFC);
          if (remainingSlots - reservedForOther > 0) {
            starters.push(p);
            if (isFC) fcStart++; else bcStart++;
            continue;
          }
        }
        bench.push(p);
      }
      while (starters.length < 5 && bench.length) starters.push(bench.shift()!);

      await saveRoster({
        gw, day,
        starters: starters.map((p) => p.core.id),
        bench: bench.map((p) => p.core.id),
        captain_id: 0,
      }, selectedTeamId);
      toast({ title: "Roster saved!", description: `10 players locked in for GW${gw} · Day ${day}.` });
      await handoff();
    } catch (e: any) {
      toast({
        title: "Could not save roster",
        description: e?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
      setDrafting(false);
    }
  };

  const handleGo = () => {
    if (strategy === "auto") return runAutoDraft();
    if (strategy === "ai") return setAiOpen(true);
    if (strategy === "manual" && isManualValid) return submitManual();
    setManualOpen(true);
  };

  // AI Coach: only handoff when modal closes AND a roster was actually drafted
  const handleAiClose = async (open: boolean) => {
    setAiOpen(open);
    if (!open) {
      const { data } = await refetchRoster();
      const starters = data?.roster?.starters ?? [];
      const hasRoster = starters.some((id: number) => id > 0);
      if (hasRoster) {
        await handoff();
      }
    }
  };

  const options: { id: Strategy; icon: any; title: string; subtitle: string; recommended?: boolean }[] = [
    { id: "auto", icon: Zap, title: "Auto-Draft", subtitle: "Balanced 10-player squad, optimised for the next 5 games.", recommended: true },
    { id: "manual", icon: Hand, title: "Manual", subtitle: "Hand-pick all 10 players yourself — we enforce the rules." },
    { id: "ai", icon: Bot, title: "AI Coach", subtitle: "Tell the coach your style and get a personalised roster." },
  ];

  const ctaLabel =
    strategy === "auto" ? "Auto-Draft My Squad" :
    strategy === "ai" ? "Open AI Coach" :
    picks.length === 0 ? "Start Picking" : isManualValid ? "Save Roster · Go to Court" : `Pick ${10 - picks.length} More`;

  return (
    <div className="relative flex flex-col h-screen px-6 py-8 items-center justify-center">
      {(drafting || success) && <DraftingOverlay success={success} />}

      <StepIndicator step={3} />

      <div className="w-full max-w-4xl text-center animate-fade-in flex flex-col items-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">Step 3 of 3</p>
        <h2
          className="font-heading font-black uppercase tracking-[0.15em] text-foreground"
          style={{ fontSize: "clamp(2.5rem, 8vh, 5rem)", lineHeight: 1 }}
        >
          Draft <span className="text-accent">{teamName || "Your Squad"}</span>
        </h2>
        <p className="mt-3 text-sm md:text-base text-foreground/60">
          Pick your drafting style — you can swap players any time after.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3 w-full">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = strategy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStrategy(opt.id)}
                className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
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
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-3 ${
                  active ? "bg-accent text-accent-foreground" : "bg-foreground/10 text-foreground/70"
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-heading uppercase tracking-[0.15em] text-base text-foreground">
                  {opt.title}
                </h3>
                <p className="mt-1.5 text-xs text-foreground/60 leading-relaxed">
                  {opt.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {strategy === "manual" && picks.length > 0 && (
          <div className="mt-5 mx-auto max-w-2xl rounded-2xl border-2 border-accent/40 bg-accent/5 p-3">
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] uppercase tracking-[0.2em] font-bold">
              <span className="px-3 py-1 rounded-full border border-[hsl(var(--nba-yellow))] bg-[hsl(var(--nba-yellow))]/10 text-black">
                Picked {picks.length}/10
              </span>
              <span className={`px-3 py-1 rounded-full border bg-[hsl(var(--nba-yellow))]/10 text-black ${fcCount === 5 ? "border-[hsl(var(--nba-yellow))]" : "border-destructive/60"}`}>
                {fcCount} FC / 5
              </span>
              <span className={`px-3 py-1 rounded-full border bg-[hsl(var(--nba-yellow))]/10 text-black ${bcCount === 5 ? "border-[hsl(var(--nba-yellow))]" : "border-destructive/60"}`}>
                {bcCount} BC / 5
              </span>
              <span className={`px-3 py-1 rounded-full border bg-[hsl(var(--nba-yellow))]/10 text-black ${totalSalary <= SALARY_CAP ? "border-[hsl(var(--nba-yellow))]" : "border-destructive/60"}`}>
                ${totalSalary.toFixed(1)}M / ${SALARY_CAP}M
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              {picks.map((p) => (
                <button
                  key={p.core.id}
                  onClick={() => removePick(p.core.id)}
                  className="px-2 py-1 rounded-full text-[10px] font-semibold bg-foreground/10 text-foreground/80 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="Remove"
                >
                  {p.core.name} ✕
                </button>
              ))}
            </div>
            {picks.length < 10 && (
              <button
                onClick={() => setManualOpen(true)}
                className="mt-2 text-[11px] uppercase tracking-[0.2em] text-accent hover:underline underline-offset-4"
              >
                + Add more players
              </button>
            )}
          </div>
        )}

        <Button
          onClick={handleGo}
          disabled={drafting || (strategy === "manual" && picks.length === 10 && !isManualValid) || playersQuery.isLoading}
          size="lg"
          className="mt-8 h-14 px-10 rounded-full text-base tracking-[0.25em] shadow-[0_0_50px_-10px_hsl(var(--accent))] hover:translate-y-[-2px] hover:shadow-[0_0_70px_-10px_hsl(var(--accent))] transition-all"
        >
          {drafting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving…</>
          ) : strategy === "manual" && isManualValid ? (
            <><Check className="mr-2 h-5 w-5" /> {ctaLabel}</>
          ) : (
            <><Trophy className="mr-2 h-5 w-5" /> {ctaLabel}</>
          )}
        </Button>

        {strategy === "manual" && picks.length > 0 && !isManualValid && (
          <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-foreground/50">
            Need exactly 5 FC + 5 BC, ≤ ${SALARY_CAP}M, max 2 per NBA team
          </p>
        )}

        {isOnboarding && (
          <div className="mt-auto pt-6 flex flex-wrap items-center justify-center gap-3">
            {["$100M Cap", "10 Players", "5 FC + 5 BC", "1 Captain · 2× FP"].map((chip) => (
              <span
                key={chip}
                className="px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.25em] border border-[hsl(var(--nba-yellow))] bg-[hsl(var(--nba-yellow))]/10 text-black font-bold"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      {strategy === "manual" && (
        <PlayerPickerDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          allPlayers={allPlayers}
          rosterIds={rosterIds}
          rosterTeams={rosterTeams}
          onSelect={handlePick}
          title={`Pick player ${picks.length + 1} of 10`}
          bankRemaining={bankRemaining}
        />
      )}

      <AICoachModal open={aiOpen} onOpenChange={handleAiClose} />
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 1 ? "bg-accent" : "bg-foreground/20"}`} />
      <span className="h-px w-8 bg-foreground/15" />
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 2 ? "bg-accent" : "bg-foreground/20"}`} />
      <span className="h-px w-8 bg-foreground/15" />
      <span className={`h-2.5 w-2.5 rounded-full transition-colors ${step >= 3 ? "bg-accent" : "bg-foreground/20"}`} />
    </div>
  );
}

function DraftingOverlay({ success }: { success: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/30 blur-3xl animate-pulse" />
        {success ? (
          <Check className="relative h-20 w-20 text-accent" />
        ) : (
          <Trophy className="relative h-20 w-20 text-accent" />
        )}
      </div>
      <p className="mt-8 font-heading uppercase tracking-[0.4em] text-sm text-foreground/80">
        {success ? "Roster Ready · Routing to Court" : "Drafting Your Squad"}
      </p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full w-1/3 bg-accent animate-[shimmer_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
