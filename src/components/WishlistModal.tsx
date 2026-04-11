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
                return (
                  <div
                    key={p.core.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 cursor-pointer group"
                    onClick={() => { onPlayerClick(p.core.id); onOpenChange(false); }}
                  >
                    {p.core.photo ? (
                      <img src={p.core.photo} alt="" className="w-7 h-7 rounded-full object-cover bg-muted" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">{p.core.name.substring(0, 2).toUpperCase()}</div>
                    )}
                    {logo && <img src={logo} alt="" className="w-4 h-4" />}
                    <span className="text-xs font-medium flex-1">{p.core.name}</span>
                    <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg">{p.core.fc_bc}</Badge>
                    <span className="text-[10px] font-mono text-muted-foreground">${p.core.salary}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromWishlist(p.core.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
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
