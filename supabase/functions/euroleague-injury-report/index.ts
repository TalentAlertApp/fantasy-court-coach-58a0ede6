// Aggregates EuroLeague injury data from public sources.
// Public endpoint (no JWT). Cached for 30 minutes on the client.
//
// Primary  : Rotowire JSON table backing https://www.rotowire.com/euro/injury-report.php
//            (the actual data URL the page hits: /euro/tables/injury-report.php)
// Fallback : Rotowire injury news feed (/euro/news.php?view=injuries) — used to
//            surface late-breaking players that haven't hit the table yet.
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
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json,text/html,application/xhtml+xml,*/*",
  "Referer": "https://www.rotowire.com/euro/injury-report.php",
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
  // Rotowire renders the EuroLeague injury report client-side via webix; the
  // page calls /euro/tables/injury-report.php which returns clean JSON rows.
  const url =
    "https://www.rotowire.com/euro/tables/injury-report.php?team=ALL&pos=ALL";
  let raw = "";
  try {
    raw = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  } catch (e) {
    console.error("rotowire fetch failed", e);
    return [];
  }
  let rows: any[] = [];
  try {
    rows = JSON.parse(raw);
  } catch (e) {
    console.error("rotowire JSON parse failed", e, raw.slice(0, 200));
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const stripHtml = (s: string) =>
    (s ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const out: InjuryRecord[] = [];
  for (const r of rows) {
    const player =
      r.player || `${r.firstname ?? ""} ${r.lastname ?? ""}`.trim();
    if (!player) continue;
    const teamCode = String(r.team ?? "").toUpperCase().trim();
    const tricode = teamCode && teamCode.length <= 4
      ? teamCode
      : tricodeFromText(teamCode);
    const est = stripHtml(String(r.rDate ?? ""));
    const cleanEst =
      est && !/subscribers only/i.test(est) && est.toUpperCase() !== "TBD"
        ? est
        : null;
    out.push({
      player_name: player,
      team: teamCode,
      team_abbr: tricode,
      injury_type: String(r.injury ?? "—") || "—",
      status: normalizeStatus(String(r.status ?? "")),
      estimated_return: cleanEst,
      notes: stripHtml(String(r.comment ?? r.details ?? r.notes ?? "")),
      last_updated: new Date().toISOString(),
      source: "Rotowire",
    });
  }
  return out;
}

async function fetchRotowireNewsInjuries(): Promise<InjuryRecord[]> {
  // Secondary feed: Rotowire's EuroLeague injury news page. We only use it
  // to surface players Rotowire's table missed — never to fabricate return
  // dates. Items in the news feed render server-side, so we can parse HTML.
  const url = "https://www.rotowire.com/euro/news.php?view=injuries";
  let html = "";
  try {
    html = await fetch(url, { headers: HEADERS }).then((r) => r.text());
  } catch (e) {
    console.error("rotowire news fetch failed", e);
    return [];
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return [];
  const out: InjuryRecord[] = [];
  // News cards: each entry has a player link inside a header element.
  const links = doc.querySelectorAll('a[href^="/euro/player/"]');
  const seen = new Set<string>();
  links.forEach((a) => {
    const name = ((a as any).textContent ?? "").trim();
    if (!name || name.length < 3 || seen.has(name)) return;
    seen.add(name);
    // Walk up to the surrounding card to find team tricode + headline text.
    let node: any = a;
    for (let i = 0; i < 4 && node?.parentElement; i++) node = node.parentElement;
    const blockRaw = ((node as any)?.textContent ?? "").replace(/\s+/g, " ").trim();
    const block = blockRaw.toLowerCase();
    if (!/(injur|sidelined|out|miss|sprain|strain|surgery|sore|illness|rest)/.test(block)) return;
    const tricode = tricodeFromText(block) || tricodeFromText(name);
    if (!tricode) return;
    const status =
      /out for season|season-ending/.test(block) ? "Out"
      : /questionable|game-time/.test(block) ? "Questionable"
      : /probable/.test(block) ? "Probable"
      : /day-to-day|doubtful/.test(block) ? "Day-To-Day"
      : "Day-To-Day";
    // Try to detect injury body part from the headline.
    const injuryKeywords = [
      "knee","ankle","foot","hand","wrist","finger","thumb","shoulder","back",
      "hip","calf","hamstring","groin","quad","thigh","achilles","elbow",
      "concussion","illness","fever","flu","sprain","strain","fracture","surgery",
    ];
    const found = injuryKeywords.find((k) => block.includes(k));
    const injuryType = found ? found.charAt(0).toUpperCase() + found.slice(1) : "Pending update";
    // Trim notes to a single sentence around the player name for the tooltip.
    const notes = blockRaw.length > 240 ? blockRaw.slice(0, 240).trimEnd() + "…" : blockRaw;
    out.push({
      player_name: name,
      team: tricode,
      team_abbr: tricode,
      injury_type: injuryType,
      status,
      estimated_return: null,
      notes,
      last_updated: new Date().toISOString(),
      source: "Rotowire News",
    });
  });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sources_failed: string[] = [];
  const [rw, news] = await Promise.all([
    fetchRotowire().catch((e) => { sources_failed.push(`Rotowire: ${e.message}`); return [] as InjuryRecord[]; }),
    fetchRotowireNewsInjuries().catch((e) => { sources_failed.push(`Rotowire News: ${e.message}`); return [] as InjuryRecord[]; }),
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
  for (const r of news) {
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