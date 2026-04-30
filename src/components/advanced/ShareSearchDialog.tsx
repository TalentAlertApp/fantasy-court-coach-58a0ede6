import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { SubFilterState } from "@/lib/play-filter-config";

interface ShareSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  nbaPlayDbUrl: string | null;
  actionPlayer: string;
  actionTypes: string[];
  subFilters: SubFilterState;
}

function Chips({ label, items, tone = "default" }: { label: string; items: string[]; tone?: "default" | "yellow" | "primary" }) {
  if (!items.length) return null;
  const toneCls =
    tone === "yellow"
      ? "border-[hsl(var(--nba-yellow))]/40 text-[hsl(var(--nba-yellow))]"
      : tone === "primary"
      ? "border-primary/40 text-primary"
      : "";
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <Badge key={it} variant="outline" className={`rounded-md text-[10px] capitalize ${toneCls}`}>
            {it.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function ShareSearchDialog({
  open,
  onOpenChange,
  shareUrl,
  nbaPlayDbUrl,
  actionPlayer,
  actionTypes,
  subFilters,
}: ShareSearchDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied", { description: "Share to reopen this exact search." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const distance =
    subFilters.shotdistancemin != null || subFilters.shotdistancemax != null
      ? `${subFilters.shotdistancemin ?? 0}–${subFilters.shotdistancemax ?? "∞"} ft`
      : null;

  const togglesActive: string[] = [];
  if (subFilters.isaftertimeout) togglesActive.push("After Timeout");
  if (subFilters.isbuzzerbeater) togglesActive.push("Buzzer Beater");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Share NBA Play Search
          </DialogTitle>
          <DialogDescription className="text-xs">
            Preview what will be shared, then copy the link. Anyone who opens it sees the exact same filters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
          <div className="space-y-1">
            <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Player</div>
            <div className="text-sm font-heading font-semibold">
              {actionPlayer || <span className="text-muted-foreground italic">Any</span>}
            </div>
          </div>
          <Chips label="Action Types" items={actionTypes} tone="primary" />
          <Chips label="Qualifiers" items={subFilters.qualifiers} />
          <Chips label="Subtype" items={subFilters.subtype} />
          <Chips label="Court Area" items={subFilters.area} />
          <Chips label="Shot Result" items={subFilters.shotresult} />
          {distance && (
            <div className="space-y-1">
              <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Shot Distance</div>
              <div className="text-xs font-mono">{distance}</div>
            </div>
          )}
          <Chips label="Toggles" items={togglesActive} tone="yellow" />
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">Shareable URL</div>
          <div className="flex items-stretch gap-1.5">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 min-w-0 h-9 rounded-md border border-input bg-muted/40 px-3 text-[11px] font-mono text-muted-foreground"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button onClick={handleCopy} variant="default" size="sm" className="rounded-md h-9 shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        {nbaPlayDbUrl && (
          <div className="flex justify-end">
            <a
              href={nbaPlayDbUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              Open plays on NBAPlayDB <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}