import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface BottomActionBarProps {
  starters: PlayerListItem[];
  captainId: number;
  onCaptainChange: (id: number) => void;
  onSave: () => void;
  saving?: boolean;
}

export default function BottomActionBar({ starters, captainId, onCaptainChange, onSave, saving }: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Captain:</span>
          <Select value={String(captainId)} onValueChange={(v) => onCaptainChange(Number(v))}>
            <SelectTrigger className="w-[200px]">
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
        <Button onClick={onSave} disabled={saving} className="bg-nba-yellow text-foreground hover:bg-nba-yellow/90 font-bold">
          {saving ? "Saving…" : "💾 Save Lineup"}
        </Button>
      </div>
    </div>
  );
}
