import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Play, Star, Calendar } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface BottomActionBarProps {
  starters: PlayerListItem[];
  captainId: number;
  onCaptainChange: (id: number) => void;
  onSave: () => void;
  saving?: boolean;
  gamedaysRemaining: number;
}

export default function BottomActionBar({ starters, captainId, onCaptainChange, onSave, saving, gamedaysRemaining }: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="flex h-14">
        {/* Left — Captain (red) */}
        <div className="flex-1 bg-destructive flex items-center gap-2 px-4">
          <Star className="h-4 w-4 text-destructive-foreground" />
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-destructive-foreground hidden sm:inline">
            Gameday Captain
          </span>
          <Select value={String(captainId)} onValueChange={(v) => onCaptainChange(Number(v))}>
            <SelectTrigger className="w-[160px] h-8 bg-destructive-foreground/10 border-destructive-foreground/30 text-destructive-foreground text-xs rounded-sm font-heading">
              <SelectValue placeholder="Select captain" />
            </SelectTrigger>
            <SelectContent>
              {starters.map((p) => (
                <SelectItem key={p.core.id} value={String(p.core.id)}>
                  {p.core.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Center — Play (yellow) */}
        <Button
          onClick={onSave}
          disabled={saving}
          className="h-14 px-8 rounded-none bg-accent text-accent-foreground hover:bg-accent/90 font-heading text-sm uppercase font-bold tracking-wider"
        >
          <Play className="h-5 w-5 mr-1.5 fill-current" />
          {saving ? "Saving…" : "Play"}
        </Button>

        {/* Right — Gamedays remaining (navy) */}
        <div className="flex-1 bg-nba-navy flex items-center justify-end gap-2 px-4">
          <Calendar className="h-4 w-4 text-primary-foreground/70" />
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-primary-foreground/70 hidden sm:inline">
            Gamedays Remaining
          </span>
          <Badge className="bg-accent text-accent-foreground rounded-sm text-sm font-bold px-2.5 py-0.5">
            {gamedaysRemaining}
          </Badge>
        </div>
      </div>
    </div>
  );
}
