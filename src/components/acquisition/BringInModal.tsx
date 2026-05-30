import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Target, Crosshair, Wallet, Repeat, Ban } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { cn } from "@/lib/utils";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import { useGameweekTransfers } from "@/hooks/useGameweekTransfers";
import { useLeagueDeadlines, getCurrentGamedayFrom } from "@/hooks/useLeagueDeadlines";
import { getCurrentGameday } from "@/lib/deadlines";
import {
  planAcquisition,
  routeToStageParams,
  type PlannerPlayer,
  type AcquisitionRoute,
} from "@/lib/acquisitionPlanner";

export interface BringInTarget {
  id: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC";
  salary: number;
  photo?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provide a fully-resolved target… */
  target?: BringInTarget | null;
  /** …or just an id, and the modal resolves it from the players pool. */
  targetPlayerId?: number | null;
}

function toPlanner(p: any): PlannerPlayer {
  return {
    id: p.core.id,
    name: p.core.name,
    team: p.core.team,
    fc_bc: p.core.fc_bc,
    salary: p.core.salary,
    photo: p.core.photo ?? null,
    value5: p.computed?.value5 ?? p.computed?.value ?? 0,
    fp5: p.last5?.fp5 ?? p.season?.fp ?? 0,
  };
}

function PlayerChip({ p, tone }: { p: PlannerPlayer; tone: "out" | "in" | "neutral" }) {
  const logo = getTeamLogo(p.team);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-heading",
        tone === "out" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "in" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "neutral" && "border-border bg-muted/40 text-foreground",
      )}
    >
      {logo && <img src={logo} alt="" className="h-3.5 w-3.5 object-contain" />}
      <span className="font-bold uppercase truncate max-w-[120px]">{p.name}</span>
      <span className="opacity-70">{p.fc_bc}</span>
      <span className="font-mono opacity-80">${p.salary}M</span>
    </span>
  );
}

export default function BringInModal({ open, onOpenChange, target: targetProp = null, targetPlayerId = null }: Props) {
  const navigate = useNavigate();
  const { selectedTeamId } = useTeam();
  const { data: rosterData } = useRosterQuery();
  const { data: playersData, isLoading } = usePlayersQuery({ sort: "salary", order: "asc", limit: 2000 });
  const { deadlines } = useLeagueDeadlines();
  const current = getCurrentGamedayFrom(deadlines) ?? getCurrentGameday();
  const { data: gwTx } = useGameweekTransfers(selectedTeamId, current.gw);

  const pool = playersData?.items ?? [];

  const target = useMemo<BringInTarget | null>(() => {
    if (targetProp) return targetProp;
    if (targetPlayerId == null) return null;
    const p = pool.find((x: any) => x.core?.id === targetPlayerId);
    if (!p) return null;
    return {
      id: p.core.id,
      name: p.core.name,
      team: p.core.team,
      fc_bc: p.core.fc_bc,
      salary: p.core.salary,
      photo: p.core.photo ?? null,
    };
  }, [targetProp, targetPlayerId, pool]);

  const plan = useMemo(() => {
    if (!target || !pool.length) return null;
    const byId = new Map<number, any>();
    for (const p of pool) byId.set(p.core.id, p);

    const r: any = (rosterData as any)?.roster ?? rosterData;
    const ids: number[] = [
      ...(Array.isArray(r?.starters) ? r.starters : []),
      ...(Array.isArray(r?.bench) ? r.bench : []),
    ].filter((id: number) => typeof id === "number" && id > 0);
    const roster: PlannerPlayer[] = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(toPlanner);

    const poolPlanner = pool.map(toPlanner);
    const enriched = byId.get(target.id);
    const targetPlanner: PlannerPlayer = enriched
      ? toPlanner(enriched)
      : { ...target, value5: 0, fp5: 0 };

    const bankRemaining: number = r?.bank_remaining ?? (rosterData as any)?.bank_remaining ?? 0;
    return planAcquisition(targetPlanner, {
      roster,
      pool: poolPlanner,
      bankRemaining,
      gwUsed: gwTx?.used ?? 0,
      gwCap: gwTx?.cap ?? 2,
    });
  }, [target, pool, rosterData, gwTx]);

  const stageRoute = (route: AcquisitionRoute) => {
    navigate(`/transactions?${routeToStageParams(route).toString()}`);
    onOpenChange(false);
  };

  const targetLogo = target ? getTeamLogo(target.team) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[120] max-w-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 font-heading uppercase tracking-wide text-sm">
            <Crosshair className="h-4 w-4 text-primary" />
            Bring In
          </DialogTitle>
        </DialogHeader>

        {/* Target header */}
        {target && (
          <div className="flex items-center gap-3 px-5 py-3 bg-muted/30">
            {target.photo ? (
              <img src={target.photo} alt="" className="h-12 w-12 rounded-full object-cover bg-muted" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold uppercase text-sm truncate">{target.name}</span>
                {targetLogo && <img src={targetLogo} alt="" className="h-4 w-4 object-contain" />}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {target.team} · {target.fc_bc} · <span className="font-mono">${target.salary}M</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {isLoading || !plan ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : plan.alreadyOwned ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
              {plan.target.name} is already on your roster.
            </div>
          ) : (
            plan.routes.map((route, i) => {
              const isRecommended = plan.recommended === route;
              const isWait = route.kind === "wait";
              return (
                <div
                  key={`${route.kind}-${i}`}
                  className={cn(
                    "rounded-xl border p-3.5",
                    isRecommended && "border-primary/50 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]",
                    !isRecommended && !isWait && "border-border bg-card",
                    isWait && "border-dashed border-border bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isWait ? <Ban className="h-3.5 w-3.5 text-muted-foreground" /> : <Repeat className="h-3.5 w-3.5 text-primary" />}
                      <span className="font-heading uppercase text-[11px] tracking-wide font-bold">{route.title}</span>
                      {isRecommended && (
                        <Badge className="h-5 rounded-md bg-primary text-primary-foreground text-[9px] uppercase">Recommended</Badge>
                      )}
                    </div>
                    {!isWait && (
                      <span className="text-[10px] text-muted-foreground font-heading uppercase">
                        {route.transfers} transfer{route.transfers === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>

                  {!isWait && (route.outs.length > 0 || route.ins.length > 0) && (
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      {route.outs.map((p) => <PlayerChip key={`o${p.id}`} p={p} tone="out" />)}
                      {route.outs.length > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      {route.ins.map((p) => (
                        <PlayerChip key={`i${p.id}`} p={p} tone={p.id === plan.target.id ? "in" : "neutral"} />
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground leading-snug">{route.detail}</p>

                  {!isWait && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Wallet className="h-3.5 w-3.5" />
                        Bank after: <span className={cn("font-mono font-bold", route.bankAfter < 0 ? "text-destructive" : "text-foreground")}>${route.bankAfter.toFixed(1)}M</span>
                      </span>
                      {route.feasible && (
                        <Button size="sm" className="h-8 rounded-lg font-heading uppercase text-[10px]" onClick={() => stageRoute(route)}>
                          Stage in Trade Center
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}