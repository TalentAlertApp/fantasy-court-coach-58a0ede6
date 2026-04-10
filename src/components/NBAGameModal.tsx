import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tv2, Table2, BarChart3, Mic } from "lucide-react";

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
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="font-heading text-sm uppercase">{title}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 shrink-0">
            {TAB_CONFIG.map(({ key, label, icon: Icon, urlKey }) => {
              const url = urls[urlKey];
              if (!url) return null;
              return (
                <TabsTrigger key={key} value={key} className="gap-1 text-xs">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {TAB_CONFIG.map(({ key, urlKey }) => {
            const url = urls[urlKey];
            if (!url) return null;
            return (
              <TabsContent key={key} value={key} className="flex-1 min-h-0 px-4 pb-4">
                <iframe
                  src={url}
                  className="w-full h-full rounded-sm border"
                  title={key}
                  allowFullScreen
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
