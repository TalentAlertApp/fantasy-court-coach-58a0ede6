// supabase/functions/wnba-injury-report/index.ts
// Aggregates WNBA injury data from ESPN and RotoWire.
// Public endpoint (no JWT). Cached for 30 minutes.

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  "User-Agent": "Mozilla/5.0 (compatible; WNBAFantasyBot/1.0)",
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
  if (s.includes("personal")) return "Personal";
  return raw.trim();
}

async function fetchESPN(): Promise<InjuryRecord[]> {
  const url = "https://www.espn.com/wnba/injuries";
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

async function fetchRotoWire(): Promise<InjuryRecord[]> {
  const url = "https://www.rotowire.com/basketball/wnba-injury-report.php";
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
  "Personal": 6, "Suspended": 7,
};

function normalizeName(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildInjuryLabel(rec: InjuryRecord): string {
  const status = rec.status?.trim() || "Out";
  const type = rec.injury_type?.trim();
  if (type && type !== "—" && type.length <= 40) return `${status} — ${type}`;
  return status;
}

/** Map an InjuryRecord status to the normalized health code stored in players.injury.
 *  Allowed DB values: 'OUT' | 'Q' | 'DTD' | 'GTD' | 'PROB'. */
function toInjuryCode(rec: InjuryRecord): "OUT" | "Q" | "DTD" | "GTD" | "PROB" | null {
  const s = (rec.status ?? "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("out")) return "OUT";
  if (s.includes("suspend") || s.includes("personal") || s.includes("rest") ||
      s.includes("load manag") || s.includes("inactive")) return "OUT";
  if (s.includes("game-time") || s === "gtd") return "GTD";
  if (s.includes("day-to-day") || s === "dtd") return "DTD";
  if (s.includes("questionable") || s === "q") return "Q";
  if (s.includes("probable")) return "PROB";
  return "Q";
}

async function persistInjuriesToPlayers(
  injuries: InjuryRecord[],
): Promise<{ matched: number; cleared: number; skipped?: boolean } | null> {
  if (!injuries.length) return { matched: 0, cleared: 0, skipped: true };
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;

  const sb = createClient(url, key);
  const { data: league } = await sb.from("leagues").select("id").eq("code", "wnba").maybeSingle();
  if (!league?.id) return null;
  const leagueId = league.id as string;

  const { data: players } = await sb
    .from("players")
    .select("id, name, injury")
    .eq("league_id", leagueId);
  if (!players) return null;

  const byName = new Map<string, { id: number; injury: string | null }>();
  const byLastFirstInitial = new Map<string, { id: number; injury: string | null }>();
  for (const p of players as Array<{ id: number; name: string; injury: string | null }>) {
    if (!p.name) continue;
    const n = normalizeName(p.name);
    byName.set(n, { id: p.id, injury: p.injury });
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const k = `${parts[0][0]}.${parts[parts.length - 1]}`;
      if (!byLastFirstInitial.has(k)) byLastFirstInitial.set(k, { id: p.id, injury: p.injury });
    }
  }

  const matchedIds = new Set<number>();
  const updates: Array<{ id: number; code: string }> = [];
  const unmatched: string[] = [];
  for (const rec of injuries) {
    const norm = normalizeName(rec.player_name);
    let hit = byName.get(norm);
    if (!hit) {
      const parts = norm.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const k = `${parts[0][0]}.${parts[parts.length - 1]}`;
        hit = byLastFirstInitial.get(k);
      }
    }
    if (!hit) { unmatched.push(rec.player_name); continue; }
    if (matchedIds.has(hit.id)) continue;
    matchedIds.add(hit.id);
    const code = toInjuryCode(rec);
    if (!code) continue;
    if (hit.injury !== code) updates.push({ id: hit.id, code });
  }

  const toClear: number[] = [];
  for (const [, info] of byName) {
    if (!matchedIds.has(info.id) && info.injury != null && info.injury !== "") {
      toClear.push(info.id);
    }
  }

  let updateErrors = 0;
  let firstErr: string | null = null;
  const results = await Promise.all(
    updates.map((u) => sb.from("players").update({ injury: u.code }).eq("id", u.id)),
  );
  for (const r of results) {
    if ((r as any)?.error) {
      updateErrors++;
      if (!firstErr) firstErr = JSON.stringify((r as any).error);
    }
  }
  if (toClear.length) {
    const cr = await sb.from("players").update({ injury: null }).in("id", toClear);
    if ((cr as any)?.error && !firstErr) firstErr = JSON.stringify((cr as any).error);
  }
  console.log(
    `[wnba-injury-report] persist: matched=${matchedIds.size} updates=${updates.length} cleared=${toClear.length} unmatched=${unmatched.length} updateErrors=${updateErrors}` +
    (firstErr ? ` firstErr=${firstErr}` : "") +
    (unmatched.length ? ` sample=${unmatched.slice(0, 5).join("|")}` : ""),
  );
  return { matched: updates.length, cleared: toClear.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const results = await Promise.allSettled([fetchESPN(), fetchRotoWire()]);
    const all: InjuryRecord[] = [];
    const errors: string[] = [];
    const sourceLabels = ["ESPN", "RotoWire"];

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

    let persisted: { matched: number; cleared: number; skipped?: boolean } | null = null;
    try {
      persisted = await persistInjuriesToPlayers(injuries);
    } catch (e) {
      console.error("persistInjuriesToPlayers failed:", e);
    }

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        total_players: injuries.length,
        sources_failed: errors.length ? errors : undefined,
        persisted,
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