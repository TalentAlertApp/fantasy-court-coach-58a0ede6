// Aggregates EuroLeague injury data from public sources.
// Public endpoint (no JWT). Cached for 30 minutes on the client.
//
// Primary source : Rotowire (https://www.rotowire.com/basketball/euroleague-injury-report.php)
// Secondary     : Eurohoops injuries tag (https://www.eurohoops.net/en/tag/euroleague-injuries/)
//                 — used only to surface team/player rows Rotowire missed; we do
//                 not try to parse return dates from news headlines.
//
// Response shape mirrors wnba-injury-report so InjuryReportModal can reuse the
// same rendering pipeline (status normalisation, bucketing, team filtering).

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
  "User-Agent": "Mozilla/5.0 (compatible; EuroLeagueFantasyBot/1.0)",
  "Accept": "text/html,application/xhtml+xml,*/*",
};

/** Map any team name / fragment Rotowire / Eurohoops use → DB tricode (matches
 *  src/lib/euroleague-teams.ts which mirrors the sheet's DB_Teams.TEAM_CODE). */
const TEAM_LOOKUP: Array<{ tricode: string; keywords: string[] }> = [
  { tricode: "EFS", keywords: ["anadolu efes", "efes"] },
  { tricode: "ASM", keywords: ["monaco"] },
  { tricode: "CZV", keywords: ["crvena zvezda", "red star"] },
  { tricode: "DUB", keywords: ["dubai"] },
  { tricode: "EA7", keywords: ["olimpia milano", "ea7", "armani milan", "ea7 milan"] },
  { tricode: "BAR", keywords: ["barcelona", "fc barcelona"] },
  { tricode: "BAY", keywords: ["bayern"] },
  { tricode: "FBB", keywords: ["fenerbahce", "fenerbahçe"] },
  { tricode: "HTA", keywords: ["hapoel tel aviv", "hapoel ibi"] },
  { tricode: "BKN", keywords: ["baskonia"] },
  { tricode: "ASV", keywords: ["asvel", "ldlc asvel", "villeurbanne"] },
  { tricode: "MTA", keywords: ["maccabi tel aviv", "maccabi rapyd", "maccabi"] },
  { tricode: "OLY", keywords: ["olympiacos"] },
  { tricode: "PAO", keywords: ["panathinaikos"] },
  { tricode: "PAR", keywords: ["paris basketball", "paris baskettball", "paris bb"] },
  { tricode: "PBB", keywords: ["partizan"] },
  { tricode: "RMB", keywords: ["real madrid"] },
  { tricode: "VBC", keywords: ["valencia"] },
  { tricode: "VIR", keywords: ["virtus bologna", "virtus segafredo", "segafredo bologna"] },
  { tricode: "ZAL", keywords: ["zalgiris", "žalgiris"] },
];

function tricodeFromText(s: string): string {
  if (!s) return "";
  const lower = s.toLowerCase();
  for (const t of TEAM_LOOKUP) {
    for (const k of t.keywords) if (lower.includes(k)) return t.tricode;
  }
  return s.slice(0, 3).toUpperCase();
}

function normalizeStatus(raw: string): string {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "Day-To-Day";
  if (s.includes("out for season") || s.includes("season-ending")) return "Out";
  if (s.includes("day-to-day") || s === "dtd") return "Day-To-Day";
  if (s.includes("game-time") || s === "gtd") return "Game-Time Decision";
  if (s.includes("questionable")) return "Questionable";
  if (s.includes("doubtful")) return "Day-To-Day";
  if (s.includes("probable")) return "Probable";
  if (s.includes("out") && !s.includes("throughout")) return "Out";
  if (s.includes("rest") || s.includes("load manag")) return "Rest";
  if (s.includes("suspend")) return "Suspended";
  return raw.trim() || "Day-To-Day";
}

async function fetchRotowire(): Promise<InjuryRecord[]> {
  const url = "https://www.rotowire.com/basketball/euroleague-injury-report.php";
  let html = "";
  try {
    html = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  } catch (e) {
    console.error("rotowire fetch failed", e);
    return [];
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];
  const out: InjuryRecord[] = [];
  // Rotowire renders a single sortable table; rows are <tr> with <td> per col.
  // Column order seen on the page: PLAYER, POS, TEAM, INJURY, STATUS, EST. RETURN, NOTES.
  const rows = doc.querySelectorAll("table tr");
  rows.forEach((tr) => {
    const tds = (tr as any).querySelectorAll?.("td") ?? [];
    if (!tds || tds.length < 5) return;
    const get = (i: number) => (tds[i]?.textContent ?? "").trim();
    const player = get(0);
    if (!player) return;
    const teamName = get(2);
    const injury = get(3);
    const status = get(4);
    const est = get(5) || null;
    const notes = get(6) || "";
    const tricode = tricodeFromText(teamName);
    out.push({
      player_name: player,
      team: teamName,
      team_abbr: tricode,
      injury_type: injury || "—",
      status: normalizeStatus(status),
      estimated_return: est && est.toUpperCase() !== "TBD" ? est : null,
      notes,
      last_updated: new Date().toISOString(),
      source: "Rotowire",
    });
  });
  return out;
}

async function fetchEurohoopsHeadlines(): Promise<InjuryRecord[]> {
  // Lightweight secondary: scrape headlines and infer player + status keywords.
  // We intentionally keep this conservative so we don't fabricate dates.
  const url = "https://www.eurohoops.net/en/tag/euroleague-injuries/";
  let html = "";
  try {
    html = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  } catch (e) {
    console.error("eurohoops fetch failed", e);
    return [];
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];
  const out: InjuryRecord[] = [];
  const headlines = doc.querySelectorAll("h2 a, h3 a");
  headlines.forEach((a) => {
    const title = (a as any).textContent?.trim?.() ?? "";
    if (!title) return;
    const lower = title.toLowerCase();
    if (!/(injury|injured|out|sidelined|surgery|return)/.test(lower)) return;
    const tricode = tricodeFromText(title);
    if (!tricode || tricode.length !== 3) return;
    out.push({
      player_name: title,
      team: tricode,
      team_abbr: tricode,
      injury_type: "See notes",
      status: lower.includes("out") || lower.includes("surgery") ? "Out" : "Day-To-Day",
      estimated_return: null,
      notes: title,
      last_updated: new Date().toISOString(),
      source: "Eurohoops",
    });
  });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sources_failed: string[] = [];
  const [rw, eh] = await Promise.all([
    fetchRotowire().catch((e) => { sources_failed.push(`Rotowire: ${e.message}`); return [] as InjuryRecord[]; }),
    fetchEurohoopsHeadlines().catch((e) => { sources_failed.push(`Eurohoops: ${e.message}`); return [] as InjuryRecord[]; }),
  ]);

  // Merge: Rotowire wins on player_name, Eurohoops only fills gaps.
  const seen = new Set<string>();
  const all: InjuryRecord[] = [];
  for (const r of rw) {
    const key = r.player_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(r);
  }
  for (const r of eh) {
    const key = r.player_name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(r);
  }

  const by_team: Record<string, InjuryRecord[]> = {};
  for (const r of all) {
    const k = r.team_abbr || "UNK";
    (by_team[k] ||= []).push(r);
  }

  const body = {
    generated_at: new Date().toISOString(),
    total_players: all.length,
    sources_failed,
    by_team,
    all,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
  });
});