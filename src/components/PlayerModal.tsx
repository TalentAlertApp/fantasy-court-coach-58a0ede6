import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface PlayerModalProps {
  playerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlayerModal({ playerId, open, onOpenChange }: PlayerModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["player-detail", playerId],
    queryFn: () => fetchPlayerDetail(playerId!),
    enabled: open && playerId !== null,
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isLoading ? "Loading…" : data?.player?.core?.name ?? "Player"}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Core Info */}
            <div className="flex items-center gap-3">
              {data.player.core.photo ? (
                <img src={data.player.core.photo} alt="" className="w-16 h-16 rounded-full object-cover bg-muted" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                  {data.player.core.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold">{data.player.core.name}</p>
                <p className="text-sm text-muted-foreground">{data.player.core.team} · #{data.player.core.jersey} · {data.player.core.pos}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={data.player.core.fc_bc === "FC" ? "destructive" : "default"}>
                    {data.player.core.fc_bc}
                  </Badge>
                  <span className="text-sm font-mono">${data.player.core.salary}</span>
                </div>
              </div>
            </div>

            {/* Last Game FP Breakdown */}
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs uppercase text-muted-foreground font-medium mb-2">Last Game FP Breakdown</p>
              <div className="grid grid-cols-6 gap-2 text-center text-xs">
                {[
                  { label: "PTS", val: data.player.lastGame.pts, mult: 1 },
                  { label: "REB", val: data.player.lastGame.reb, mult: 1 },
                  { label: "AST", val: data.player.lastGame.ast, mult: 2 },
                  { label: "STL", val: data.player.lastGame.stl, mult: 3 },
                  { label: "BLK", val: data.player.lastGame.blk, mult: 3 },
                  { label: "FP", val: data.player.lastGame.fp, mult: 0 },
                ].map(({ label, val, mult }) => (
                  <div key={label}>
                    <p className="text-muted-foreground">{label}{mult > 1 ? ` ×${mult}` : ""}</p>
                    <p className="font-bold">{mult > 0 ? val * mult : val.toFixed(1)}</p>
                  </div>
                ))}
              </div>
            </div>

            <Tabs defaultValue="stats">
              <TabsList>
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>
              <TabsContent value="stats">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Season FP/G</p>
                    <p className="font-bold">{data.player.season.fp.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Last 5 FP/G</p>
                    <p className="font-bold">{data.player.last5.fp5.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Value (season)</p>
                    <p className="font-bold">{data.player.computed.value.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Value (L5)</p>
                    <p className="font-bold">{data.player.computed.value5.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Stocks (L5)</p>
                    <p className="font-bold">{data.player.computed.stocks5.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Δ FP</p>
                    <p className={`font-bold ${data.player.computed.delta_fp >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {data.player.computed.delta_fp >= 0 ? "+" : ""}{data.player.computed.delta_fp.toFixed(1)}
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="history">
                {data.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No history available</p>
                ) : (
                  <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                    {data.history.map((h, i) => (
                      <div key={i} className="flex justify-between py-1 border-b">
                        <span>{h.date} vs {h.opp}</span>
                        <span className="font-mono">{h.fp.toFixed(1)} FP</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="schedule">
                {data.upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No upcoming games</p>
                ) : (
                  <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                    {data.upcoming.map((g, i) => (
                      <div key={i} className="flex justify-between py-1 border-b">
                        <span>{g.away_team} @ {g.home_team}</span>
                        <span className="text-muted-foreground">{g.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
