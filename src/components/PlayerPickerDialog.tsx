import { useState, useMemo } from "react";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPlayers: PlayerListItem[];
  rosterIds: Set<number>;
  onSelect: (player: PlayerListItem) => void;
  title?: string;
}

export default function PlayerPickerDialog({
  open, onOpenChange, allPlayers, rosterIds, onSelect, title = "Pick a Player",
}: PlayerPickerDialogProps) {
  const [search, setSearch] = useState("");

  const available = useMemo(() => {
    const filtered = allPlayers.filter((p) => !rosterIds.has(p.core.id));
    if (!search.trim()) return filtered.slice(0, 60);
    const q = search.toLowerCase();
    return filtered.filter((p) =>
      p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [allPlayers, rosterIds, search]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSearch(""); }}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col rounded-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">{title}</DialogTitle>
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
        <ScrollArea className="flex-1 min-h-0 max-h-[55vh]">
          <div className="space-y-0">
            {available.map((p) => (
              <button
                key={p.core.id}
                onClick={() => { onSelect(p); onOpenChange(false); setSearch(""); }}
                className="w-full flex items-center gap-3 px-2 py-2 border-b hover:bg-muted transition-colors text-left group"
              >
                {p.core.photo ? (
                  <img src={p.core.photo} alt={p.core.name} className="w-9 h-9 rounded-sm object-cover bg-muted" />
                ) : (
                  <div className="w-9 h-9 rounded-sm bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground">
                    {p.core.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-heading font-semibold uppercase truncate">{p.core.name}</p>
                  <div className="flex items-center gap-1.5">
                     {getTeamLogo(p.core.team) && (
                       <img src={getTeamLogo(p.core.team)} alt={p.core.team} className="w-4 h-4 flex-shrink-0 opacity-60" />
                     )}
                     <span className="text-[10px] text-muted-foreground font-semibold">{p.core.team}</span>
                    <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[8px] px-1 py-0 h-3.5 rounded-sm">
                      {p.core.fc_bc}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold">${p.core.salary}</p>
                  <p className="text-[10px] text-muted-foreground">FP5: {p.last5.fp5.toFixed(1)}</p>
                </div>
              </button>
            ))}
            {available.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 font-body">No players found</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
