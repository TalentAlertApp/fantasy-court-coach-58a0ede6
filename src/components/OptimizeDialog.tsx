import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptimizerResult } from "@/lib/optimizer";
import { useLeague } from "@/contexts/LeagueContext";
import { HealthStatusIcon } from "@/components/health";

interface OptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: OptimizerResult | null;
  onApply: () => void;
  applying?: boolean;
}

export default function OptimizeDialog({ open, onOpenChange, result, onApply, applying }: OptimizeDialogProps) {
  const { isWnba } = useLeague();
  const noProjections = !!result && result.swaps.length === 0 &&
    Math.abs(result.totalDeltaFp5 ?? 0) < 0.001;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Lineup Optimizer</DialogTitle>
        </DialogHeader>
        {isWnba && noProjections && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <strong>Pre-season mode:</strong> projections unavailable until WNBA game data is imported.
          </div>
        )}
        {result ? (
          <div className="space-y-4">
            {result.swaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 font-body">
                Your lineup is already optimal! No beneficial swaps found.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {result.swaps.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted rounded-lg p-3 border">
                      <div className="text-sm font-body flex items-center gap-1.5 flex-wrap">
                        <span className="text-destructive font-semibold inline-flex items-center gap-1">
                          ↓ {s.starterPlayer.name}
                          <HealthStatusIcon health={s.starterPlayer.health ?? null} size="xs" />
                        </span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="text-green-600 font-semibold inline-flex items-center gap-1">
                          ↑ {s.benchPlayer.name}
                          <HealthStatusIcon health={s.benchPlayer.health ?? null} size="xs" />
                        </span>
                      </div>
                      <span className="text-sm font-mono text-green-600 font-bold">+{s.deltaFp5.toFixed(1)} FP5</span>
                    </div>
                  ))}
                </div>
                {result.explanations && result.explanations.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
                    {result.explanations.map((line, i) => (
                      <div key={i} className="text-[11px] text-amber-200/90 font-body">
                        • {line}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-heading uppercase">Total Improvement</p>
                  <p className="text-2xl font-heading font-bold text-green-600">+{result.totalDeltaFp5.toFixed(1)} FP5</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Calculating…</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {result && result.swaps.length > 0 && (
            <Button onClick={onApply} disabled={applying}>
              {applying ? "Applying…" : "Apply Optimization"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
