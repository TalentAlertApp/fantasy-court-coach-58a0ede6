import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import type { LeagueTeam } from "@/hooks/useLeagueTeams";

export interface InjuryRecord {
  player_name: string;
  team: string;
  team_abbr: string;
  injury_type: string;
  status: string;
  estimated_return: string | null;
  notes: string;
  last_updated: string;
  source: string;
}

export interface InjuryPayload {
  generated_at: string;
  total_players: number;
  sources_failed?: string[];
  by_team: Record<string, InjuryRecord[]>;
  all: InjuryRecord[];
}

export interface EnrichedRecord extends InjuryRecord {
  player_id: number | null;
  pos: string | null;
  fc_bc: string | null;
  photo: string | null;
  team_tricode: string;
  team_full_name: string;
  on_roster: boolean;
}

export const INJURY_CACHE_KEY = "nbaf:injury-report:v1";
export const INJURY_CACHE_TTL_MS = 30 * 60 * 1000;

export function readInjuryCache(): { payload: InjuryPayload; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(INJURY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; payload: InjuryPayload };
    if (!parsed?.savedAt || !parsed?.payload) return null;
    if (Date.now() - parsed.savedAt > INJURY_CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

export function writeInjuryCache(payload: InjuryPayload) {
  try {
    localStorage.setItem(INJURY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch { /* ignore quota */ }
}

export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function tricodeFromTeamString(s: string, TEAMS: LeagueTeam[]): string {
  if (!s) return "";
  const upper = s.toUpperCase().trim();
  const exact = TEAMS.find((t) => t.tricode === upper);
  if (exact) return exact.tricode;
  const lower = s.toLowerCase();
  const byName = TEAMS.find(
    (t) => lower.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(lower),
  );
  return byName?.tricode ?? upper.slice(0, 3);
}

export function fullNameFromTricode(tricode: string, TEAMS: LeagueTeam[]): string {
  return TEAMS.find((t) => t.tricode === tricode)?.name ?? tricode;
}

export function statusClasses(status: string): string {
  switch (status) {
    case "Out": return "bg-destructive text-destructive-foreground";
    case "Day-To-Day": return "bg-orange-500 text-white";
    case "Game-Time Decision": return "bg-amber-500 text-white";
    case "Questionable": return "bg-yellow-400 text-black";
    case "Probable": return "bg-green-600 text-white";
    case "Rest": return "bg-slate-500 text-white";
    case "Personal": return "bg-muted text-muted-foreground";
    case "Suspended": return "bg-red-900 text-white";
    case "G-League": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

export function bucketStatus(raw: string | null | undefined): "Out" | "Day-To-Day" | "Questionable" | "Probable" | null {
  if (!raw) return null;
  const s = raw.toString().toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/\bday[\s-]?to[\s-]?day\b|^dtd\b|\bdtd\b/.test(s)) return "Day-To-Day";
  if (/\bquestionable\b/.test(s)) return "Questionable";
  if (/\bprobable\b/.test(s)) return "Probable";
  if (/\bout\b/.test(s)) return "Out";
  if (/\bdoubtful\b/.test(s)) return "Day-To-Day";
  return null;
}

export function bucketRecord(r: {
  status?: string | null;
  estimated_return?: string | null;
  injury_type?: string | null;
  notes?: string | null;
}) {
  return (
    bucketStatus(r.status) ??
    bucketStatus(r.estimated_return) ??
    bucketStatus(r.injury_type) ??
    bucketStatus(r.notes) ??
    null
  );
}

export interface ReturnInfo {
  label: string;
  isSeasonEnd: boolean;
  isTbd: boolean;
  daysAway: number | null;
}

export function formatReturn(raw: string | null): ReturnInfo {
  if (!raw) return { label: "TBD", isSeasonEnd: false, isTbd: true, daysAway: null };
  const trimmed = raw.trim();
  if (!trimmed) return { label: "TBD", isSeasonEnd: false, isTbd: true, daysAway: null };
  if (/season-?ending/i.test(trimmed)) return { label: "Season-ending", isSeasonEnd: true, isTbd: false, daysAway: null };
  if (/next season/i.test(trimmed)) return { label: "Next Season", isSeasonEnd: true, isTbd: false, daysAway: null };
  const iso = parseISO(trimmed);
  if (isValid(iso)) {
    const days = differenceInCalendarDays(iso, new Date());
    return { label: format(iso, "MMM d"), isSeasonEnd: false, isTbd: false, daysAway: days };
  }
  const d = new Date(trimmed);
  if (isValid(d) && !isNaN(d.getTime())) {
    const days = differenceInCalendarDays(d, new Date());
    return { label: format(d, "MMM d"), isSeasonEnd: false, isTbd: false, daysAway: days };
  }
  return { label: trimmed, isSeasonEnd: false, isTbd: false, daysAway: null };
}

export function dateColorClass(ret: ReturnInfo): string {
  if (ret.isSeasonEnd) return "text-red-500 font-bold";
  if (ret.isTbd) return "text-muted-foreground";
  if (ret.daysAway === null) return "text-muted-foreground";
  if (ret.daysAway <= 30) return "text-yellow-400 font-bold";
  return "text-red-500 font-bold";
}

export function cleanInjuryNotes(raw: string | null | undefined, playerName?: string): string {
  if (!raw) return "";
  let s = String(raw).replace(/\s+/g, " ").trim();
  s = s.replace(/^\s*(?:news\s+)?display\s+mode(?:\s+(?:compact|expanded))+\s*/i, "");
  s = s.replace(/^\s*news\s+/i, "");
  s = s.replace(/\s*\bANALYSIS\b.*$/i, "");
  s = s.replace(/\s*Subscribe\s+now\s+to\b.*$/i, "");
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  s = s.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[\s,;:.\-]*…?\s*$/u, (m) => (m.includes("…") ? "…" : ""));
  if (playerName) {
    const last = playerName.trim().split(/\s+/).pop() ?? "";
    if (last) {
      const re = new RegExp(`(${last.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})([A-Z])`, "g");
      s = s.replace(re, "$1 $2");
    }
    const escaped = playerName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`^${escaped}\\s+`, "i"), "");
  }
  return s.trim();
}

export function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}