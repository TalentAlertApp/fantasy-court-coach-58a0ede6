import type { BallersIQInsight } from "@/lib/ballers-iq";

export type ShareTemplate =
  | "captain_edge"
  | "player_verdict"
  | "value_add"
  | "risk_radar"
  | "game_night"
  | "recap_mvp";

export interface ShareCardContext {
  template: ShareTemplate;
  /** Display title for the player or subject ("LeBron James", "GW3 Day 2", etc.). */
  subject: string;
  /** Optional secondary line: team, position, salary. */
  subtitle?: string;
  /** Photo / logo URL. */
  imageUrl?: string | null;
  insight: BallersIQInsight;
  /** Optional sponsor block — only rendered if explicitly provided. */
  sponsor?: { label: string; url?: string } | null;
}

const TEMPLATE_LABEL: Record<ShareTemplate, string> = {
  captain_edge: "Captain Edge",
  player_verdict: "Player Verdict",
  value_add: "Value Add",
  risk_radar: "Risk Radar",
  game_night: "Game Night Edge",
  recap_mvp: "Recap MVP",
};

export function templateLabel(t: ShareTemplate): string {
  return TEMPLATE_LABEL[t];
}

/** Plain-text share string, safe for clipboard / X / WhatsApp. */
export function formatBallersIQShareText(ctx: ShareCardContext): string {
  const lines: string[] = [];
  lines.push(`🏀 Ballers.IQ — ${TEMPLATE_LABEL[ctx.template]}`);
  lines.push("");
  lines.push(ctx.subject + (ctx.subtitle ? ` · ${ctx.subtitle}` : ""));
  lines.push("");
  lines.push(ctx.insight.headline);
  for (const b of ctx.insight.bullets.slice(0, 3)) lines.push(`• ${b}`);
  if (ctx.insight.action) lines.push(`→ ${ctx.insight.action}`);
  if (ctx.sponsor?.label) {
    lines.push("");
    lines.push(`Powered by ${ctx.sponsor.label}`);
  }
  return lines.join("\n").trim();
}