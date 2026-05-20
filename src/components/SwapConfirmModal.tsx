import { ArrowRight, AlertTriangle, Wallet, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { round1 } from "@/lib/money";

export interface SwapConfirmPlayer {
  id: number;
  name: string;
  team: string;
  photo?: string | null;
  fc_bc: "FC" | "BC" | string;
  /** Current market salary (in $M, e.g. 14.2). */
  salary: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  out: SwapConfirmPlayer | null;
  in_: SwapConfirmPlayer | null;
  /** Bank remaining BEFORE the trade. */
  bankBefore: number;
  /** Locked roster cost BEFORE the trade. */
  lockedBefore: number;
  salaryCap: number;
  /** Free transfers remaining BEFORE the trade. */
  freeTransfersBefore: number;
  transferCap: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

const ftColor = (n: number) =>
  n <= 0 ? "text-destructive" : n === 1 ? "text-[hsl(var(--nba-yellow))]" : "text-foreground";

const bankColor = (n: number) =>
  n < 0 ? "text-destructive" : n === 0 ? "text-[hsl(var(--nba-yellow))]" : "text-emerald-500";

export default function SwapConfirmModal({
  open, onOpenChange, out, in_, bankBefore, lockedBefore, salaryCap,
  freeTransfersBefore, transferCap, onConfirm, isSubmitting,
}: Props) {
  if (!out || !in_) return null;

  // Per the trade-budget rule: both sides valued at CURRENT market.
  // Every cap figure is forced through round1 so the modal matches the
  // server's authoritative comparison and never shows ghost cents.
  const outSalary = round1(out.salary);
  const inSalary = round1(in_.salary);
  const costDelta = round1(inSalary - outSalary);
  const bankBeforeR = round1(bankBefore);
  const lockedBeforeR = round1(lockedBefore);
  const bankAfter = round1(bankBeforeR - costDelta);
  // Locked accounting is authoritative server-side; display derives from bank.
  const lockedAfterDisplay = round1(Math.max(0, salaryCap - bankAfter));

  const ftAfter = Math.max(0, freeTransfersBefore - 1);
  const overBudget = bankAfter < 0;
  const noFt = freeTransfersBefore <= 0;
  const blocked = overBudget || noFt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wide">Confirm trade</DialogTitle>
          <DialogDescription>
            Review the players, your budget impact and weekly transfer cost before committing.
          </DialogDescription>
        </DialogHeader>

        {/* Players */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <PlayerCell p={out} label="OUT" tone="destructive" />
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <PlayerCell p={in_} label="IN" tone="emerald" />
          </div>
        </div>

        {/* Budget impact */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-heading uppercase text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Budget impact (current market)
          </div>
          <Row label="OUT value (freed)" value={`+$${outSalary.toFixed(1)}M`} valueClass="text-emerald-500 font-mono" />
          <Row label="IN cost" value={`−$${inSalary.toFixed(1)}M`} valueClass="text-destructive font-mono" />
          <Row
            label="Net change"
            value={`${costDelta >= 0 ? "−" : "+"}$${Math.abs(costDelta).toFixed(1)}M`}
            valueClass={`font-mono font-bold ${costDelta > 0 ? "text-destructive" : costDelta < 0 ? "text-emerald-500" : ""}`}
          />
          <div className="border-t pt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Bank before</div>
              <div className={`font-mono font-bold ${bankColor(bankBeforeR)}`}>${bankBeforeR.toFixed(1)}M</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Bank after</div>
              <div className={`font-mono font-bold ${bankColor(bankAfter)}`}>${bankAfter.toFixed(1)}M</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Roster cost (locked)</div>
              <div className="font-mono">${lockedBeforeR.toFixed(1)}M / ${salaryCap}M</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">After</div>
              <div className="font-mono">${lockedAfterDisplay.toFixed(1)}M / ${salaryCap}M</div>
            </div>
          </div>
        </div>

        {/* Transfers impact */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-heading uppercase text-muted-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Weekly transfers
          </div>
          <Row
            label="This trade uses"
            value="1 transfer"
            valueClass="font-mono font-bold text-foreground"
          />
          <Row
            label="Remaining after"
            value={`${ftAfter} / ${transferCap}`}
            valueClass={`font-mono font-bold ${ftColor(ftAfter)}`}
          />
        </div>

        {blocked && (
          <div className="rounded-md bg-destructive/10 border border-destructive/40 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {overBudget
                ? `Over budget by $${Math.abs(bankAfter).toFixed(1)}M — this trade isn't allowed.`
                : "No free transfers left this gameweek."}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={blocked || !!isSubmitting}>
            {isSubmitting ? "Saving..." : "Confirm trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function PlayerCell({ p, label, tone }: { p: SwapConfirmPlayer; label: string; tone: "destructive" | "emerald" }) {
  const toneClass = tone === "destructive" ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500";
  return (
    <div className="flex items-center gap-2 min-w-0">
      {p.photo ? (
        <img src={p.photo} alt="" className="h-10 w-10 rounded-full object-cover bg-muted shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge className={`rounded text-[9px] px-1.5 py-0 ${toneClass}`}>{label}</Badge>
          <span className="text-[10px] text-muted-foreground uppercase">{p.team} · {p.fc_bc}</span>
        </div>
        <div className="text-sm font-bold truncate">{p.name}</div>
        <div className="text-xs font-mono text-foreground/80">${p.salary.toFixed(1)}M</div>
      </div>
    </div>
  );
}