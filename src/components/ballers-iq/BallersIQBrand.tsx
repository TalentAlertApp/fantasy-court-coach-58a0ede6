import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type BallersIQBrandVariant = "wordmark" | "emblem" | "appIcon" | "badge";
export type BallersIQBrandSize = "sm" | "md" | "lg";

interface Props {
  variant?: BallersIQBrandVariant;
  size?: BallersIQBrandSize;
  themeAware?: boolean;
  className?: string;
  alt?: string;
}

/** Detect dark theme from the <html class="dark"> attribute (this app is dark-first). */
function useIsDark(): boolean {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark") ||
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ||
      true; // default to dark — app is dark-themed
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark") || true);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const HEIGHTS: Record<BallersIQBrandSize, { wordmark: string; square: string }> = {
  sm: { wordmark: "h-4", square: "h-5 w-5" },
  md: { wordmark: "h-6", square: "h-7 w-7" },
  lg: { wordmark: "h-9", square: "h-10 w-10" },
};

export default function BallersIQBrand({
  variant = "emblem",
  size = "md",
  themeAware = true,
  className,
  alt = "Ballers.IQ",
}: Props) {
  const dark = useIsDark();
  const themeSuffix = themeAware ? (dark ? "dark" : "light") : "dark";

  let src = "";
  let cls = "";
  switch (variant) {
    case "wordmark":
      src = `/brand/ballers-iq-wordmark-${themeSuffix}.png`;
      cls = `${HEIGHTS[size].wordmark} w-auto`;
      break;
    case "emblem":
      src = `/brand/ballers-iq-emblem-${themeSuffix}.png`;
      cls = `${HEIGHTS[size].square} object-contain`;
      break;
    case "appIcon":
      src = `/brand/ballers-iq-app-icon.png`;
      cls = `${HEIGHTS[size].square} object-contain rounded-lg`;
      break;
    case "badge":
      src = `/brand/ballers-iq-badge.png`;
      cls = `${size === "lg" ? "h-12" : size === "md" ? "h-9" : "h-7"} w-auto object-contain`;
      break;
  }

  return (
    <img src={src} alt={alt} className={cn("select-none pointer-events-none", cls, className)} draggable={false} />
  );
}