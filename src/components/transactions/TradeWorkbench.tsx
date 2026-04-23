import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, AlertTriangle, CheckCircle2, FileText, Check } from "lucide-react";
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
  onRemoveOut: (id: number) => void;
  onRemoveIn: (id: number) => void;
  onReset: () => void;
  onGenerateReport: () => void;
  onConfirmAdd?: () => void;
  committing?: boolean;
  reportOpen: boolean;
  /** True when roster has < 10 players (ADD mode — direct adds allowed). */
  addMode?: boolean;
  /** Roster size displayed in the header pill, e.g. "9/10". */
  rosterSize?: number;
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
      <span className="text-[9px] opacity-70 mr-0.5">{isOut ? "OUT" : "IN"}</span>
      <Avatar className="h-7 w-7 shrink-0">
        {p.photo && <AvatarImage src={p.photo} />}
        <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      {logo && <img src={logo} alt="" className="h-4 w-4" />}
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

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "warn";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warn"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background h-7 px-3 text-[10px] font-heading uppercase tracking-wider">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${valueClass}`}>{value}</span>
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
    onRemoveOut,
    onRemoveIn,
    onReset,
    onGenerateReport,
    onConfirmAdd,
    committing = false,
    reportOpen,
    addMode = false,
    rosterSize,
  } = props;

  const freed = validation.freedSalary;
  const added = validation.addedSalary;
  const available = bankRemaining + freed - added;
  const availableTone: "positive" | "negative" =
    available >= 0 ? "positive" : "negative";
  const hasChips = outs.length > 0 || ins.length > 0;
  // ADD-mode direct commit: roster < 10, no OUT, at least one IN, validation passes.
  const isDirectAdd = addMode && outs.length === 0 && ins.length > 0;
  const canConfirmAdd = isDirectAdd && validation.isValid;
  // Standard SWAP report eligibility (need matched OUT/IN counts).
  const canGenerate = validation.isValid && hasChips && ins.length === outs.length && outs.length > 0;
  const gwCapHit = gwUsed >= gwCap;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      {/* ADD mode banner */}
      {addMode && typeof rosterSize === "number" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-heading uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Roster {rosterSize}/10 — you can ADD a player directly. No release required.
        </div>
      )}

      {/* Row 1 — Metrics (left) + Status pill (far right) */}
      <div className="flex items-center gap-2 flex-wrap">
        <MetricPill label="Bank" value={`$${bankRemaining.toFixed(1)}M`} />
        <MetricPill label="Freed" value={`+$${freed.toFixed(1)}M`} tone="positive" />
        <MetricPill label="Spent" value={`−$${added.toFixed(1)}M`} tone="negative" />
        <MetricPill label="Available" value={`$${available.toFixed(1)}M`} tone={availableTone} />
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 h-7 text-[10px] font-heading uppercase tracking-wider ${
            gwCapHit
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-background"
          }`}
          title={gwCapHit ? `GW${gw} cap reached — resets ${capResetLabel}` : `Cap resets ${capResetLabel}`}
        >
          <span className="text-muted-foreground">GW{gw}</span>
          <span className="font-mono font-bold">
            {gwUsed}/{gwCap}
          </span>
          <span className="normal-case font-sans">trades</span>
        </span>

        {/* Status pill — inline, right after GW trades pill */}
        {validation.isValid && hasChips ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 h-7 text-[10px] font-heading uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valid
          </span>
        ) : validation.reasons.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 h-7 text-[10px]">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="normal-case font-sans">{validation.reasons[0]}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background text-muted-foreground px-3 h-7 text-[10px] font-heading uppercase tracking-wider">
            {addMode ? "Pick a player to add" : "Pick a player to release"}
          </span>
        )}
      </div>

      {/* Row 2 — Chips (only when staged) + Actions (right) */}
      {(hasChips || isDirectAdd) && (
        <div className="flex items-center gap-2 flex-wrap">
          {outs.map((p) => (
            <PlayerChip key={p.id} p={p} variant="out" onRemove={() => onRemoveOut(p.id)} />
          ))}
          {ins.map((p) => (
            <PlayerChip key={p.id} p={p} variant="in" onRemove={() => onRemoveIn(p.id)} />
          ))}

          <div className="ml-auto flex items-center gap-1.5">
            {hasChips && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg h-8 font-heading uppercase text-[10px]"
                onClick={onReset}
              >
                Reset
              </Button>
            )}
            {isDirectAdd ? (
              <Button
                size="sm"
                className="rounded-lg h-8 font-heading uppercase text-[10px] gap-1.5"
                onClick={onConfirmAdd}
                disabled={!canConfirmAdd || committing}
                title={canConfirmAdd ? "Add this player to your roster" : "Make a valid selection first"}
              >
                <Check className="h-3.5 w-3.5" />
                {committing ? "Adding…" : `Confirm Add${ins.length > 1 ? ` (${ins.length})` : ""}`}
              </Button>
            ) : (
              canGenerate && (
                <Button
                  size="sm"
                  className="rounded-lg h-8 font-heading uppercase text-[10px] gap-1.5"
                  onClick={onGenerateReport}
                  title="Open the trade report"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {reportOpen ? "Refresh" : "Report"}
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
