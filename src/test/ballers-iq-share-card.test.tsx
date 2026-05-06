import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BallersIQShareCard from "@/components/ballers-iq/share/BallersIQShareCard";
import type { ShareCardContext } from "@/components/ballers-iq/share/formatBallersIQShareText";

const ctx: ShareCardContext = {
  template: "player_verdict",
  subject: "John Konchar",
  subtitle: "UTA · BC · $5.4M",
  imageUrl: "https://cdn.nba.com/headshots/nba/latest/260x190/1629638.png",
  insight: {
    id: "x",
    type: "player",
    title: "Player Verdict",
    headline: "Form is up; minutes stable.",
    bullets: ["FP5 43.8 · MPG5 31.8.", "Δ FP +24.5 vs season.", "Δ MPG +12.1."],
    action: "START",
    riskLevel: "LOW",
  } as any,
};

describe("BallersIQShareCard regression", () => {
  it("renders the player photo (data URL) and key text regions", async () => {
    render(<BallersIQShareCard ctx={ctx} format="square" />);
    expect(screen.getByText(/PLAYER VERDICT/i)).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("Konchar")).toBeInTheDocument();
    expect(screen.getByText(ctx.subtitle!)).toBeInTheDocument();
    expect(screen.getByText(ctx.insight.headline)).toBeInTheDocument();
    for (const b of ctx.insight.bullets) {
      expect(screen.getByText(b)).toBeInTheDocument();
    }
    expect(screen.getByText("START")).toBeInTheDocument();
    expect(screen.getByText(/Risk · LOW/)).toBeInTheDocument();
    // Risk chip must never wrap.
    expect(screen.getByText(/Risk · LOW/).className).toMatch(/whitespace-nowrap/);
    // Player photo routed through Supabase image-proxy (same-origin -> no canvas tainting).
    const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    const proxied = imgs.find((i) => i.src.includes("/functions/v1/image-proxy?url="));
    expect(proxied).toBeTruthy();
    expect(proxied!.getAttribute("crossorigin")).toBe("anonymous");
    // Photo marker exists; will flip to "1" on onLoad/onError in real DOM.
    const marker = document.querySelector("[data-photo-ready]") as HTMLElement;
    expect(marker).toBeTruthy();
  });
});