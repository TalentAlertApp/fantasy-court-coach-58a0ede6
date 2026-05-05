import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";
import BallersIQShareCard from "@/components/ballers-iq/share/BallersIQShareCard";
import type { ShareCardContext } from "@/components/ballers-iq/share/formatBallersIQShareText";

// Stub fetch + FileReader so the embedded photo path resolves to a 1×1 PNG data URL.
beforeAll(() => {
  const ONE_PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lPAAAAABJRU5ErkJggg==";
  // @ts-expect-error – override for jsdom
  global.fetch = async () => ({ ok: true, blob: async () => new Blob(["x"], { type: "image/png" }) });
  class FR {
    public result: string | null = null;
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    readAsDataURL() { this.result = ONE_PX; queueMicrotask(() => this.onload?.()); }
  }
  // @ts-expect-error – override for jsdom
  global.FileReader = FR;
});

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
    // Photo renders immediately (direct URL) — no initials fallback while embed resolves.
    const initialImgs = Array.from(document.querySelectorAll("img"));
    expect(initialImgs.some((i) => !!i.getAttribute("src"))).toBe(true);
    // Risk chip must never wrap.
    expect(screen.getByText(/Risk · LOW/).className).toMatch(/whitespace-nowrap/);
    // Player photo embedded as data URL — confirms the async pipeline resolved.
    await waitFor(() => {
      const imgs = document.querySelectorAll("img");
      const hasDataUrl = Array.from(imgs).some((i) => i.src.startsWith("data:image"));
      expect(hasDataUrl).toBe(true);
    });
    // Marker the modal awaits before rasterising must report ready.
    const marker = document.querySelector("[data-photo-ready]") as HTMLElement;
    await waitFor(() => expect(marker.getAttribute("data-photo-ready")).toBe("1"));
  });
});