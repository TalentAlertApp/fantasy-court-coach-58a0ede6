import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { Search } from "lucide-react";

interface Props {
  onSelect: (playerId: number) => void;
}

export default function SidebarPlayerSearch({ onSelect }: Props) {
  const [search, setSearch] = useState("");
  const enabled = search.trim().length >= 2;

  const { data } = useQuery({
    queryKey: ["sidebar-player-search", search.trim()],
    queryFn: () => fetchPlayers({ search: search.trim(), limit: 8 }),
    enabled,
    staleTime: 30_000,
  });

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50 pointer-events-none" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search player…"
        className="h-7 pl-7 text-xs rounded-lg bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-accent/40"
      />
      {enabled && data && (
        <div className="absolute z-50 mt-1 left-0 right-0 max-h-72 overflow-auto rounded-lg border border-border bg-popover shadow-xl p-1">
          {data.items.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">No players found.</div>
          ) : (
            data.items.map((p: any) => {
              const logo = getTeamLogo(p.core.team);
              return (
                <button
                  key={p.core.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.core.id);
                    setSearch("");
                  }}
                  className="group relative w-full overflow-hidden flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 cursor-pointer text-left"
                >
                  {logo && (
                    <img
                      src={logo}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute -top-1 -right-1 h-10 w-10 object-contain opacity-15 group-hover:opacity-30 rotate-12 transition-opacity select-none"
                    />
                  )}
                  {p.core.photo ? (
                    <img src={p.core.photo} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted" />
                  )}
                  <span className="text-xs font-medium relative z-10 truncate">{p.core.name}</span>
                  <Badge
                    variant={p.core.fc_bc === "FC" ? "destructive" : "default"}
                    className="text-[7px] px-1 py-0 rounded-lg relative z-10 ml-auto"
                  >
                    {p.core.fc_bc}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}