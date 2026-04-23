import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Sparkles, RefreshCw, X, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import type { TradeValidationResult } from "@/hooks/useTradeValidation";

export interface TradeChipPlayer {
  id: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC";
  salary: number;
  photo: string | null;
}

interface TradeWorkbenchProps {
  outs: TradeChipPlayer[];
  ins: TradeChipPlayer[];
  bankRemaining: number;
  validation: TradeValidationResult;
  gwUsed: number;
  gwCap: number;
  gw: number;
  capResetLabel: string;
  chipAllStar: boolean;
  chipWildcard: boolean;
  onRemoveOut: (id: number) => void;
  onRemoveIn: (id: number) => void;
  onReset: () => void;
  onGenerateReport: () => void;
  onToggleAllStar: () => void;
  onToggleWildcard: () => void;
  reportOpen: boolean;
}

function PlayerChip({
  p,
  variant,
  onRemove,
}: {
  p: TradeChipPlayer;
  variant: "out" | "in";
  onRemove: () => void;
}) {
  const isOut = variant === "out";
  const logo = getTeamLogo(p.team);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg pl-1 pr-2 h-9 text-[11px] font-heading uppercase border-2 ${
        isOut
          ? "bg-destructive/10 border-destructive/40 text-destructive"
          : "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
      }`}
    >
      <Avatar className="h-7 w-7 shrink-0">
        {p.photo && <AvatarImage src={p.photo} />}
        <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      {logo && <img src={logo} alt="" className="h-3.5 w-3.5" />}
      <span className="font-bold tracking-tight max-w-[110px] truncate">{p.name}</span>
      <span className="font-mono opacity-70">${p.salary}M</span>
      <button
        type="button"
        onClick={onRemove}
        className={`ml-0.5 inline-flex items-center justify-center h-5 w-5 rounded ${
          isOut ? "hover:bg-destructive/30" : "hover:bg-emerald-500/30"
        }`}
        aria-label={`Remove ${p.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center h-9 px-3 rounded-lg border-2 border-dashed border-border/60 bg-card/30 text-[10px] uppercase tracking-wider text-muted-foreground font-heading">
      {label}
    </span>
  );
}

export default function TradeWorkbench(props: TradeWorkbenchProps) {
  const {
    outs,
    ins,
    bankRemaining,
    validation,
    gwUsed,
    gwCap,
    gw,
    capResetLabel,
    chipAllStar,
    chipWildcard,
    onRemoveOut,
    onRemoveIn,
    onReset,
    onGenerateReport,
    onToggleAllStar,
    onToggleWildcard,
    reportOpen,
  } = props;

  const freed = validation.freedSalary;
  const added = validation.addedSalary;
  const available = bankRemaining + freed - added;
  const availableClass =
    available >= 0 ? "text-emerald-500" : "text-destructive";
  const canGenerate = validation.isValid && outs.length > 0 && ins.length === outs.length;

  // Empty-slot count derived from outs (1 or 2 expected ins to match)
  const expectedIns = Math.max(1, outs.length || 1);
  const inEmptyCount = Math.max(0, expectedIns - ins.length);
  const outEmptyCount = outs.length === 0 ? 1 : 0;

  return (
    <div className="rounded-xl border border-border bg-card/40 px-3 py-2.5 space-y-2">
      {/* Row 1 — OUT zone → IN zone */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* OUT zone */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-muted-foreground">
            Out ({outs.length}/2)
          </span>
          {outs.map((p) => (
            <PlayerChip key={p.id} p={p} variant="out" onRemove={() => onRemoveOut(p.id)} />
          ))}
          {outEmptyCount > 0 && <EmptySlot label="Click − on a roster row" />}
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* IN zone */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-muted-foreground">
            In ({ins.length}/{expectedIns})
          </span>
          {ins.map((p) => (
            <PlayerChip key={p.id} p={p} variant="in" onRemove={() => onRemoveIn(p.id)} />
          ))}
          {Array.from({ length: inEmptyCount }).map((_, i) => (
            <EmptySlot key={i} label="Click + on a player" />
          ))}
        </div>

        {/* Right cluster — chips + actions */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant={chipAllStar ? "default" : "outline"}
            className={`rounded-lg h-9 font-heading uppercase text-[11px] ${
              chipAllStar ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""
            }`}
            onClick={onToggleAllStar}
            title="All-Star chip — boosts trade cap"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />All-Star
          </Button>
          <Button
            size="sm"
            variant={chipWildcard ? "default" : "outline"}
            className={`rounded-lg h-9 font-heading uppercase text-[11px] ${
              chipWildcard ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""
            }`}
            onClick={onToggleWildcard}
            title="Wildcard chip — unlimited transfers"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Wildcard
          </Button>
        </div>
      </div>

      {/* Row 2 — Live math + validity + GW cap + actions */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] font-heading uppercase">
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 h-7">
          <span className="text-muted-foreground">Bank</span>
          <span className="font-mono font-bold">${bankRemaining.toFixed(1)}M</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 h-7">
          <span>Freed</span>
          <span className="font-mono font-bold">+${freed.toFixed(1)}M</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-2 h-7">
          <span>Spent</span>
          <span className="font-mono font-bold">−${added.toFixed(1)}M</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 h-7">
          <span className="text-muted-foreground">Available</span>
          <span className={`font-mono font-bold ${availableClass}`}>${available.toFixed(1)}M</span>
        </span>

        {/* Validity pill */}
        {validation.isValid && outs.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 h-7">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valid
          </span>
        ) : validation.reasons.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 h-7">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="normal-case tracking-normal text-[10px] font-sans">
              {validation.reasons[0]}
            </span>
          </span>
        ) : null}

        {/* GW cap counter */}
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 h-7 ${
            gwUsed >= gwCap
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-background"
          }`}
          title={`Cap resets ${capResetLabel}`}
        >
          <span className="text-muted-foreground">GW{gw}</span>
          <span className="font-mono font-bold">
            {gwUsed}/{gwCap}
          </span>
          <span className="text-muted-foreground normal-case tracking-normal text-[10px] font-sans">
            trades
          </span>
        </span>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {(outs.length > 0 || ins.length > 0) && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-8 font-heading uppercase text-[10px]"
              onClick={onReset}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            className="rounded-lg h-8 font-heading uppercase text-[10px] gap-1.5"
            onClick={onGenerateReport}
            disabled={!canGenerate}
            title={canGenerate ? "Open the trade report" : "Pick equal OUT and IN counts that pass all rules"}
          >
            <FileText className="h-3.5 w-3.5" />
            {reportOpen ? "Refresh Report" : "Generate Report"}
          </Button>
        </div>
      </div>

      {/* GW cap reached banner */}
      {gwUsed >= gwCap && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive font-heading uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          GW{gw} transfer cap reached — resets {capResetLabel}
        </div>
      )}
    </div>
  );
}