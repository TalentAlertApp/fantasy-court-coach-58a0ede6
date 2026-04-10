import { useState, useMemo } from "react";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlayers: PlayerListItem[];
  rosterIds: Set<number>;
  rosterTeams?: string[];
  onSelect: (player: PlayerListItem) => void;
  title?: string;
}

export default function PlayerPickerDialog({
  open, onOpenChange, allPlayers, rosterIds, rosterTeams = [], onSelect, title = "Pick a Player",
}: PlayerPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [fcBcFilter, setFcBcFilter] = useState<"ALL" | "FC" | "BC">("ALL");

  // Count how many roster players per NBA team
  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of rosterTeams) {
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [rosterTeams]);

  const available = useMemo(() => {
    let filtered = allPlayers.filter((p) => !rosterIds.has(p.core.id));
    if (fcBcFilter !== "ALL") {
      filtered = filtered.filter((p) => p.core.fc_bc === fcBcFilter);
    }
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((p) =>
      p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q)
    );
  }, [allPlayers, rosterIds, search, fcBcFilter]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(""); setFcBcFilter("ALL"); } }}>
      <DialogContent className="max-w-md h-[min(80vh,42rem)] flex flex-col rounded-sm overflow-hidden">
        <DialogHeader className="pr-10">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-heading">{title}</DialogTitle>
            <ToggleGroup type="single" value={fcBcFilter} onValueChange={(v) => v && setFcBcFilter(v as "ALL" | "FC" | "BC")}>
              <ToggleGroupItem value="ALL" className="text-[10px] font-heading uppercase rounded-sm h-7 px-2">All</ToggleGroupItem>
              <ToggleGroupItem value="FC" className="text-[10px] font-heading uppercase rounded-sm h-7 px-2">FC</ToggleGroupItem>
              <ToggleGroupItem value="BC" className="text-[10px] font-heading uppercase rounded-sm h-7 px-2">BC</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search player or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 rounded-sm"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mr-2 pr-2">
          <div className="space-y-0">
            {available.map((p) => {
              const teamLogo = getTeamLogo(p.core.team);
              const teamFull = (teamCounts[p.core.team] || 0) >= 2;
              return (
                <button
                  key={p.core.id}
                  onClick={() => { if (teamFull) return; onSelect(p); onOpenChange(false); setSearch(""); setFcBcFilter("ALL"); }}
                  disabled={teamFull}
                  className={`w-full flex items-center gap-3 px-2 py-2 border-b transition-colors text-left group relative overflow-hidden ${
                    teamFull ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                  }`}
                  title={teamFull ? "Max 2 players per NBA team" : undefined}
                >
                  {/* Team watermark */}
                  {teamLogo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07] group-hover:opacity-[0.18] transition-opacity duration-300">
                      <img src={teamLogo} alt="" className="w-14 h-14 transition-transform duration-300 group-hover:scale-125" />
                    </div>
                  )}
                  {/* Player photo */}
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
                      <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 h-3.5 rounded-sm shrink-0">
                        {p.core.fc_bc}
                      </Badge>
                      {teamFull && (
                        <span className="text-[8px] text-destructive font-semibold shrink-0">MAX 2</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">{p.core.team}</span>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-sm font-mono font-semibold">${p.core.salary}</p>
                    <p className="text-[10px] text-muted-foreground">FP5: {p.last5.fp5.toFixed(1)}</p>
                  </div>
                </button>
              );
            })}
            {available.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 font-body">No players found</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
