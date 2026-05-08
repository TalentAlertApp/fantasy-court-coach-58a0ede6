import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wand2, RefreshCw, Star } from "lucide-react";

interface PlayerLite {
  id: number;
  name: string;
  team: string;
  photo?: string | null;
  fc_bc?: string;
  salary?: number;
}

export interface AutoPickProposal {
  starters: number[];
  bench: number[];
  captain_id: number;
  bank_remaining: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: { starters: number[]; bench: number[]; captain_id: number };
  proposed: AutoPickProposal | null;
  playersById: Map<number, PlayerLite>;
  onConfirm: () => void;
  isApplying: boolean;
}

function PlayerRow({ p, isCaptain }: { p?: PlayerLite; isCaptain?: boolean }) {
  if (!p) return <div className="text-xs text-muted-foreground italic">Unknown</div>;
  const isFc = p.fc_bc === "FC";
  return (
    <div className="flex items-center gap-2 py-1">
      <Avatar className={`h-6 w-6 shrink-0 ring-2 ${isFc ? "ring-destructive" : "ring-primary"}`}>
        {p.photo && <AvatarImage src={p.photo} alt={p.name} />}
        <AvatarFallback className="text-[9px]">{p.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="text-[13px] font-semibold truncate flex-1">{p.name}</span>
      {isCaptain && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
      <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">${(p.salary ?? 0).toFixed(1)}M</span>
    </div>
  );
}

export default function AutoPickConfirmModal({
  open,
  onOpenChange,
  current,
  proposed,
  playersById,
  onConfirm,
  isApplying,
}: Props) {
  const diff = useMemo(() => {
    if (!proposed) return { adds: [] as number[], drops: [] as number[] };
    const cur = new Set([...current.starters, ...current.bench]);
    const prop = new Set([...proposed.starters, ...proposed.bench]);
    const adds = [...prop].filter((id) => !cur.has(id));
    const drops = [...cur].filter((id) => !prop.has(id));
    return { adds, drops };
  }, [current, proposed]);

  const captainChanged = proposed && proposed.captain_id !== current.captain_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-400" /> Auto-pick proposal
          </DialogTitle>
        </DialogHeader>

        {!proposed ? (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Calculating optimal roster…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Changes</div>
                <div className="font-mono text-lg font-bold">{diff.adds.length}</div>
                <div className="text-[10px] text-muted-foreground">in / out</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Bank left</div>
                <div className="font-mono text-lg font-bold">${proposed.bank_remaining.toFixed(1)}M</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-heading">Captain</div>
                <div className="text-[13px] font-semibold truncate">
                  {playersById.get(proposed.captain_id)?.name ?? "—"}
                </div>
                {captainChanged && <div className="text-[9px] text-amber-500 uppercase tracking-wider">Changed</div>}
              </div>
            </div>

            {/* Diff lists */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] font-heading uppercase tracking-wider text-destructive mb-1.5">Out ({diff.drops.length})</div>
                {diff.drops.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-1">No drops</div>
                ) : (
                  diff.drops.map((id) => <PlayerRow key={id} p={playersById.get(id)} />)
                )}
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] font-heading uppercase tracking-wider text-emerald-500 mb-1.5">In ({diff.adds.length})</div>
                {diff.adds.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-1">No additions</div>
                ) : (
                  diff.adds.map((id) => (
                    <PlayerRow key={id} p={playersById.get(id)} isCaptain={id === proposed.captain_id} />
                  ))
                )}
              </div>
            </div>

            {/* Proposed starting 5 */}
            <div className="rounded-lg border bg-card p-3">
              <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                Proposed Starting 5 <ArrowRight className="h-3 w-3" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                {proposed.starters.map((id) => (
                  <PlayerRow key={id} p={playersById.get(id)} isCaptain={id === proposed.captain_id} />
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!proposed || isApplying} className="gap-1">
            {isApplying && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Apply changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}