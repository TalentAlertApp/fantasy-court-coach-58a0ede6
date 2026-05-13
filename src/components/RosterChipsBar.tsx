import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Star, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";
import { useTeamChips } from "@/hooks/useTeamChips";

type Starter = { id: number; name: string; team?: string };

interface Props {
  teamId: string | null | undefined;
  gw: number;
  day: number;
  starters: Starter[];
  lineupLocked: boolean;
}

export default function RosterChipsBar({ teamId, gw, day, starters, lineupLocked }: Props) {
  const { chipRules } = useFantasyLeague();
  const { data: usedChips } = useTeamChips(teamId);
  const queryClient = useQueryClient();

  const [wcOpen, setWcOpen] = useState(false);
  const [asOpen, setAsOpen] = useState(false);
  const [asPlayer, setAsPlayer] = useState<number>(0);

  const wildcardOn = chipRules?.wildcard_enabled ?? true;
  const allStarOn = chipRules?.all_star_enabled ?? false;
  if (!wildcardOn && !allStarOn) return null;

  const wildcardUsed = usedChips?.find((c) => c.chip === "wildcard");
  const allStarUsed = usedChips?.find((c) => c.chip === "all_star");

  const activate = useMutation({
    mutationFn: async (vars: { chip: "wildcard" | "all_star"; player_id?: number }) => {
      const { data, error } = await supabase.functions.invoke("transactions-commit", {
        body: { gw, day, outs: [], ins: [], chip: vars.chip, chip_player_id: vars.player_id ?? 0 },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error((data as any)?.error?.message || "Activation failed");
      return data;
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.chip === "wildcard" ? "Wildcard activated" : "All-Star activated" });
      queryClient.invalidateQueries({ queryKey: ["team-chips", teamId] });
    },
    onError: (e: any) => toast({ title: "Could not activate chip", description: e?.message, variant: "destructive" }),
  });

  const allStarMult = chipRules?.all_star_multiplier ?? 2;

  return (
    <div className="mb-3 rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        <span className="font-heading text-[11px] uppercase tracking-widest text-muted-foreground">Season Chips</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {wildcardOn && (
          <ChipCard
            icon={<Wand2 className="h-4 w-4 text-fuchsia-400" />}
            name="Wildcard"
            desc="Unlimited transfers this game week. Once per season."
            statusLabel={wildcardUsed ? `Used GW${wildcardUsed.gw}` : "Available"}
            statusTone={wildcardUsed ? "muted" : "ok"}
            disabled={!!wildcardUsed || lineupLocked || activate.isPending}
            onActivate={() => setWcOpen(true)}
          />
        )}
        {allStarOn && (
          <ChipCard
            icon={<Star className="h-4 w-4 text-amber-400" />}
            name="All-Star Boost"
            desc={`One starter scores ×${allStarMult} this game week. Once per season.`}
            statusLabel={allStarUsed ? `Used GW${allStarUsed.gw}` : "Available"}
            statusTone={allStarUsed ? "muted" : "ok"}
            disabled={!!allStarUsed || lineupLocked || activate.isPending}
            onActivate={() => { setAsPlayer(starters[0]?.id ?? 0); setAsOpen(true); }}
          />
        )}
      </div>

      <AlertDialog open={wcOpen} onOpenChange={setWcOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Wildcard?</AlertDialogTitle>
            <AlertDialogDescription>
              You can make unlimited transfers this game week. This uses your wildcard for the season.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setWcOpen(false); activate.mutate({ chip: "wildcard" }); }}
            >Activate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={asOpen} onOpenChange={setAsOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Activate All-Star Boost</DialogTitle>
            <DialogDescription>
              Pick a starter — they will score ×{allStarMult} for game week {gw}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[260px] overflow-auto">
            {starters.length === 0 && <p className="text-sm text-muted-foreground">No starters set.</p>}
            {starters.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAsPlayer(p.id)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                  asPlayer === p.id ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.team ?? ""}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsOpen(false)}>Cancel</Button>
            <Button
              disabled={!asPlayer || activate.isPending}
              onClick={() => { setAsOpen(false); activate.mutate({ chip: "all_star", player_id: asPlayer }); }}
            >Activate (×{allStarMult})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChipCard({
  icon, name, desc, statusLabel, statusTone, disabled, onActivate,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  statusLabel: string;
  statusTone: "ok" | "muted";
  disabled: boolean;
  onActivate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-2.5">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-heading text-xs uppercase tracking-wide">{name}</span>
          <Badge
            variant={statusTone === "ok" ? "default" : "secondary"}
            className={`rounded-md text-[10px] ${statusTone === "ok" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : ""}`}
          >
            {statusLabel}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{desc}</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="rounded-lg font-heading text-[11px] uppercase tracking-wide"
        disabled={disabled}
        onClick={onActivate}
      >
        Activate
      </Button>
    </div>
  );
}