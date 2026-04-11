import { cn } from "@/lib/utils";

export type StandingsView = "league" | "conference" | "division";

interface Props {
  view: StandingsView;
  onChange: (v: StandingsView) => void;
}

const VIEWS: { value: StandingsView; label: string }[] = [
  { value: "league", label: "League" },
  { value: "conference", label: "Conference" },
  { value: "division", label: "Division" },
];

export default function StandingsFilters({ view, onChange }: Props) {
  return (
    <div className="inline-flex bg-muted rounded-sm p-0.5 gap-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          onClick={() => onChange(v.value)}
          className={cn(
            "px-3 py-1 text-xs font-heading uppercase rounded-sm transition-colors",
            view === v.value
              ? "bg-background text-foreground shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
