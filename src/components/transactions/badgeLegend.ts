import {
  ShieldAlert,
  BadgeAlert,
  Gem,
  Flame,
  Snowflake,
  CalendarPlus,
  CalendarX,
  CalendarClock,
  TrendingUp,
  ClockAlert,
  Crown,
  Puzzle,
  CheckCircle2,
  Heart,
  type LucideIcon,
} from "lucide-react";
import type { BadgeTone } from "./PlayerContextBadges";

export interface BadgeLegendEntry {
  /** matches PlayerBadge.key produced by computePlayerBadges */
  key: string;
  icon: LucideIcon;
  tone: BadgeTone;
  label: string;
}

export const BADGE_LEGEND: BadgeLegendEntry[] = [
  { key: "health",    icon: ShieldAlert,   tone: "amber",  label: "Health risk" },
  { key: "trap",      icon: BadgeAlert,    tone: "amber",  label: "Salary trap" },
  { key: "value",     icon: Gem,           tone: "green",  label: "Value add" },
  { key: "hot",       icon: Flame,         tone: "green",  label: "Hot form" },
  { key: "cold",      icon: Snowflake,     tone: "blue",   label: "Cold form" },
  { key: "schedplus", icon: CalendarPlus,  tone: "green",  label: "Sched boost" },
  { key: "nogame",    icon: CalendarX,     tone: "amber",  label: "No game" },
  { key: "light",     icon: CalendarClock, tone: "slate",  label: "Light week" },
  { key: "roleplus",  icon: TrendingUp,    tone: "green",  label: "Role boost" },
  { key: "minrisk",   icon: ClockAlert,    tone: "amber",  label: "Minutes risk" },
  { key: "cap",       icon: Crown,         tone: "gold",   label: "Captain edge" },
  { key: "fit",       icon: Puzzle,        tone: "blue",   label: "Roster fit" },
  { key: "owned",     icon: CheckCircle2,  tone: "blue",   label: "Owned" },
  { key: "watch",     icon: Heart,         tone: "violet", label: "Wishlist" },
];

export const BADGE_TONE_TEXT: Record<BadgeTone, string> = {
  red: "text-red-400",
  amber: "text-amber-300",
  gold: "text-yellow-300",
  green: "text-emerald-300",
  blue: "text-sky-300",
  slate: "text-slate-400",
  violet: "text-violet-300",
};

export const BADGE_TONE_GLOW: Record<BadgeTone, string> = {
  red:    "hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.65)]",
  amber:  "hover:drop-shadow-[0_0_8px_rgba(252,211,77,0.65)]",
  gold:   "hover:drop-shadow-[0_0_10px_rgba(250,204,21,0.75)]",
  green:  "hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.65)]",
  blue:   "hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.65)]",
  slate:  "hover:drop-shadow-[0_0_7px_rgba(148,163,184,0.45)]",
  violet: "hover:drop-shadow-[0_0_8px_rgba(167,139,250,0.65)]",
};