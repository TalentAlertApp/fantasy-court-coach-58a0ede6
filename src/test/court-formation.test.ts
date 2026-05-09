import { describe, it, expect } from "vitest";
import { getCourtFormation, getRowPositions } from "@/lib/court-layout";

type P = { id: number; fc_bc: "FC" | "BC" };
const fc = (id: number): P => ({ id, fc_bc: "FC" });
const bc = (id: number): P => ({ id, fc_bc: "BC" });

describe("getCourtFormation — TOTW mirrors Starting 5 court", () => {
  it("3 FC + 2 BC: FC anchored at 28% row, BC at 72% row", () => {
    const players = [fc(1), fc(2), fc(3), bc(4), bc(5)];
    const out = getCourtFormation(players, (p) => p.fc_bc);
    const expectedFc = getRowPositions(3, "28%");
    const expectedBc = getRowPositions(2, "72%");
    expect(out.map((o) => o.style)).toEqual([...expectedFc, ...expectedBc]);
    expect(out.map((o) => o.item.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("2 FC + 3 BC: FC anchored at 28% row, BC at 72% row", () => {
    const players = [fc(1), fc(2), bc(3), bc(4), bc(5)];
    const out = getCourtFormation(players, (p) => p.fc_bc);
    const expectedFc = getRowPositions(2, "28%");
    const expectedBc = getRowPositions(3, "72%");
    expect(out.map((o) => o.style)).toEqual([...expectedFc, ...expectedBc]);
    expect(out.map((o) => o.item.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("matches the exact Starting 5 coordinates the RosterCourtView consumes", () => {
    // 3 FC row → 20/50/80, 2 BC row → 33/67. Lock the contract so visual
    // parity with /MY ROSTER cannot silently drift.
    const out = getCourtFormation([fc(1), fc(2), fc(3), bc(4), bc(5)], (p) => p.fc_bc);
    expect(out.map((o) => o.style)).toEqual([
      { top: "28%", left: "20%" },
      { top: "28%", left: "50%" },
      { top: "28%", left: "80%" },
      { top: "72%", left: "33%" },
      { top: "72%", left: "67%" },
    ]);

    const out2 = getCourtFormation([fc(1), fc(2), bc(3), bc(4), bc(5)], (p) => p.fc_bc);
    expect(out2.map((o) => o.style)).toEqual([
      { top: "28%", left: "33%" },
      { top: "28%", left: "67%" },
      { top: "72%", left: "20%" },
      { top: "72%", left: "50%" },
      { top: "72%", left: "80%" },
    ]);
  });
});