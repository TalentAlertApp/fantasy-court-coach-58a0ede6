import { useState, useMemo } from "react";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, X } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { getRowPositions } from "@/lib/court-layout";
import courtBg from "@/assets/court-bg.png";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlayers: PlayerListItem[];
  rosterIds: Set<number>;
  rosterTeams?: string[];
  onSelect: (player: PlayerListItem) => void;
  title?: string;
  bankRemaining?: number;
  swapPlayerSalary?: number;
  swapPlayerPosition?: string | null;
  /** When true, renders a basketball court preview on the right with the current picks */
  showCourtPreview?: boolean;
  picks?: PlayerListItem[];
  onRemovePick?: (id: number) => void;
}

function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  return `${parts[0][0]}.${parts[parts.length - 1]}`.toUpperCase();
}

export default function PlayerPickerDialog({
  open, onOpenChange, allPlayers, rosterIds, rosterTeams = [], onSelect, title = "Pick a Player",
  bankRemaining, swapPlayerSalary, swapPlayerPosition,
  showCourtPreview = false, picks = [], onRemovePick,
}: PlayerPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [fcBcFilter, setFcBcFilter] = useState<"ALL" | "FC" | "BC">("ALL");

  const effectiveFilter = swapPlayerPosition ? (swapPlayerPosition as "FC" | "BC") : fcBcFilter;
  const showToggle = !swapPlayerPosition;

  const budgetAvailable = bankRemaining != null
    ? bankRemaining + (swapPlayerSalary ?? 0)
    : null;

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of rosterTeams) counts[t] = (counts[t] || 0) + 1;
    return counts;
  }, [rosterTeams]);

  const available = useMemo(() => {
    let filtered = allPlayers.filter((p) => !rosterIds.has(p.core.id));
    if (effectiveFilter !== "ALL") {
      filtered = filtered.filter((p) => p.core.fc_bc === effectiveFilter);
    }
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((p) =>
      p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q)
    );
  }, [allPlayers, rosterIds, search, effectiveFilter]);

  // 2-column grid layout when showCourtPreview is true
  const dialogClass = showCourtPreview
    ? "max-w-[960px] w-[95vw] h-[min(82vh,44rem)] rounded-lg overflow-hidden p-0 grid grid-cols-[420px_minmax(0,1fr)] gap-0"
    : "max-w-md h-[min(80vh,42rem)] rounded-lg overflow-hidden p-0 flex flex-col";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(""); setFcBcFilter("ALL"); } }}>
      <DialogContent className={dialogClass}>
        {/* LEFT — search + player list */}
        <div className={`flex flex-col min-h-0 p-4 ${showCourtPreview ? "border-r border-border" : ""}`}>
          <DialogHeader className="pr-10 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <DialogTitle className="font-heading">{title}</DialogTitle>
              {budgetAvailable != null && !showCourtPreview && (
                <Badge variant="outline" className="text-[10px] font-mono rounded-lg">
                  Budget: ${budgetAvailable.toFixed(1)}M
                </Badge>
              )}
              {showToggle && (
                <ToggleGroup type="single" value={fcBcFilter} onValueChange={(v) => v && setFcBcFilter(v as "ALL" | "FC" | "BC")}>
                  <ToggleGroupItem value="ALL" className="text-[10px] font-heading uppercase rounded-lg h-7 px-2 dark:data-[state=on]:bg-muted dark:data-[state=on]:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground">All</ToggleGroupItem>
                  <ToggleGroupItem value="FC" className="text-[10px] font-heading uppercase rounded-lg h-7 px-2 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground">FC</ToggleGroupItem>
                  <ToggleGroupItem value="BC" className="text-[10px] font-heading uppercase rounded-lg h-7 px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">BC</ToggleGroupItem>
                </ToggleGroup>
              )}
              {!showToggle && (
                <Badge variant={swapPlayerPosition === "FC" ? "destructive" : "default"} className="text-[10px] rounded-lg">
                  {swapPlayerPosition} only
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="relative shrink-0 mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search player or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 rounded-lg"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mr-2 pr-2 mt-2">
            <div className="space-y-0">
              {available.map((p) => {
                const teamLogo = getTeamLogo(p.core.team);
                const teamFull = (teamCounts[p.core.team] || 0) >= 2;
                const overBudget = budgetAvailable != null && p.core.salary > budgetAvailable;
                const isDisabled = teamFull || overBudget;
                const seasonFp = (p.season as any)?.fp ?? 0;
                return (
                  <button
                    key={p.core.id}
                    onClick={() => { if (isDisabled) return; onSelect(p); if (!showCourtPreview) { onOpenChange(false); setSearch(""); setFcBcFilter("ALL"); } }}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-2 py-2 border-b transition-colors text-left group relative overflow-hidden ${
                      isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                    }`}
                    title={teamFull ? "Max 2 players per NBA team" : overBudget ? "Exceeds budget" : undefined}
                  >
                    {teamLogo && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07] group-hover:opacity-[0.18] transition-opacity duration-300">
                        <img src={teamLogo} alt="" className="w-14 h-14 transition-transform duration-300 group-hover:scale-125" />
                      </div>
                    )}
                    {p.core.photo ? (
                      <img src={p.core.photo} alt={p.core.name} className="w-9 h-9 rounded-full object-cover bg-muted relative z-10 transition-transform duration-200 group-hover:scale-110" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground relative z-10 transition-transform duration-200 group-hover:scale-110">
                        {p.core.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-heading font-semibold uppercase truncate">{p.core.name}</p>
                        <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 h-3.5 rounded-lg shrink-0">
                          {p.core.fc_bc}
                        </Badge>
                        {teamFull && (
                          <span className="text-[8px] text-destructive font-semibold shrink-0">MAX 2</span>
                        )}
                        {overBudget && !teamFull && (
                          <span className="text-[8px] text-destructive font-semibold shrink-0">OVER BUDGET</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold">{p.core.team}</span>
                    </div>
                    <div className="text-right relative z-10">
                      <p className="text-sm font-mono font-semibold">${p.core.salary}</p>
                      <p className="text-[10px] text-muted-foreground">FP: {Number(seasonFp).toFixed(1)}</p>
                    </div>
                  </button>
                );
              })}
              {available.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 font-body">No players found</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — landscape court preview */}
        {showCourtPreview && (
          <CourtPreviewPanel
            picks={picks}
            bankRemaining={bankRemaining ?? 0}
            onRemove={(id) => onRemovePick?.(id)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CourtPreviewPanel({
  picks,
  bankRemaining,
  onRemove,
}: {
  picks: PlayerListItem[];
  bankRemaining: number;
  onRemove: (id: number) => void;
}) {
  const fcs = picks.filter((p) => p.core.fc_bc === "FC").slice(0, 5);
  const bcs = picks.filter((p) => p.core.fc_bc === "BC").slice(0, 5);

  // Always render 5 FC slots top + 5 BC slots bottom — matches Starting 5 / TOTW
  const fcPositions = getRowPositions(5, "28%");
  const bcPositions = getRowPositions(5, "72%");

  const budgetClass =
    bankRemaining > 0 ? "text-emerald-500" : bankRemaining < 0 ? "text-destructive" : "text-foreground";

  return (
    <div className="flex flex-col min-h-0 p-3 bg-muted/40">
      {/* Counters */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px] uppercase tracking-wider font-heading mb-2 shrink-0">
        <span className="px-2 py-1 rounded-md bg-background/80 border text-center">
          Picked <span className="font-mono font-bold">{picks.length}/10</span>
        </span>
        <span className={`px-2 py-1 rounded-md bg-background/80 border text-center font-bold ${budgetClass}`}>
          ${bankRemaining.toFixed(1)}M
        </span>
        <span className="px-2 py-1 rounded-md bg-destructive/15 border border-destructive/30 text-center text-destructive">
          FC <span className="font-mono font-bold">{fcs.length}/5</span>
        </span>
        <span className="px-2 py-1 rounded-md bg-primary/15 border border-primary/30 text-center text-primary">
          BC <span className="font-mono font-bold">{bcs.length}/5</span>
        </span>
      </div>

      {/* Landscape court — same layout as Starting 5 / TOTW */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className="relative w-full rounded-lg overflow-hidden"
          style={{
            aspectRatio: "16/9",
            backgroundImage: `url(${courtBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span className="text-white/10 text-base font-heading font-bold uppercase tracking-[0.3em]">
              Your Squad
            </span>
          </div>

          {/* FC row (top) */}
          {fcPositions.map((pos, i) => (
            <CourtSlot
              key={`fc-${i}`}
              player={fcs[i] ?? null}
              position={pos}
              fallbackLabel="FC"
              onRemove={onRemove}
            />
          ))}

          {/* BC row (bottom) */}
          {bcPositions.map((pos, i) => (
            <CourtSlot
              key={`bc-${i}`}
              player={bcs[i] ?? null}
              position={pos}
              fallbackLabel="BC"
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CourtSlot({
  player,
  position,
  fallbackLabel,
  onRemove,
}: {
  player: PlayerListItem | null;
  position: { top: string; left: string };
  fallbackLabel: string;
  onRemove: (id: number) => void;
}) {
  const isFc = fallbackLabel === "FC";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
      style={{ top: position.top, left: position.left, width: "16%" }}
    >
      {!player ? (
        <>
          <div className="aspect-square w-full rounded-full bg-black/30 border border-dashed border-white/30 flex items-center justify-center">
            <span className="text-[8px] uppercase tracking-wider text-white/40">{fallbackLabel}</span>
          </div>
        </>
      ) : (
        <div className="relative w-full group">
          {player.core.photo ? (
            <img
              src={player.core.photo}
              alt={player.core.name}
              className="aspect-square w-full rounded-full object-cover bg-black/30 shadow-md transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="aspect-square w-full rounded-full bg-black/40 flex items-center justify-center text-[10px] font-heading font-bold text-white/80">
              {player.core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(player.core.id); }}
            aria-label={`Remove ${player.core.name}`}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow opacity-90 hover:opacity-100 hover:scale-110 transition-all z-20"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="mt-0.5 text-[9px] text-center text-white font-heading font-bold truncate drop-shadow leading-tight">
            {(() => {
              const parts = player.core.name.trim().split(/\s+/);
              return parts.length === 1 ? parts[0].toUpperCase() : `${parts[0][0]}.${parts[parts.length - 1]}`.toUpperCase();
            })()}
          </p>
          <div className="mt-0.5 flex items-center justify-center gap-1">
            <span className={`inline-flex items-center justify-center px-1 h-3 rounded text-[7px] font-heading font-bold ${isFc ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
              {player.core.fc_bc}
            </span>
            <span className="text-[8px] text-white font-mono font-bold drop-shadow">${player.core.salary}M</span>
          </div>
        </div>
      )}
    </div>
  );
}
