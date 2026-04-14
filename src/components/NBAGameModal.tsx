import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tv2, Table2, BarChart3, Mic, ExternalLink } from "lucide-react";

export type NBAGameTab = "recap" | "boxscore" | "charts" | "playbyplay";

interface NBAGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab: NBAGameTab;
  urls: {
    game_recap_url?: string | null;
    game_boxscore_url?: string | null;
    game_charts_url?: string | null;
    game_playbyplay_url?: string | null;
  };
  title?: string;
}

const TAB_CONFIG: { key: NBAGameTab; label: string; icon: typeof Tv2; urlKey: keyof NBAGameModalProps["urls"] }[] = [
  { key: "recap", label: "Recap", icon: Tv2, urlKey: "game_recap_url" },
  { key: "boxscore", label: "BoxScore", icon: Table2, urlKey: "game_boxscore_url" },
  { key: "charts", label: "Charts", icon: BarChart3, urlKey: "game_charts_url" },
  { key: "playbyplay", label: "Play-by-Play", icon: Mic, urlKey: "game_playbyplay_url" },
];

export default function NBAGameModal({ open, onOpenChange, defaultTab, urls, title = "NBA Game" }: NBAGameModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-none shadow-2xl">
        <DialogHeader className="px-6 pt-4 pb-2 border-b bg-card shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-heading text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-2 bg-card border-b shrink-0">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              {TAB_CONFIG.map(({ key, label, icon: Icon, urlKey }) => {
                const url = urls[urlKey];
                if (!url) return null;
                return (
                  <TabsTrigger 
                    key={key} 
                    value={key} 
                    className="gap-2 px-4 py-2 text-xs font-heading uppercase transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {TAB_CONFIG.map(({ key, label, icon: Icon, urlKey }) => {
            const url = urls[urlKey];
            if (!url) return null;
            return (
              <TabsContent 
                key={key} 
                value={key} 
                className="flex-1 min-h-0 flex flex-col p-0 data-[state=active]:flex m-0"
              >
                <div className="flex-1 relative group">
                  <iframe
                    src={url}
                    className="w-full h-full border-0 bg-black"
                    title={`${label} - ${title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    loading="lazy"
                  />
                  
                  {/* Floating Action Button for External Link */}
                  <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground shadow-2xl rounded-full text-xs font-heading font-bold hover:scale-105 transition-all border border-white/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                      OPEN FULL PAGE
                    </a>
                  </div>

                  {/* Loading overlay / Help text if blocked */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-5 transition-opacity">
                    <Icon className="h-32 w-32" />
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
