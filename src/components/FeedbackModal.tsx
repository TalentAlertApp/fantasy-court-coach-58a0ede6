import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquareHeart, Mail, Copy, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FEEDBACK_EMAIL = "alertadetalento@gmail.com";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "My Roster",
  "/scoring": "Scoring",
  "/transactions": "Transactions",
  "/teams": "Teams",
  "/leagues": "Leagues",
  "/schedule": "Schedule",
  "/schedule/grid": "Schedule Grid",
  "/advanced": "Advanced",
  "/commissioner": "Commissioner",
};

export default function FeedbackModal({ open, onOpenChange }: Props) {
  const { pathname } = useLocation();
  const routeLabel = ROUTE_LABELS[pathname] ?? pathname;
  const subject = `Hoops Fantasy Manager Feedback — ${routeLabel}`;
  const body = [
    "Hi team,",
    "",
    "(Share your bug, idea, or quick reaction below — every line helps.)",
    "",
    `— route: ${pathname}`,
    `— sent: ${new Date().toISOString()}`,
  ].join("\n");
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      toast({ title: "Email copied", description: FEEDBACK_EMAIL });
    } catch {
      toast({ title: "Couldn't copy", description: FEEDBACK_EMAIL, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wide flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-accent" />
            Send feedback
          </DialogTitle>
          <DialogDescription className="pt-1 leading-relaxed">
            Hoops Fantasy Manager is in MVP testing — your feedback shapes what
            ships next. Bugs, ideas, or even a quick reaction all help us
            sharpen the product.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
            Reach us at
          </div>
          <button
            type="button"
            onClick={copyEmail}
            className="w-full flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm font-mono hover:bg-accent/10 transition-colors group"
            aria-label="Copy feedback email"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <Mail className="h-4 w-4 text-accent shrink-0" />
              <span className="truncate">{FEEDBACK_EMAIL}</span>
            </span>
            <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>
          <p className="text-[11px] text-muted-foreground">
            We'll prefill your email app with the page you're on
            (<span className="font-mono">{routeLabel}</span>) so we can jump
            straight to context.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <a href={mailto}>
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Open email app
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}