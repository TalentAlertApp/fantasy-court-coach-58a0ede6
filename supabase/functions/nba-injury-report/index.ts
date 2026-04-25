// supabase/functions/nba-injury-report/index.ts
// Aggregates NBA injury data from ESPN, CBS Sports and RotoWire.
// Public endpoint (no JWT). Cached for 30 minutes.

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

interface InjuryRecord {
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; NBAFantasyBot/1.0)",
  "Accept": "text/html,application/xhtml+xml,*/*",
};

function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("day-to-day") || s === "dtd") return "Day-To-Day";
  if (s.includes("game-time") || s === "gtd") return "Game-Time Decision";
  if (s.includes("questionable")) return "Questionable";
  if (s.includes("probable")) return "Probable";
  if (s.includes("out") && !s.includes("throughout")) return "Out";
  if (s.includes("rest") || s.includes("load manag")) return "Rest";
  if (s.includes("suspend")) return "Suspended";
  if (s.includes("g league") || s.includes("g-league")) return "G-League";
  if (s.includes("personal")) return "Personal";
  return raw.trim();
}

async function fetchESPN(): Promise<InjuryRecord[]> {
  const url = "https://www.espn.com/nba/injuries";
  const html = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: InjuryRecord[] = [];
  let team = "", abbr = "";

  doc?.querySelectorAll("div.injuries__team, div.Table__Title, tbody tr").forEach((el: any) => {
    if (el.matches?.("div.injuries__team, div.Table__Title")) {
      team = el.textContent?.trim() ?? "";
      abbr = team.replace(/\s+/g, "").slice(0, 3).toUpperCase();
      return;
    }
    const cells = el.querySelectorAll("td");
    if (cells.length >= 4) {
      out.push({
        player_name: cells[0]?.textContent?.trim() ?? "",
        team,
        team_abbr: abbr,
        status: normalizeStatus(cells[2]?.textContent ?? ""),
        injury_type: cells[3]?.textContent?.trim() ?? "",
        estimated_return: null,
        notes: cells[4]?.textContent?.trim() ?? "",
        last_updated: new Date().toISOString(),
        source: "ESPN",
      });
    }
  });
  return out;
}

function cleanCbsName(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  // CBS renders both an abbreviated name ("A. Davis") and the full name
  // ("Anthony Davis") inside the same cell, producing strings like
  // "A. DavisAnthony Davis". Detect that pattern and keep the full name.
  const m = s.match(/^([A-Z]\.\s?[A-Za-zÀ-ÖØ-öø-ÿ'’.\-]+)([A-Z][a-zÀ-ÖØ-öø-ÿ'’.\-]+\s+[A-Za-zÀ-ÖØ-öø-ÿ'’.\-]+.*)$/);
  if (m) return m[2].trim();
  return s;
}

function cleanCbsTeam(raw: string): { team: string; abbr: string } {
  const t = (raw ?? "").trim();
  if (!t) return { team: "", abbr: "" };
  const map: Record<string, { team: string; abbr: string }> = {
    "L.A. Lakers": { team: "Los Angeles Lakers", abbr: "LAL" },
    "L.A. Clippers": { team: "LA Clippers", abbr: "LAC" },
    "LA Lakers": { team: "Los Angeles Lakers", abbr: "LAL" },
    "LA Clippers": { team: "LA Clippers", abbr: "LAC" },
  };
  if (map[t]) return map[t];
  // Default: keep team string, derive abbr by trimming non-letters first 3.
  const abbr = t.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return { team: t, abbr };
}

async function fetchCBS(): Promise<InjuryRecord[]> {
  const url = "https://www.cbssports.com/nba/injuries/";
  const html = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: InjuryRecord[] = [];
  let team = "", abbr = "";

  doc?.querySelectorAll(".TeamLogoNameLockup, .TableBase-bodyTr").forEach((el: any) => {
    if (el.matches?.(".TeamLogoNameLockup")) {
      const cleaned = cleanCbsTeam(el.textContent ?? "");
      team = cleaned.team;
      abbr = cleaned.abbr;
      return;
    }
    const cells = el.querySelectorAll("td");
    if (cells.length >= 5) {
      out.push({
        player_name: cleanCbsName(cells[0]?.textContent ?? ""),
        team,
        team_abbr: abbr,
        status: normalizeStatus(cells[4]?.textContent ?? ""),
        injury_type: cells[3]?.textContent?.trim() ?? "",
        estimated_return: cells[2]?.textContent?.trim() || null,
        notes: "",
        last_updated: new Date().toISOString(),
        source: "CBS Sports",
      });
    }
  });
  return out;
}

async function fetchRotoWire(): Promise<InjuryRecord[]> {
  const url = "https://www.rotowire.com/basketball/injury-report.php";
  const html = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: InjuryRecord[] = [];

  doc?.querySelectorAll(".player-injury-row, .injury-report-table tbody tr").forEach((el: any) => {
    const cells = el.querySelectorAll("td");
    if (cells.length >= 5) {
      const teamTxt = cells[1]?.textContent?.trim() ?? "";
      out.push({
        player_name: cells[0]?.textContent?.trim() ?? "",
        team: teamTxt,
        team_abbr: teamTxt.slice(0, 3).toUpperCase(),
        status: normalizeStatus(cells[4]?.textContent ?? ""),
        injury_type: cells[3]?.textContent?.trim() ?? "",
        estimated_return: cells[5]?.textContent?.trim() || null,
        notes: cells[6]?.textContent?.trim() ?? "",
        last_updated: new Date().toISOString(),
        source: "RotoWire",
      });
    }
  });
  return out;
}

// Priority: ESPN → CBS → RotoWire (first wins, backfill missing fields).
function deduplicate(records: InjuryRecord[]): InjuryRecord[] {
  const map = new Map<string, InjuryRecord>();
  for (const r of records) {
    const key = r.player_name.toLowerCase().replace(/\s+/g, "-");
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const existing = map.get(key)!;
      if (!existing.estimated_return && r.estimated_return) existing.estimated_return = r.estimated_return;
      if (!existing.notes && r.notes) existing.notes = r.notes;
      if (!existing.injury_type && r.injury_type) existing.injury_type = r.injury_type;
      if (!existing.team && r.team) existing.team = r.team;
      if (!existing.team_abbr && r.team_abbr) existing.team_abbr = r.team_abbr;
    }
  }
  return [...map.values()].filter((r) => r.player_name.length > 0);
}

const STATUS_ORDER: Record<string, number> = {
  "Out": 0, "Day-To-Day": 1, "Game-Time Decision": 2,
  "Questionable": 3, "Probable": 4, "Rest": 5,
  "Personal": 6, "Suspended": 7, "G-League": 8,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results = await Promise.allSettled([fetchESPN(), fetchCBS(), fetchRotoWire()]);
    const all: InjuryRecord[] = [];
    const errors: string[] = [];
    const sourceLabels = ["ESPN", "CBS Sports", "RotoWire"];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") all.push(...r.value);
      else errors.push(`${sourceLabels[i]}: ${String(r.reason)}`);
    });

    const injuries = deduplicate(all).sort((a, b) => {
      const ao = STATUS_ORDER[a.status] ?? 99;
      const bo = STATUS_ORDER[b.status] ?? 99;
      return ao !== bo ? ao - bo : a.player_name.localeCompare(b.player_name);
    });

    const byTeam: Record<string, InjuryRecord[]> = {};
    for (const r of injuries) {
      const key = r.team || "Unknown";
      if (!byTeam[key]) byTeam[key] = [];
      byTeam[key].push(r);
    }

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        total_players: injuries.length,
        sources_failed: errors.length ? errors : undefined,
        by_team: byTeam,
        all: injuries,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=1800",
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});