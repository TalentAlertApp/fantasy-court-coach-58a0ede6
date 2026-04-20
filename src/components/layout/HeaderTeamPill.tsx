import { useTeam } from "@/contexts/TeamContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

export default function HeaderTeamPill() {
  const { teams, selectedTeamId, setSelectedTeamId, isLoading } = useTeam();
  if (isLoading || teams.length === 0) return null;

  const activeName = teams.find((t) => t.id === selectedTeamId)?.name ?? "Select team";

  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-1 py-1 shadow-sm">
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
        Active Team
      </span>
      <Select value={selectedTeamId ?? ""} onValueChange={(v) => setSelectedTeamId(v)}>
        <SelectTrigger
          className="h-7 w-[180px] rounded-full border-0 bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider focus:ring-0 focus:ring-offset-0"
          aria-label={`Active team: ${activeName}`}
        >
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs font-heading uppercase">
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}