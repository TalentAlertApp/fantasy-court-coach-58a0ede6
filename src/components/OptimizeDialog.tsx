import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptimizerResult } from "@/lib/optimizer";

interface OptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: OptimizerResult | null;
  onApply: () => void;
  applying?: boolean;
}

export default function OptimizeDialog({ open, onOpenChange, result, onApply, applying }: OptimizeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lineup Optimizer</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            {result.swaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Your lineup is already optimal! No beneficial swaps found.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {result.swaps.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted rounded-lg p-3">
                      <div className="text-sm">
                        <span className="text-destructive font-medium">↓ {s.starterPlayer.name}</span>
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className="text-green-600 font-medium">↑ {s.benchPlayer.name}</span>
                      </div>
                      <span className="text-sm font-mono text-green-600">+{s.deltaFp5.toFixed(1)} FP5</span>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total improvement</p>
                  <p className="text-2xl font-bold text-green-600">+{result.totalDeltaFp5.toFixed(1)} FP5</p>
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
            <Button onClick={onApply} disabled={applying} className="bg-nba-yellow text-foreground hover:bg-nba-yellow/90 font-bold">
              {applying ? "Applying…" : "Apply Optimization"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
