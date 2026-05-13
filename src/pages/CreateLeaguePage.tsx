import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CreateLeaguePage() {
  return (
    <div className="px-6 py-5 max-w-[900px] mx-auto space-y-5">
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to leagues
        </Link>
        <h1 className="text-2xl font-heading uppercase tracking-wider font-bold">Create League</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Multi-step wizard coming next. You'll be able to define scoring, roster, deadlines and chips.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">Wizard placeholder — built in the next prompt.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/leagues">Return to Leagues</Link>
        </Button>
      </div>
    </div>
  );
}