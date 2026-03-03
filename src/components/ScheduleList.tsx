import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ScheduleGame = z.infer<typeof ScheduleGameSchema>;

interface ScheduleListProps {
  games: ScheduleGame[];
  gw: number;
  day: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function ScheduleList({ games, gw, day, onPrev, onNext }: ScheduleListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">GW {gw} · Day {day}</span>
        <Button variant="outline" size="sm" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      {games.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No games scheduled</p>
          <p className="text-sm">Try navigating to a different day</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {games.map((g) => (
            <Card key={g.game_id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-[80px]">
                    <p className="font-bold text-sm">{g.away_team}</p>
                    <p className="text-lg font-mono">{g.away_pts}</p>
                  </div>
                  <span className="text-muted-foreground text-xs">@</span>
                  <div className="min-w-[80px]">
                    <p className="font-bold text-sm">{g.home_team}</p>
                    <p className="text-lg font-mono">{g.home_pts}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={g.status === "FINAL" ? "secondary" : "outline"} className="text-xs">
                    {g.status}
                  </Badge>
                  {g.tipoff_utc && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(g.tipoff_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
