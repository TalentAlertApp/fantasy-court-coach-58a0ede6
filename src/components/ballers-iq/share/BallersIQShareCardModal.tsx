import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Download, Square, RectangleHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BallersIQShareCard, { type ShareCardFormat } from "./BallersIQShareCard";
import { formatBallersIQShareText, type ShareCardContext } from "./formatBallersIQShareText";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: ShareCardContext;
}

/**
 * Preview + copy text + (best-effort) PNG download.
 * PNG export uses html-to-image only if dynamically importable;
 * otherwise the user gets the preview and copy-text path.
 */
export default function BallersIQShareCardModal({ open, onOpenChange, ctx }: Props) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ShareCardFormat>("square");
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const text = formatBallersIQShareText(ctx);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Share text copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text manually.", variant: "destructive" });
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const mod: any = await import("html-to-image").catch(() => null);
      if (!mod?.toPng) {
        toast({
          title: "PNG export unavailable",
          description: "Use Copy Text — PNG export requires the html-to-image package.",
        });
        return;
      }

      // Pre-decode every <img> inside the card so html-to-image doesn't snapshot
      // a half-loaded tree. Failed images are removed so they don't taint the canvas.
      const imgs = Array.from(cardRef.current.querySelectorAll("img"));
      await Promise.all(imgs.map(async (img) => {
        try {
          if (!img.complete || img.naturalWidth === 0) await img.decode();
        } catch {
          img.remove();
        }
      }));

      const opts = {
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: true,
        imagePlaceholder:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lPAAAAABJRU5ErkJggg==",
      };

      let dataUrl: string;
      try {
        dataUrl = await mod.toPng(cardRef.current, opts);
      } catch (innerErr) {
        console.warn("toPng failed, falling back to toJpeg", innerErr);
        dataUrl = await mod.toJpeg(cardRef.current, { ...opts, quality: 0.95, backgroundColor: "#0b0f1a" });
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `ballers-iq-${ctx.template}-${format}.${dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png"}`;
      a.click();
    } catch (e: any) {
      console.error("Share card export failed:", e);
      const msg = e?.message || e?.name || "Export blocked by the browser (likely a cross-origin image).";
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Preview scale so a 1080-px card fits inside the modal.
  const previewScale = format === "square" ? 0.42 : 0.42;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">Create Share Card</DialogTitle>
        </DialogHeader>

        <Tabs value={format} onValueChange={(v) => setFormat(v as ShareCardFormat)}>
          <TabsList className="grid grid-cols-2 w-48">
            <TabsTrigger value="square" className="gap-1.5"><Square className="h-3.5 w-3.5" />Square</TabsTrigger>
            <TabsTrigger value="wide" className="gap-1.5"><RectangleHorizontal className="h-3.5 w-3.5" />Wide</TabsTrigger>
          </TabsList>

          <TabsContent value={format} className="mt-3">
            <div className="flex justify-center bg-muted/30 rounded-xl p-3 overflow-hidden">
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                  width: format === "square" ? 1080 * previewScale : 1200 * previewScale,
                  height: format === "square" ? 1080 * previewScale : 675 * previewScale,
                }}
              >
                <BallersIQShareCard ref={cardRef} ctx={ctx} format={format} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-2">
          <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1">Share text</p>
          <pre className="text-xs whitespace-pre-wrap rounded-lg bg-muted/40 border border-border p-3 max-h-40 overflow-auto">{text}</pre>
        </div>

        <div className="flex items-center justify-end gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy text</Button>
          <Button size="sm" onClick={handleDownload} disabled={exporting}>
            <Download className="h-3.5 w-3.5 mr-1.5" />{exporting ? "Exporting…" : "Download PNG"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}