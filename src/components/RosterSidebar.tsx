import { Wallet, ArrowRightLeft, Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  bankRemaining, freeTransfers, fcStarters, bcStarters, totalSalary,
}: RosterSidebarProps) {
  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-nba-navy text-primary-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <span className="text-xs font-heading font-bold uppercase tracking-wider">Roster Info</span>
        </div>
        <div className="p-3 space-y-2.5">
          <InfoRow icon={<Wallet className="h-3.5 w-3.5" />} label="Bank Remaining" value={`$${bankRemaining.toFixed(1)}`} />
          <InfoRow icon={<ArrowRightLeft className="h-3.5 w-3.5" />} label="Free Transfers" value={String(freeTransfers)} />
          <div className="border-t pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground dark:text-white/70 font-heading uppercase text-[10px]">FC Starters</span>
              <Badge variant="destructive" className="rounded-lg text-[9px] px-1.5">{fcStarters}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground dark:text-white/70 font-heading uppercase text-[10px]">BC Starters</span>
              <Badge className="rounded-lg text-[9px] px-1.5">{bcStarters}</Badge>
            </div>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground dark:text-white/70 font-heading uppercase text-[10px]">
                <Users className="h-3 w-3 inline mr-1" />Total Salary
              </span>
              <span className="font-mono font-bold text-[11px] dark:text-white">${totalSalary.toFixed(1)}</span>
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
      <div className="flex items-center gap-1.5 text-muted-foreground dark:text-white/70">
        {icon}
        <span className="text-[10px] font-heading uppercase">{label}</span>
      </div>
      <span className="font-mono font-bold text-sm dark:text-white">{value}</span>
    </div>
  );
}
