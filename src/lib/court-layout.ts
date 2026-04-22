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
