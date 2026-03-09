import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Star, ArrowLeftRight, Loader2, ChevronDown, ChevronUp, Wallet, ArrowRightLeft, Users, Shield } from "lucide-react";
import { aiSuggestTransfers, aiPickCaptain } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface RosterSidebarProps {
  gw: number;
  day: number;
  teamId?: string;
  bankRemaining: number;
  freeTransfers: number;
  fcStarters: number;
  bcStarters: number;
  totalSalary: number;
}

export default function RosterSidebar({
  gw, day, teamId, bankRemaining, freeTransfers, fcStarters, bcStarters, totalSalary,
}: RosterSidebarProps) {
  const { toast } = useToast();
  const [aiOpen, setAiOpen] = useState(true);
  const [captainLoading, setCaptainLoading] = useState(false);
  const [captainResult, setCaptainResult] = useState<any>(null);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersResult, setTransfersResult] = useState<any>(null);

  const handleCaptain = async () => {
    setCaptainLoading(true);
    setCaptainResult(null);
    try {
      const res = await aiPickCaptain({ gw, day }, teamId);
      setCaptainResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCaptainLoading(false);
    }
  };

  const handleTransfers = async () => {
    setTransfersLoading(true);
    setTransfersResult(null);
    try {
      const res = await aiSuggestTransfers(
        { gw, day, max_cost: bankRemaining, objective: "maximize_fp5" },
        teamId
      );
      setTransfersResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTransfersLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* AI COACH */}
      <div className="bg-card border rounded-sm overflow-hidden">
        <button
          onClick={() => setAiOpen(!aiOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-nba-navy text-primary-foreground"
        >
          <Bot className="h-4 w-4 text-accent" />
          <span className="text-xs font-heading font-bold uppercase tracking-wider flex-1 text-left">AI Coach</span>
          {aiOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {aiOpen && (
          <div className="p-3 space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start text-xs font-heading uppercase rounded-sm"
              onClick={handleTransfers}
              disabled={transfersLoading}
            >
              {transfersLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5 mr-2" />}
              Suggest 3 Moves
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start text-xs font-heading uppercase rounded-sm"
              onClick={handleCaptain}
              disabled={captainLoading}
            >
              {captainLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Star className="h-3.5 w-3.5 mr-2" />}
              Best Captain Today
            </Button>

            {captainLoading && <Skeleton className="h-12 w-full" />}
            {captainResult && (
              <div className="bg-muted rounded-sm p-2 text-xs space-y-1">
                <p className="font-heading font-bold uppercase text-[11px]">
                  ⭐ Captain: #{captainResult.captain_id}
                </p>
                <Badge variant="outline" className="text-[9px] rounded-sm">
                  {Math.round(captainResult.confidence * 100)}% confidence
                </Badge>
                <ul className="list-disc pl-3 text-[10px] text-muted-foreground">
                  {captainResult.reason_bullets?.slice(0, 2).map((b: string, i: number) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {transfersLoading && <Skeleton className="h-16 w-full" />}
            {transfersResult && (
              <div className="space-y-1.5">
                {transfersResult.moves?.slice(0, 3).map((m: any, i: number) => (
                  <div key={i} className="bg-muted rounded-sm p-2 text-[10px] space-y-0.5">
                    <div className="flex gap-1 flex-wrap">
                      <Badge className="bg-green-600 text-primary-foreground rounded-sm text-[8px] px-1">+{m.add}</Badge>
                      <Badge variant="destructive" className="rounded-sm text-[8px] px-1">-{m.drop}</Badge>
                    </div>
                    <p className="text-muted-foreground">{m.reason_bullets?.[0]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ROSTER INFO */}
      <div className="bg-card border rounded-sm overflow-hidden">
        <div className="px-3 py-2 bg-nba-navy text-primary-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <span className="text-xs font-heading font-bold uppercase tracking-wider">Roster Info</span>
        </div>
        <div className="p-3 space-y-2.5">
          <InfoRow icon={<Wallet className="h-3.5 w-3.5" />} label="Bank Remaining" value={`$${bankRemaining.toFixed(1)}`} />
          <InfoRow icon={<ArrowRightLeft className="h-3.5 w-3.5" />} label="Free Transfers" value={String(freeTransfers)} />
          <div className="border-t pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-heading uppercase text-[10px]">FC Starters</span>
              <Badge variant="destructive" className="rounded-sm text-[9px] px-1.5">{fcStarters}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-heading uppercase text-[10px]">BC Starters</span>
              <Badge className="rounded-sm text-[9px] px-1.5">{bcStarters}</Badge>
            </div>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-heading uppercase text-[10px]">
                <Users className="h-3 w-3 inline mr-1" />Total Salary
              </span>
              <span className="font-mono font-semibold text-[11px]">${totalSalary.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-heading uppercase">{label}</span>
      </div>
      <span className="font-mono font-bold text-sm">{value}</span>
    </div>
  );
}
