import { describe, it, expect } from "vitest";
import {
  COMPETITIONS,
  ALL_COMPETITIONS,
  FANTASY_COMPETITIONS,
  getCompetition,
  tryGetCompetition,
  isKnownCompetition,
} from "@/lib/competitions";

describe("competitions registry", () => {
  it("exposes nba, wnba and euroleague", () => {
    expect(Object.keys(COMPETITIONS).sort()).toEqual(["euroleague", "nba", "wnba"]);
    expect(ALL_COMPETITIONS).toHaveLength(3);
    expect(FANTASY_COMPETITIONS).toHaveLength(3);
  });

  it("EuroLeague has the expected flags", () => {
    const el = COMPETITIONS.euroleague;
    expect(el.label).toBe("EuroLeague");
    expect(el.shortLabel).toBe("EL");
    expect(el.season).toBe("2025-26");
    expect(el.standingsMode).toBe("single_table");
    expect(el.hasAdvancedPlaySearch).toBe(false);
    expect(el.hasConferences).toBe(false);
    expect(el.hasDivisions).toBe(false);
    expect(el.fantasyEnabled).toBe(true);
  });

  it("NBA and WNBA flags are unchanged", () => {
    expect(COMPETITIONS.nba.standingsMode).toBe("conference_division");
    expect(COMPETITIONS.nba.hasAdvancedPlaySearch).toBe(true);
    expect(COMPETITIONS.wnba.standingsMode).toBe("conference_only");
    expect(COMPETITIONS.wnba.hasAdvancedPlaySearch).toBe(true);
  });

  it("isKnownCompetition matches only the three codes", () => {
    expect(isKnownCompetition("nba")).toBe(true);
    expect(isKnownCompetition("wnba")).toBe(true);
    expect(isKnownCompetition("euroleague")).toBe(true);
    expect(isKnownCompetition("nfl")).toBe(false);
    expect(isKnownCompetition(null)).toBe(false);
    expect(isKnownCompetition(undefined)).toBe(false);
  });

  it("getCompetition throws on unknown codes (no NBA fallback)", () => {
    expect(() => getCompetition("nfl" as any)).toThrow(/Unknown competition/);
    expect(() => getCompetition(null)).toThrow(/Unknown competition/);
    expect(getCompetition("euroleague").code).toBe("euroleague");
  });

  it("tryGetCompetition returns null on unknown codes", () => {
    expect(tryGetCompetition("xyz")).toBeNull();
    expect(tryGetCompetition("nba")?.code).toBe("nba");
  });
});
