interface KpiTilesProps {
  gw: number;
  day: number;
  deadline: string | null;
  bankRemaining: number;
  freeTransfers: number;
}

export default function KpiTiles({ gw, day, deadline, bankRemaining, freeTransfers }: KpiTilesProps) {
  const tiles = [
    { label: "Gameweek", value: `GW ${gw}`, accent: false },
    { label: "Day", value: `Day ${day}`, accent: false },
    { label: "Deadline", value: deadline ? new Date(deadline).toLocaleDateString() : "—", accent: false },
    { label: "Bank", value: `$${bankRemaining.toFixed(1)}`, accent: bankRemaining > 0 },
    { label: "Free Transfers", value: String(freeTransfers), accent: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-border rounded-sm overflow-hidden">
      {tiles.map(({ label, value, accent }) => (
        <div key={label} className="bg-card border-r last:border-r-0 px-3 py-2.5 text-center">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`text-lg font-heading font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
