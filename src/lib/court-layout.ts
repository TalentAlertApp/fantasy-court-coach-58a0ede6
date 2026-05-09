/**
 * Shared basketball court layout helper.
 * Returns absolute-positioned slot coordinates (top%/left%) for FC and BC rows
 * matching the visual formation used by RosterCourtView, TeamOfTheWeekModal,
 * and PlayerPickerDialog.
 *
 * Layouts:
 *   - 5 slots → spread evenly across the row (12%, 31%, 50%, 69%, 88%)
 *   - 3 slots → 20% / 50% / 80%
 *   - 2 slots → 33% / 67%
 *   - 4 slots → 17% / 39% / 61% / 83%
 *   - 1 slot  → 50%
 */
export function getRowPositions(count: number, topPct: string): { top: string; left: string }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ top: topPct, left: "50%" }];
  if (count === 2) {
    return [
      { top: topPct, left: "33%" },
      { top: topPct, left: "67%" },
    ];
  }
  if (count === 3) {
    return [
      { top: topPct, left: "20%" },
      { top: topPct, left: "50%" },
      { top: topPct, left: "80%" },
    ];
  }
  if (count === 4) {
    return [
      { top: topPct, left: "17%" },
      { top: topPct, left: "39%" },
      { top: topPct, left: "61%" },
      { top: topPct, left: "83%" },
    ];
  }
  // 5+ slots — evenly spaced
  return [
    { top: topPct, left: "12%" },
    { top: topPct, left: "31%" },
    { top: topPct, left: "50%" },
    { top: topPct, left: "69%" },
    { top: topPct, left: "88%" },
  ];
}

/**
 * Shared formation helper used by BOTH the Starting 5 court (RosterCourtView)
 * and the Team of the Week modal so they render with identical anchors.
 * Splits items into FC / BC rows and assigns row coordinates from
 * `getRowPositions`. Any leftover items (data anomalies) are placed into the
 * remaining slot pool to avoid silent drops.
 */
export function getCourtFormation<T>(
  items: T[],
  getFcBc: (item: T) => string,
  topFc: string = "28%",
  topBc: string = "72%",
): { item: T; style: { top: string; left: string } }[] {
  const fcs = items.filter((p) => getFcBc(p) === "FC");
  const bcs = items.filter((p) => getFcBc(p) === "BC");

  const fcPositions = getRowPositions(fcs.length, topFc);
  const bcPositions = getRowPositions(bcs.length, topBc);

  const positioned: { item: T; style: { top: string; left: string } }[] = [];

  fcs.forEach((p, i) => {
    if (i < fcPositions.length) positioned.push({ item: p, style: fcPositions[i] });
  });
  bcs.forEach((p, i) => {
    if (i < bcPositions.length) positioned.push({ item: p, style: bcPositions[i] });
  });

  if (positioned.length < items.length) {
    const used = new Set(positioned.map((pp) => pp.item));
    const remaining = items.filter((p) => !used.has(p));
    const allSpots = [...fcPositions, ...bcPositions];
    remaining.forEach((p, i) => {
      const idx = positioned.length + i;
      if (idx < allSpots.length) positioned.push({ item: p, style: allSpots[idx] });
    });
  }

  return positioned;
}
