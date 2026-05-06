import { useLeague, type LeagueCode } from "@/contexts/LeagueContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LeagueSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { league, setLeague } = useLeague();
  return (
    <div className={`px-3 ${collapsed ? "py-1" : "py-2"}`}>
      <Select value={league} onValueChange={(v) => setLeague(v as LeagueCode)}>
        <SelectTrigger
          className="h-8 w-full bg-white/5 border-white/10 text-[11px] font-heading uppercase tracking-[0.18em]"
          aria-label="Select league"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nba">NBA 2025-26</SelectItem>
          <SelectItem value="wnba">WNBA 2026</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
