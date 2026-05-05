import { forwardRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import BallersIQBrand from "../BallersIQBrand";
import { templateLabel, type ShareCardContext } from "./formatBallersIQShareText";

export type ShareCardFormat = "square" | "wide";

interface Props {
  ctx: ShareCardContext;
  format?: ShareCardFormat;
  className?: string;
}

const SIZE: Record<ShareCardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  wide: { w: 1200, h: 675 },
};

/**
 * Pure presentational share card. Sized in CSS pixels (1080² / 1200×675) so
 * html2canvas / dom-to-image can rasterise at 1:1 for PNG export.
 * No buttons, no interactivity — wrap in a modal for actions.
 */
const BallersIQShareCard = forwardRef<HTMLDivElement, Props>(({ ctx, format = "square", className }, ref) => {
  const size = SIZE[format];
  const { insight } = ctx;
  // Pre-fetch the player image and convert to a same-origin data URL so html-to-image
  // can rasterise it (NBA CDN images are CORS-tainted otherwise).
  const [embeddedImage, setEmbeddedImage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setEmbeddedImage(null);
    if (!ctx.imageUrl) return;
    const direct = ctx.imageUrl;
    // weserv proxy strips protocol and serves with permissive CORS headers,
    // which lets us inline NBA CDN photos as data URLs for html-to-image.
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(direct.replace(/^https?:\/\//, ""))}`;
    const tryFetch = async (url: string): Promise<string | null> => {
      try {
        const r = await fetch(url, { mode: "cors" });
        if (!r.ok) return null;
        const blob = await r.blob();
        return await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      } catch { return null; }
    };
    (async () => {
      const dataUrl = (await tryFetch(direct)) ?? (await tryFetch(proxied));
      if (!cancelled) setEmbeddedImage(dataUrl);
    })();
    return () => { cancelled = true; };
  }, [ctx.imageUrl]);

  const nameParts = ctx.subject.trim().split(/\s+/);
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ctx.subject;
  const headlineSize = format === "wide" ? "text-[28px]" : "text-[34px]";
  const nameSize = format === "wide" ? "text-[48px]" : "text-[60px]";

  return (
    <div
      ref={ref}
      style={{ width: size.w, height: size.h }}
      className={cn(
        "relative overflow-hidden font-heading text-white",
        "bg-[radial-gradient(circle_at_20%_10%,hsl(45_90%_45%/0.25),transparent_55%),radial-gradient(circle_at_85%_95%,hsl(220_90%_45%/0.30),transparent_55%),linear-gradient(135deg,#0b0f1a_0%,#141a2b_100%)]",
        className,
      )}
    >
      {/* Big watermark emblem */}
      <BallersIQBrand
        variant="emblem"
        forceTheme="dark"
        transparent
        className="pointer-events-none absolute -bottom-20 -right-20 !h-[640px] !w-[640px] object-contain opacity-[0.10] rotate-12 select-none"
      />

      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 px-12 pt-10 flex items-center gap-4">
        <BallersIQBrand variant="wordmark" forceTheme="dark" transparent className="!h-12 w-auto" />
        <span className="text-[14px] font-bold uppercase tracking-[0.3em] text-amber-300/90 border-l border-white/20 pl-4">
          {templateLabel(ctx.template)}
        </span>
      </header>

      {/* Subject block */}
      <div className={cn("absolute inset-x-0 px-12", format === "wide" ? "top-28" : "top-36")}>
        <div className="flex items-center gap-6">
          {embeddedImage ? (
            <img
              src={embeddedImage}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              className={cn("rounded-2xl object-cover ring-2 ring-amber-300/40 shadow-2xl bg-white/5",
                format === "wide" ? "h-32 w-32" : "h-44 w-44")}
            />
          ) : (
            <div className={cn("rounded-2xl ring-2 ring-amber-300/40 bg-white/10 flex items-center justify-center text-white/80 font-black",
              format === "wide" ? "h-32 w-32 text-3xl" : "h-44 w-44 text-4xl")}>
              {ctx.subject.split(/\s+/).map((s) => s[0]).slice(0, 2).join("")}
            </div>
          )}
          <div className="min-w-0 flex flex-col">
            <h1 className={cn("font-black uppercase tracking-tight leading-[0.95]", nameSize)}>
              {firstName && <span className="block whitespace-nowrap">{firstName}</span>}
              <span className="block whitespace-nowrap">{lastName}</span>
            </h1>
            {ctx.subtitle && (
              <p className="mt-3 text-[18px] uppercase tracking-[0.18em] text-white/60 font-bold whitespace-nowrap">
                {ctx.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Insight body */}
      <div className={cn("absolute inset-x-0 px-12", format === "wide" ? "bottom-32" : "bottom-48")}>
        <p className={cn("font-bold leading-tight text-white", headlineSize)}>
          {insight.headline}
        </p>
        <ul className="mt-4 space-y-2">
          {insight.bullets.slice(0, format === "wide" ? 2 : 3).map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-white/80 text-[18px] leading-snug">
              <span className="mt-2 inline-block h-1.5 w-6 shrink-0 rounded-full bg-amber-300/80" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 inset-x-0 px-12 pb-8 flex items-end justify-between">
        <div className="flex items-center gap-3">
          {insight.action && (
            <span className="px-4 py-1.5 rounded-lg bg-amber-300 text-amber-950 text-[16px] font-black uppercase tracking-widest">
              {insight.action}
            </span>
          )}
          {insight.riskLevel && (
            <span className="px-4 py-1.5 rounded-lg bg-white/10 border border-white/20 text-[14px] font-bold uppercase tracking-widest">
              Risk · {insight.riskLevel}
            </span>
          )}
        </div>
        <div className="text-right">
          {ctx.sponsor?.label ? (
            <p className="text-[14px] uppercase tracking-[0.25em] text-white/60">
              Powered by <span className="text-amber-300 font-bold">{ctx.sponsor.label}</span>
            </p>
          ) : (
            <p className="text-[12px] uppercase tracking-[0.3em] text-white/40">hoopsfantasy.app</p>
          )}
        </div>
      </footer>
    </div>
  );
});
BallersIQShareCard.displayName = "BallersIQShareCard";
export default BallersIQShareCard;