import { useState, useMemo } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerModal from "@/components/PlayerModal";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

export default function PlayersPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [perfMode, setPerfMode] = useState<"pg" | "total">("pg");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("fp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: playersData, isLoading } = usePlayersQuery({ sort: "fp5", order: "desc", limit: 500 });

  const perfFiltered = useMemo(() => {
    let items = (playersData?.items ?? []).filter((p) => p.season.gp > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.core.name.toLowerCase().includes(q) || p.core.team.toLowerCase().includes(q)
      );
    }
    // Sort
    items.sort((a, b) => {
      const getVal = (p: PlayerListItem): number => {
        const gp = p.season.gp || 1;
        const s = p.season as any;
        if (sortCol === "gp") return p.season.gp;
        if (sortCol === "salary") return p.core.salary;
        if (perfMode === "total") {
          const tk = `total_${sortCol}`;
          return s[tk] ?? 0;
        } else {
          const tk = `total_${sortCol}`;
          return s[tk] !== undefined ? s[tk] / gp : 0;
        }
      };
      const av = getVal(a), bv = getVal(b);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return items;
  }, [playersData, search, sortCol, sortDir, perfMode]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const columns = [
    { key: "pts", label: "PTS" },
    { key: "mp", label: "MP" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "stl", label: "STL" },
    { key: "blk", label: "BLK" },
    { key: "fp", label: "FP" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-heading font-bold">Players</h2>
        <ToggleGroup type="single" value={perfMode} onValueChange={(v) => v && setPerfMode(v as "pg" | "total")}>
          <ToggleGroupItem value="pg" className="font-heading text-xs uppercase rounded-sm h-8">Per Game</ToggleGroupItem>
          <ToggleGroupItem value="total" className="font-heading text-xs uppercase rounded-sm h-8">Totals</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative ml-auto w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search player or team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 rounded-sm h-9 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">{perfFiltered.length} players</span>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Player</TableHead>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead
                className={`text-xs text-right cursor-pointer select-none ${sortCol === "gp" ? "font-bold" : ""}`}
                onClick={() => handleSort("gp")}
              >GP</TableHead>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={`text-xs text-right cursor-pointer select-none ${sortCol === c.key ? "font-bold" : ""}`}
                  onClick={() => handleSort(c.key)}
                >{c.label}</TableHead>
              ))}
              <TableHead
                className={`text-xs text-right cursor-pointer select-none ${sortCol === "salary" ? "font-bold" : ""}`}
                onClick={() => handleSort("salary")}
              >$</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfFiltered.slice(0, 200).map((p) => {
              const gp = p.season.gp || 1;
              const s = p.season as any;
              const fmtPg = (key: string) => {
                const tk = `total_${key}`;
                return s[tk] !== undefined ? (s[tk] / gp).toFixed(1) : "0.0";
              };
              const fmtTot = (key: string) => {
                const tk = `total_${key}`;
                return s[tk] !== undefined ? Math.round(s[tk]).toString() : "0";
              };
              const teamLogo = getTeamLogo(p.core.team);
              return (
                <TableRow key={p.core.id} className="cursor-pointer hover:bg-accent/30" onClick={() => setSelectedPlayerId(p.core.id)}>
                  <td className="px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5 shrink-0">
                        {p.core.photo && <AvatarImage src={p.core.photo} />}
                        <AvatarFallback className="text-[8px]">{p.core.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{p.core.name}</span>
                      <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-sm">{p.core.fc_bc}</Badge>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-1">
                      {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                      <span>{p.core.team}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono">{gp}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-2 py-1.5 text-xs text-right font-mono ${c.key === "pts" || c.key === "fp" ? "font-bold" : ""}`}>
                      {perfMode === "total" ? fmtTot(c.key) : fmtPg(c.key)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-xs text-right font-mono">${p.core.salary}</td>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />
    </div>
  );
}
