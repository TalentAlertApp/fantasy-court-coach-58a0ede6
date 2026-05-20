import { Wallet, ArrowRightLeft, Users, Shield, AlertTriangle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RosterSidebarProps {
  gw: number;
  day: number;
  teamId?: string;
  bankRemaining: number;
  freeTransfers: number;
  fcStarters: number;
  bcStarters: number;
  totalSalary: number;
  /** Sum of acquired (locked) salaries — what counts against the $100M cap. */
  lockedTotal?: number;
  /** Salary cap, default 100. */
  salaryCap?: number;
}

export default function RosterSidebar({
  bankRemaining, freeTransfers, fcStarters, bcStarters, totalSalary,
  lockedTotal, salaryCap = 100,
}: RosterSidebarProps) {
  // Locked roster cost — falls back to (cap − bank) so the row always renders
  // even if the parent hasn't wired locked_total through yet.
  const locked = lockedTotal ?? Math.max(0, salaryCap - bankRemaining);
  const bankColorClass =
    bankRemaining > 0
      ? "text-green-500 font-bold"
      : bankRemaining < 0
      ? "text-destructive font-bold"
      : "text-[hsl(var(--nba-yellow))] font-bold";
  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-3">
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-muted border-b flex items-center gap-2">
          <Shield className="h-4 w-4 text-[hsl(var(--nba-yellow))]" />
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">Roster Info</span>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground dark:text-white/70">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-[10px] font-heading uppercase">Bank Remaining</span>
            </div>
            <span className={`font-mono text-sm ${bankColorClass}`}>${bankRemaining.toFixed(1)}</span>
          </div>
          {bankRemaining < 0 && (
            <div className="flex items-start gap-1.5 text-destructive text-[10px] leading-tight">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Over budget — adjust roster to bring bank to 0 or higher</span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between cursor-help">
                <div className="flex items-center gap-1.5 text-muted-foreground dark:text-white/70">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-heading uppercase">Roster Cost (locked)</span>
                </div>
                <span className="font-mono font-bold text-sm dark:text-white">${locked.toFixed(1)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[220px] text-xs">
              Sum of each player's salary at the moment they joined your roster.
              This is what counts against the ${salaryCap}M cap. Daily market
              changes don't affect it — only trades do.
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground dark:text-white/70">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="text-[10px] font-heading uppercase">Free Transfers</span>
            </div>
            <span
              className={`font-mono text-sm font-bold ${
                freeTransfers <= 0
                  ? "text-destructive"
                  : freeTransfers === 1
                  ? "text-[hsl(var(--nba-yellow))]"
                  : "dark:text-white"
              }`}
            >
              {freeTransfers}
            </span>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground dark:text-white/70 font-heading uppercase text-[10px]">Starters</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="destructive" className="rounded-lg text-[9px] px-1.5">FC {fcStarters}</Badge>
                <Badge className="rounded-lg text-[9px] px-1.5">BC {bcStarters}</Badge>
              </div>
            </div>
          </div>
          <div className="border-t pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between text-xs cursor-help">
                  <span className="text-muted-foreground dark:text-white/70 font-heading uppercase text-[10px]">
                    <Users className="h-3 w-3 inline mr-1" />Market Value
                  </span>
                  <span className="font-mono font-bold text-[11px] dark:text-white">${totalSalary.toFixed(1)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[220px] text-xs">
                Current market value of your roster (sum of today's salaries).
                Informational only — the cap is enforced on the locked Roster Cost.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-muted-foreground dark:text-white/70">
        {icon}
        <span className="text-[10px] font-heading uppercase">{label}</span>
      </div>
      <span className="font-mono font-bold text-sm dark:text-white">{value}</span>
    </div>
  );
}
