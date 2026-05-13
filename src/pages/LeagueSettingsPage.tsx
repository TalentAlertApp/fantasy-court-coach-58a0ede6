import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useFantasyLeague } from "@/contexts/FantasyLeagueContext";

export default function LeagueSettingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { fantasyLeagues } = useFantasyLeague();
  const league = fantasyLeagues.find((l) => l.id === leagueId) ?? null;

  return (
    <div className="px-6 py-5 max-w-[900px] mx-auto space-y-5">
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to leagues
        </Link>
        <h1 className="text-2xl font-heading uppercase tracking-wider font-bold">
          {league?.name ?? "League"} · Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Editable rule sets coming next prompt.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">Settings placeholder.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/leagues">Return to Leagues</Link>
        </Button>
      </div>
    </div>
  );
}