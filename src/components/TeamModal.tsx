import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getTeamByTricode, getTeamLogo } from "@/lib/nba-teams";

interface TeamModalProps {
  tricode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TeamModal({ tricode, open, onOpenChange }: TeamModalProps) {
  const team = tricode ? getTeamByTricode(tricode) : null;

  // Games played + upcoming
  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["team-games", tricode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("*")
        .or(`home_team.eq.${tricode},away_team.eq.${tricode}`)
        .order("tipoff_utc", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!tricode,
    staleTime: 60_000,
  });

  // Players who played for this team
  const { data: playersData, isLoading: playersLoading } = useQuery({
    queryKey: ["team-players", tricode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, photo, team, fc_bc, mpg, fp_pg_t, gp, salary")
        .eq("team", tricode!)
        .order("fp_pg_t", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!tricode,
    staleTime: 60_000,
  });

  const played = useMemo(() => (gamesData ?? []).filter(g => g.status?.toUpperCase().includes("FINAL")), [gamesData]);
  const upcoming = useMemo(() => (gamesData ?? []).filter(g => !g.status?.toUpperCase().includes("FINAL")).reverse(), [gamesData]);

  if (!open || !tricode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-sm max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {team && <img src={team.logo} alt={team.name} className="w-10 h-10" />}
            <DialogTitle className="font-heading uppercase">{team?.name ?? tricode}</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs defaultValue="played" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="rounded-sm shrink-0">
            <TabsTrigger value="played" className="font-heading text-xs uppercase rounded-sm">Played ({played.length})</TabsTrigger>
            <TabsTrigger value="upcoming" className="font-heading text-xs uppercase rounded-sm">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="roster" className="font-heading text-xs uppercase rounded-sm">Roster ({playersData?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="played" className="flex-1 min-h-0 overflow-hidden">
            {gamesLoading ? <Skeleton className="h-40" /> : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-1">
                  {played.map((g) => {
                    const isHome = g.home_team === tricode;
                    const opp = isHome ? g.away_team : g.home_team;
                    const oppLogo = getTeamLogo(opp);
                    const won = isHome ? g.home_pts > g.away_pts : g.away_pts > g.home_pts;
                    return (
                      <div key={g.game_id} className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm">
                        <Badge variant={won ? "default" : "destructive"} className="rounded-sm text-[9px] w-5 justify-center">{won ? "W" : "L"}</Badge>
                        {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4" />}
                        <span className="font-heading text-xs uppercase">{isHome ? "vs" : "@"} {opp}</span>
                        <span className="ml-auto font-mono text-xs font-bold">
                          {isHome ? g.home_pts : g.away_pts}-{isHome ? g.away_pts : g.home_pts}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">GW{g.gw}.{g.day}</span>
                        {g.game_boxscore_url && (
                          <a href={g.game_boxscore_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            Box
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="flex-1 min-h-0 overflow-hidden">
            {gamesLoading ? <Skeleton className="h-40" /> : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-1">
                  {upcoming.map((g) => {
                    const isHome = g.home_team === tricode;
                    const opp = isHome ? g.away_team : g.home_team;
                    const oppLogo = getTeamLogo(opp);
                    const tipoff = g.tipoff_utc ? new Date(g.tipoff_utc).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "TBD";
                    return (
                      <div key={g.game_id} className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm">
                        {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4" />}
                        <span className="font-heading text-xs uppercase">{isHome ? "vs" : "@"} {opp}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{tipoff}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">GW{g.gw}.{g.day}</span>
                      </div>
                    );
                  })}
                  {upcoming.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No upcoming games</p>}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="roster" className="flex-1 min-h-0 overflow-hidden">
            {playersLoading ? <Skeleton className="h-40" /> : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-1">
                  {(playersData ?? []).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm">
                      <Avatar className="h-6 w-6 shrink-0">
                        {p.photo && <AvatarImage src={p.photo} />}
                        <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-sm">{p.fc_bc}</Badge>
                      <span className="text-xs font-medium">{p.name}</span>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{p.mpg?.toFixed(1)} MPG</span>
                      <span className="text-xs font-mono font-bold">{p.fp_pg_t?.toFixed(1)} FP</span>
                      <span className="text-[10px] text-muted-foreground">${p.salary}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
