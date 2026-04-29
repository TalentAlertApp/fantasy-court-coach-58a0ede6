import { useMemo, useState } from "react";
import { Flame, Coins, Zap, Snowflake } from "lucide-react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaderColumn, LeaderRow } from "./LeaderTable";
import RotatingLeaderCard, { LeaderSubject } from "./RotatingLeaderCard";

type FcBcFilter = "ALL" | "FC" | "BC";

interface Props {
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
}

export default function TrendingTab({ onPlayerClick, onTeamClick }: Props) {
  const { data, isLoading } = usePlayersQuery({ limit: 1000 });
  const [fcBc, setFcBc] = useState<FcBcFilter>("ALL");
  const [minMp5, setMinMp5] = useState<number>(15);

  const items = useMemo(() => ((data as any)?.items ?? []) as any[], [data]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (fcBc !== "ALL" && p.core.fc_bc !== fcBc) return false;
      if (p.last5.mpg5 < minMp5) return false;
      return true;
    });
  }, [items, fcBc, minMp5]);

  const hotRows: LeaderRow[] = useMemo(() => {
    return filtered
      .map((p) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo,
        fc_bc: p.core.fc_bc,
        values: [p.last5.fp5, p.season.fp, p.computed.delta_fp, p.last5.mpg5],
        _sort: p.last5.fp5,
      }))
      .sort((a: any, b: any) => b._sort - a._sort);
  }, [filtered]);

  const valueRows: LeaderRow[] = useMemo(() => {
    return filtered
      .map((p) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo,
        fc_bc: p.core.fc_bc,
        values: [p.computed.value5, p.computed.value, p.core.salary, p.last5.fp5],
        _sort: p.computed.value5,
      }))
      .sort((a: any, b: any) => b._sort - a._sort);
  }, [filtered]);

  const stocksRows: LeaderRow[] = useMemo(() => {
    return filtered
      .map((p) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo,
        fc_bc: p.core.fc_bc,
        values: [p.computed.stocks5, p.computed.stocks, p.last5.stl5, p.last5.blk5],
        _sort: p.computed.stocks5,
      }))
      .sort((a: any, b: any) => b._sort - a._sort);
  }, [filtered]);

  const coldRows: LeaderRow[] = useMemo(() => {
    return filtered
      .map((p) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo,
        fc_bc: p.core.fc_bc,
        values: [p.computed.delta_fp, p.last5.fp5, p.season.fp, p.last5.mpg5],
        _sort: p.computed.delta_fp,
      }))
      .sort((a: any, b: any) => a._sort - b._sort); // ascending = most negative first
  }, [filtered]);

  const hotCols: LeaderColumn[] = [
    { key: "fp5", label: "FP5", align: "right", tone: "accent" },
    { key: "fp", label: "FP", align: "right" },
    { key: "d", label: "Δ", align: "right", tone: "delta" },
    { key: "mp5", label: "MP5", align: "right" },
  ];
  const valueCols: LeaderColumn[] = [
    { key: "v5", label: "V5", align: "right", tone: "accent" },
    { key: "v", label: "V", align: "right" },
    { key: "$", label: "$", align: "right" },
    { key: "fp5", label: "FP5", align: "right" },
  ];
  const stocksCols: LeaderColumn[] = [
    { key: "s5", label: "STK5", align: "right", tone: "accent" },
    { key: "s", label: "STK", align: "right" },
    { key: "stl", label: "STL5", align: "right" },
    { key: "blk", label: "BLK5", align: "right" },
  ];
  const coldCols: LeaderColumn[] = [
    { key: "d", label: "Δ FP", align: "right", tone: "delta" },
    { key: "fp5", label: "FP5", align: "right" },
    { key: "fp", label: "FP", align: "right", tone: "accent" },
    { key: "mp5", label: "MP5", align: "right" },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-lg" />)}
      </div>
    );
  }

  const subjects: LeaderSubject[] = [
    { id: "hot", title: "Hot Hands", subtitle: "FP5 leaders", icon: <Flame className="h-4 w-4 text-destructive" />, columns: hotCols, rows: hotRows, tone: "red" },
    { id: "value", title: "Value Kings", subtitle: "V5 leaders", icon: <Coins className="h-4 w-4 text-[hsl(var(--nba-yellow))]" />, columns: valueCols, rows: valueRows, tone: "yellow" },
    { id: "stocks", title: "Stocks Surge", subtitle: "STL5+BLK5", icon: <Zap className="h-4 w-4 text-emerald-500" />, columns: stocksCols, rows: stocksRows, tone: "green" },
    { id: "cold", title: "Cold Snap", subtitle: "Bounce-back watch", icon: <Snowflake className="h-4 w-4 text-blue-400" />, columns: coldCols, rows: coldRows, tone: "blue" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Filters:</span>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(["ALL", "FC", "BC"] as FcBcFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFcBc(f)}
              className={`px-2.5 py-1 text-[11px] font-heading font-bold transition-colors ${
                fcBc === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-heading uppercase tracking-wider">Min MP5</span>
          <input
            type="number"
            min={0}
            max={48}
            value={minMp5}
            onChange={(e) => setMinMp5(Math.max(0, Math.min(48, Number(e.target.value) || 0)))}
            className="w-14 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-mono"
          />
        </label>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} players · last 5 games</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RotatingLeaderCard subjects={subjects} initialIndex={0} onPlayerClick={onPlayerClick} onTeamClick={onTeamClick} />
        <RotatingLeaderCard subjects={subjects} initialIndex={1} onPlayerClick={onPlayerClick} onTeamClick={onTeamClick} />
      </div>
    </div>
  );
}