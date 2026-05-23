import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameActionLinks from "./GameActionLinks";

interface Fixture {
  league: "nba" | "wnba" | "euroleague";
  boxscoreUrl: string;
  chartsUrl: string;
  playByPlayUrl: string;
  leagueGameUrl: string;
  leagueLabel: string;
}

const FIXTURES: Fixture[] = [
  {
    league: "nba",
    boxscoreUrl: "https://www.nba.com/game/dal-vs-lac-0022501156/box-score",
    chartsUrl: "https://www.nba.com/game/dal-vs-lac-0022501156/game-charts",
    playByPlayUrl:
      "https://www.nba.com/game/dal-vs-lac-0022501156/play-by-play?latest=0",
    leagueGameUrl: "https://www.nba.com/game/dal-vs-lac-0022501156",
    leagueLabel: "NBA",
  },
  {
    league: "wnba",
    boxscoreUrl: "https://www.wnba.com/game/nyl-vs-min-1022500050/box-score",
    chartsUrl: "https://www.wnba.com/game/nyl-vs-min-1022500050/game-charts",
    playByPlayUrl:
      "https://www.wnba.com/game/nyl-vs-min-1022500050/play-by-play",
    leagueGameUrl: "https://www.wnba.com/game/nyl-vs-min-1022500050",
    leagueLabel: "WNBA",
  },
  {
    league: "euroleague",
    boxscoreUrl:
      "https://www.euroleaguebasketball.net/en/euroleague/game-center/2025-26/zalgiris-kaunas-fc-bayern-munich/E2025/329/#box-score",
    chartsUrl:
      "https://www.euroleaguebasketball.net/en/euroleague/game-center/2025-26/zalgiris-kaunas-fc-bayern-munich/E2025/329/#shooting-chart",
    playByPlayUrl:
      "https://www.euroleaguebasketball.net/en/euroleague/game-center/2025-26/zalgiris-kaunas-fc-bayern-munich/E2025/329/#play-by-play",
    leagueGameUrl:
      "https://www.euroleaguebasketball.net/en/euroleague/game-center/2025-26/zalgiris-kaunas-fc-bayern-munich/E2025/329/",
    leagueLabel: "EuroLeague",
  },
];

describe("GameActionLinks", () => {
  for (const fx of FIXTURES) {
    describe(`${fx.leagueLabel}`, () => {
      it("wires BoxScore / Charts / PbP / league anchors to the exact dataset URLs", () => {
        render(
          <GameActionLinks
            league={fx.league}
            boxscoreUrl={fx.boxscoreUrl}
            chartsUrl={fx.chartsUrl}
            playByPlayUrl={fx.playByPlayUrl}
            leagueGameUrl={fx.leagueGameUrl}
          />,
        );

        const box = screen.getByTestId("game-link-boxscore") as HTMLAnchorElement;
        const charts = screen.getByTestId("game-link-charts") as HTMLAnchorElement;
        const pbp = screen.getByTestId("game-link-pbp") as HTMLAnchorElement;
        const lg = screen.getByTestId("game-link-league") as HTMLAnchorElement;

        expect(box.getAttribute("href")).toBe(fx.boxscoreUrl);
        expect(charts.getAttribute("href")).toBe(fx.chartsUrl);
        expect(pbp.getAttribute("href")).toBe(fx.playByPlayUrl);
        expect(lg.getAttribute("href")).toBe(fx.leagueGameUrl);
        for (const a of [box, charts, pbp, lg]) {
          expect(a.getAttribute("target")).toBe("_blank");
          expect(a.getAttribute("rel")).toBe("noreferrer");
        }
        expect(lg.textContent).toContain(fx.leagueLabel);
      });

      it("omits a button when its dataset URL is missing", () => {
        render(
          <GameActionLinks
            league={fx.league}
            boxscoreUrl={fx.boxscoreUrl}
            chartsUrl={null}
            playByPlayUrl={undefined}
            leagueGameUrl={fx.leagueGameUrl}
          />,
        );
        expect(screen.getByTestId("game-link-boxscore")).toBeInTheDocument();
        expect(screen.queryByTestId("game-link-charts")).toBeNull();
        expect(screen.queryByTestId("game-link-pbp")).toBeNull();
        expect(screen.getByTestId("game-link-league")).toBeInTheDocument();
      });
    });
  }
});
