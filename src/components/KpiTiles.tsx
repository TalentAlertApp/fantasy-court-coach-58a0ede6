import { Card, CardContent } from "@/components/ui/card";

interface KpiTilesProps {
  gw: number;
  day: number;
  deadline: string | null;
  bankRemaining: number;
  freeTransfers: number;
}

export default function KpiTiles({ gw, day, deadline, bankRemaining, freeTransfers }: KpiTilesProps) {
  const tiles = [
    { label: "Gameweek", value: `GW ${gw}` },
    { label: "Day", value: `Day ${day}` },
    { label: "Deadline", value: deadline ? new Date(deadline).toLocaleDateString() : "—" },
    { label: "Bank", value: `$${bankRemaining.toFixed(1)}` },
    { label: "Free Transfers", value: String(freeTransfers) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {tiles.map(({ label, value }) => (
        <Card key={label} className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
