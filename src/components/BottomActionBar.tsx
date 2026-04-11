import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Calendar } from "lucide-react";

interface BottomActionBarProps {
  onSave: () => void;
  saving?: boolean;
  gamedaysRemaining: number;
}

export default function BottomActionBar({ onSave, saving, gamedaysRemaining }: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="flex h-14">
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
          <Badge className="bg-accent text-accent-foreground rounded-lg text-sm font-bold px-2.5 py-0.5">
            {gamedaysRemaining}
          </Badge>
        </div>
      </div>
    </div>
  );
}
