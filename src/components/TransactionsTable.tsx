import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p>Select players to add and drop to simulate a transaction</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simulation.errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          {simulation.errors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
        </div>
      )}
      {simulation.warnings.length > 0 && (
        <div className="bg-nba-yellow/10 border border-nba-yellow/30 rounded-lg p-3">
          {simulation.warnings.map((w, i) => <p key={i} className="text-sm">{w}</p>)}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-3"><CardTitle className="text-xs text-muted-foreground">Before</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-1 text-sm">
            <p>Bank: ${simulation.before.bank_remaining.toFixed(1)}</p>
            <p>FP5: {simulation.before.proj_fp5.toFixed(1)}</p>
            <p>Stocks5: {simulation.before.proj_stocks5.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3"><CardTitle className="text-xs text-muted-foreground">After</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-1 text-sm">
            <p>Bank: ${simulation.after.bank_remaining.toFixed(1)}</p>
            <p>FP5: {simulation.after.proj_fp5.toFixed(1)}</p>
            <p>Stocks5: {simulation.after.proj_stocks5.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3"><CardTitle className="text-xs text-muted-foreground">Delta</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-1 text-sm">
            <p className={simulation.delta.proj_fp5 >= 0 ? "text-green-600" : "text-destructive"}>
              FP5: {simulation.delta.proj_fp5 >= 0 ? "+" : ""}{simulation.delta.proj_fp5.toFixed(1)}
            </p>
            <p>Stocks5: {simulation.delta.proj_stocks5 >= 0 ? "+" : ""}{simulation.delta.proj_stocks5.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={simulation.is_valid ? "default" : "destructive"}>
          {simulation.is_valid ? "Valid" : "Invalid"}
        </Badge>
        <Button
          onClick={onCommit}
          disabled={!simulation.is_valid || committing}
          className="bg-nba-yellow text-foreground hover:bg-nba-yellow/90 font-bold"
        >
          {committing ? "Committing…" : "Commit Transaction"}
        </Button>
      </div>
    </div>
  );
}
