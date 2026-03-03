import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SimulationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  before: { salary_used: number; bank_remaining: number; proj_fp5: number; proj_stocks5: number };
  after: { salary_used: number; bank_remaining: number; proj_fp5: number; proj_stocks5: number };
  delta: { proj_fp5: number; proj_stocks5: number; proj_ast5: number };
}

interface TransactionsTableProps {
  simulation: SimulationResult | null;
  onCommit: () => void;
  committing?: boolean;
}

export default function TransactionsTable({ simulation, onCommit, committing }: TransactionsTableProps) {
  if (!simulation) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="font-body">Select players to add and drop to simulate a transaction</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simulation.errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-3">
          {simulation.errors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
        </div>
      )}
      {simulation.warnings.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-sm p-3">
          {simulation.warnings.map((w, i) => <p key={i} className="text-sm">{w}</p>)}
        </div>
      )}
      <div className="grid grid-cols-3 gap-0 border rounded-sm overflow-hidden">
        {[
          { title: "Before", data: simulation.before },
          { title: "After", data: simulation.after },
          { title: "Delta", isDelta: true },
        ].map(({ title, data, isDelta }) => (
          <div key={title} className="bg-card border-r last:border-r-0 p-3">
            <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2">{title}</p>
            {isDelta ? (
              <div className="space-y-1 text-sm font-mono">
                <p className={simulation.delta.proj_fp5 >= 0 ? "text-green-600" : "text-destructive"}>
                  FP5: {simulation.delta.proj_fp5 >= 0 ? "+" : ""}{simulation.delta.proj_fp5.toFixed(1)}
                </p>
                <p>Stocks5: {simulation.delta.proj_stocks5 >= 0 ? "+" : ""}{simulation.delta.proj_stocks5.toFixed(1)}</p>
              </div>
            ) : data ? (
              <div className="space-y-1 text-sm font-mono">
                <p>Bank: ${data.bank_remaining.toFixed(1)}</p>
                <p>FP5: {data.proj_fp5.toFixed(1)}</p>
                <p>Stocks5: {data.proj_stocks5.toFixed(1)}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={simulation.is_valid ? "default" : "destructive"} className="rounded-sm font-heading">
          {simulation.is_valid ? "Valid" : "Invalid"}
        </Badge>
        <Button onClick={onCommit} disabled={!simulation.is_valid || committing}>
          {committing ? "Committing…" : "Commit Transaction"}
        </Button>
      </div>
    </div>
  );
}
