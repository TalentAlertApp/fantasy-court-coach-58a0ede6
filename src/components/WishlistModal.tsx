import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWishlist } from "@/hooks/useWishlist";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
import { X, Heart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WishlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerClick: (id: number) => void;
}

export default function WishlistModal({ open, onOpenChange, onPlayerClick }: WishlistModalProps) {
  const { wishlistIds, removeFromWishlist } = useWishlist();
  const { data: playersData } = usePlayersQuery({ limit: 500 });
  const allPlayers = playersData?.items ?? [];

  const wishlisted = allPlayers.filter((p) => wishlistIds.includes(p.core.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-lg max-h-[70vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading uppercase tracking-wider text-sm">
            <Heart className="h-4 w-4 text-destructive" />
            Wishlist ({wishlisted.length})
          </DialogTitle>
        </DialogHeader>

        {wishlisted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No players in your wishlist yet. Add players from their detail modal.
          </p>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-1">
              {wishlisted.map((p) => {
                const logo = getTeamLogo(p.core.team);
                const fp = (p as any).last5?.fp5 ?? (p as any).season?.fp ?? 0;
                return (
                  <div
                    key={p.core.id}
                    className="relative flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-accent/50 cursor-pointer group overflow-hidden"
                    onClick={() => { onPlayerClick(p.core.id); onOpenChange(false); }}
                  >
                    {/* Team watermark */}
                    {logo && (
                      <img
                        src={logo}
                        alt=""
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 opacity-[0.06] pointer-events-none select-none transition-transform group-hover:scale-125"
                      />
                    )}
                    {/* FC/BC badge — far left */}
                    <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg shrink-0">{p.core.fc_bc}</Badge>
                    {p.core.photo ? (
                      <img src={p.core.photo} alt="" className="w-7 h-7 rounded-full object-cover bg-muted" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">{p.core.name.substring(0, 2).toUpperCase()}</div>
                    )}
                    <span className="text-xs font-medium flex-1 relative z-10">{p.core.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground relative z-10">{Number(fp).toFixed(1)} FP</span>
                    <span className="text-muted-foreground/40 relative z-10">|</span>
                    <span className="text-[10px] font-mono text-muted-foreground relative z-10">${p.core.salary}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromWishlist(p.core.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity relative z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
