import { useMemo, useState } from "react";
import { Crosshair, Hand, Activity } from "lucide-react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { Skeleton } from "@/components/ui/skeleton";
import LeaderTable, { LeaderColumn, LeaderRow } from "./LeaderTable";

type FcBcFilter = "ALL" | "FC" | "BC";

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  // values arrive as 0-1 or 0-100; normalize to percentage
  const n = v > 1 ? v : v * 100;
  return n.toFixed(1) + "%";
}

/** True Shooting % approximation. */
function tsPct(pts: number, fga: number, fta: number): number | null {
  const denom = 2 * (fga + 0.44 * fta);
  if (denom <= 0) return null;
  return (pts / denom) * 100;
}

interface Props {
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
}

export default function AdvancedStatsTab({ onPlayerClick, onTeamClick }: Props) {
  const { data, isLoading } = usePlayersQuery({ limit: 1000 });
  const [fcBc, setFcBc] = useState<FcBcFilter>("ALL");
  const [minGp, setMinGp] = useState<number>(20);

  const items = useMemo(() => ((data as any)?.items ?? []) as any[], [data]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (fcBc !== "ALL" && p.core.fc_bc !== fcBc) return false;
      if (p.season.gp < minGp) return false;
      return true;
    });
  }, [items, fcBc, minGp]);

  const shootingRows: LeaderRow[] = useMemo(() => {
    return filtered
      .filter((p) => p.advanced && p.advanced.fg_pct != null)
      .map((p) => {
        const ts = tsPct(p.season.pts * p.season.gp, p.advanced?.fga ?? 0, p.advanced?.fta ?? 0);
        return {
          id: p.core.id,
          name: p.core.name,
          team: p.core.team,
          photo: p.core.photo,
          fc_bc: p.core.fc_bc,
          values: [
            pct(p.advanced.fg_pct),
            pct(p.advanced.tp_pct),
            pct(p.advanced.ft_pct),
            ts == null ? "—" : ts.toFixed(1) + "%",
          ],
          _sort: p.advanced.fg_pct ?? 0,
        };
      })
      .sort((a: any, b: any) => b._sort - a._sort);
  }, [filtered]);

  const glassRows: LeaderRow[] = useMemo(() => {
    return filtered
      .filter((p) => p.advanced && (p.advanced.oreb != null || p.advanced.dreb != null))
      .map((p) => {
        const o = p.advanced?.oreb ?? 0;
        const d = p.advanced?.dreb ?? 0;
        const total = o + d;
        const stocksPg = p.season.stl + p.season.blk;
        return {
          id: p.core.id,
          name: p.core.name,
          team: p.core.team,
          photo: p.core.photo,
          fc_bc: p.core.fc_bc,
          values: [o, d, total, stocksPg, p.advanced?.tov ?? 0],
          _sort: total,
        };
      })
      .sort((a: any, b: any) => b._sort - a._sort);
  }, [filtered]);

  const impactRows: LeaderRow[] = useMemo(() => {
    return filtered
      .filter((p) => p.advanced && p.advanced.plus_minus != null)
      .map((p) => ({
        id: p.core.id,
        name: p.core.name,
        team: p.core.team,
        photo: p.core.photo,
        fc_bc: p.core.fc_bc,
        values: [
          p.advanced.plus_minus as number,
          p.season.fp,
          p.computed.value,
          p.season.mpg,
        ],
        _sort: p.advanced.plus_minus as number,
      }))
      .sort((a: any, b: any) => b._sort - a._sort);
  }, [filtered]);

  const shootingCols: LeaderColumn[] = [
    { key: "fg", label: "FG%", align: "right" },
    { key: "3p", label: "3P%", align: "right" },
    { key: "ft", label: "FT%", align: "right" },
    { key: "ts", label: "TS%", align: "right", tone: "accent" },
  ];
  const glassCols: LeaderColumn[] = [
    { key: "o", label: "OREB", align: "right" },
    { key: "d", label: "DREB", align: "right" },
    { key: "t", label: "TOT", align: "right", tone: "accent" },
    { key: "s", label: "STK/G", align: "right" },
    { key: "tov", label: "TOV", align: "right" },
  ];
  const impactCols: LeaderColumn[] = [
    { key: "pm", label: "+/-", align: "right", tone: "delta" },
    { key: "fp", label: "FP", align: "right" },
    { key: "v", label: "V", align: "right", tone: "accent" },
    { key: "mp", label: "MP", align: "right" },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 rounded-lg" />)}
      </div>
    );
  }

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
          <span className="font-heading uppercase tracking-wider">Min GP</span>
          <input
            type="number"
            min={0}
            max={82}
            value={minGp}
            onChange={(e) => setMinGp(Math.max(0, Math.min(82, Number(e.target.value) || 0)))}
            className="w-14 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-mono"
          />
        </label>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} players match</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <LeaderTable
          title="Shooting Splits"
          subtitle="Sorted by FG%"
          icon={<Crosshair className="h-4 w-4 text-primary" />}
          rows={shootingRows}
          columns={shootingCols}
          onPlayerClick={onPlayerClick}
          onTeamClick={onTeamClick}
        />
        <LeaderTable
          title="Glass & Hustle"
          subtitle="Sorted by Total REB"
          icon={<Hand className="h-4 w-4 text-emerald-500" />}
          rows={glassRows}
          columns={glassCols}
          onPlayerClick={onPlayerClick}
          onTeamClick={onTeamClick}
        />
        <LeaderTable
          title="Impact"
          subtitle="Sorted by +/-"
          icon={<Activity className="h-4 w-4 text-[hsl(var(--nba-yellow))]" />}
          rows={impactRows}
          columns={impactCols}
          onPlayerClick={onPlayerClick}
          onTeamClick={onTeamClick}
        />
      </div>
    </div>
  );
}