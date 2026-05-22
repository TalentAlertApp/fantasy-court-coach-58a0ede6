import { useTeam } from "@/contexts/TeamContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import LeagueLogoBadge from "@/components/LeagueLogoBadge";

export default function HeaderTeamPill() {
  const { teams, selectedTeamId, setSelectedTeamId, isLoading } = useTeam();
  if (isLoading || teams.length === 0) return null;

  const active = teams.find((t) => t.id === selectedTeamId) as any;
  const activeName = active?.name ?? "Select team";
  const activeLeague = (active?.league_code ?? "nba") as "nba" | "wnba" | "euroleague";

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
          {teams.map((t: any) => (
            <SelectItem key={t.id} value={t.id} className="text-xs font-heading uppercase">
              <span className="flex items-center gap-1.5">
                {t.name}
                <LeagueLogoBadge league={t.league_code ?? "nba"} size="xs" />
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTeamId && (
        <span className="mr-1">
          <LeagueLogoBadge league={activeLeague} size="sm" />
        </span>
      )}
    </div>
  );
}