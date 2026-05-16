/**
 * Static deadline lookup for every Gameweek/Day in the 2025-26 NBA Fantasy season.
 * Times are UTC. Season: Oct-Dec 2025, Jan-Apr 2026.
 */

export interface Deadline {
  gw: number;
  day: number;
  deadline_utc: string; // ISO 8601
}

export const DEADLINES: Deadline[] = [
  // GW1
  { gw: 1, day: 1, deadline_utc: "2025-10-21T23:00:00Z" },
  { gw: 1, day: 2, deadline_utc: "2025-10-22T22:30:00Z" },
  { gw: 1, day: 3, deadline_utc: "2025-10-23T23:00:00Z" },
  { gw: 1, day: 4, deadline_utc: "2025-10-24T22:30:00Z" },
  { gw: 1, day: 5, deadline_utc: "2025-10-25T22:30:00Z" },
  { gw: 1, day: 6, deadline_utc: "2025-10-26T16:30:00Z" },
  // GW2
  { gw: 2, day: 1, deadline_utc: "2025-10-27T21:30:00Z" },
  { gw: 2, day: 2, deadline_utc: "2025-10-28T21:30:00Z" },
  { gw: 2, day: 3, deadline_utc: "2025-10-29T21:00:00Z" },
  { gw: 2, day: 4, deadline_utc: "2025-10-30T21:30:00Z" },
  { gw: 2, day: 5, deadline_utc: "2025-10-31T21:30:00Z" },
  { gw: 2, day: 6, deadline_utc: "2025-11-01T19:30:00Z" },
  { gw: 2, day: 7, deadline_utc: "2025-11-02T19:00:00Z" },
  // GW3
  { gw: 3, day: 1, deadline_utc: "2025-11-03T22:30:00Z" },
  { gw: 3, day: 2, deadline_utc: "2025-11-04T23:00:00Z" },
  { gw: 3, day: 3, deadline_utc: "2025-11-05T22:30:00Z" },
  { gw: 3, day: 4, deadline_utc: "2025-11-07T00:30:00Z" },
  { gw: 3, day: 5, deadline_utc: "2025-11-07T22:30:00Z" },
  { gw: 3, day: 6, deadline_utc: "2025-11-08T22:30:00Z" },
  { gw: 3, day: 7, deadline_utc: "2025-11-09T19:00:00Z" },
  // GW4
  { gw: 4, day: 1, deadline_utc: "2025-11-10T22:30:00Z" },
  { gw: 4, day: 2, deadline_utc: "2025-11-11T23:00:00Z" },
  { gw: 4, day: 3, deadline_utc: "2025-11-12T22:30:00Z" },
  { gw: 4, day: 4, deadline_utc: "2025-11-13T22:30:00Z" },
  { gw: 4, day: 5, deadline_utc: "2025-11-14T22:30:00Z" },
  { gw: 4, day: 6, deadline_utc: "2025-11-15T20:30:00Z" },
  { gw: 4, day: 7, deadline_utc: "2025-11-16T19:00:00Z" },
  // GW5
  { gw: 5, day: 1, deadline_utc: "2025-11-17T22:30:00Z" },
  { gw: 5, day: 2, deadline_utc: "2025-11-18T22:30:00Z" },
  { gw: 5, day: 3, deadline_utc: "2025-11-19T22:30:00Z" },
  { gw: 5, day: 4, deadline_utc: "2025-11-20T22:30:00Z" },
  { gw: 5, day: 5, deadline_utc: "2025-11-21T22:30:00Z" },
  { gw: 5, day: 6, deadline_utc: "2025-11-22T16:30:00Z" },
  { gw: 5, day: 7, deadline_utc: "2025-11-23T16:30:00Z" },
  // GW6
  { gw: 6, day: 1, deadline_utc: "2025-11-24T22:30:00Z" },
  { gw: 6, day: 2, deadline_utc: "2025-11-25T22:30:00Z" },
  { gw: 6, day: 3, deadline_utc: "2025-11-26T20:30:00Z" },
  { gw: 6, day: 4, deadline_utc: "2025-11-28T23:00:00Z" },
  { gw: 6, day: 5, deadline_utc: "2025-11-29T20:30:00Z" },
  { gw: 6, day: 6, deadline_utc: "2025-11-30T18:30:00Z" },
  // GW7
  { gw: 7, day: 1, deadline_utc: "2025-12-01T22:30:00Z" },
  { gw: 7, day: 2, deadline_utc: "2025-12-02T22:30:00Z" },
  { gw: 7, day: 3, deadline_utc: "2025-12-03T22:30:00Z" },
  { gw: 7, day: 4, deadline_utc: "2025-12-04T22:30:00Z" },
  { gw: 7, day: 5, deadline_utc: "2025-12-05T22:30:00Z" },
  { gw: 7, day: 6, deadline_utc: "2025-12-06T20:30:00Z" },
  { gw: 7, day: 7, deadline_utc: "2025-12-07T15:30:00Z" },
  // GW8
  { gw: 8, day: 1, deadline_utc: "2025-12-08T22:30:00Z" },
  { gw: 8, day: 2, deadline_utc: "2025-12-09T21:30:00Z" },
  { gw: 8, day: 3, deadline_utc: "2025-12-10T23:00:00Z" },
  { gw: 8, day: 4, deadline_utc: "2025-12-11T23:30:00Z" },
  { gw: 8, day: 5, deadline_utc: "2025-12-12T22:30:00Z" },
  { gw: 8, day: 6, deadline_utc: "2025-12-13T21:00:00Z" },
  { gw: 8, day: 7, deadline_utc: "2025-12-14T18:30:00Z" },
  // GW9
  { gw: 9, day: 1, deadline_utc: "2025-12-15T22:30:00Z" },
  { gw: 9, day: 2, deadline_utc: "2025-12-17T23:30:00Z" },
  { gw: 9, day: 3, deadline_utc: "2025-12-18T22:30:00Z" },
  { gw: 9, day: 4, deadline_utc: "2025-12-19T22:30:00Z" },
  { gw: 9, day: 5, deadline_utc: "2025-12-20T20:30:00Z" },
  { gw: 9, day: 6, deadline_utc: "2025-12-21T19:00:00Z" },
  // GW10
  { gw: 10, day: 1, deadline_utc: "2025-12-22T22:30:00Z" },
  { gw: 10, day: 2, deadline_utc: "2025-12-23T22:30:00Z" },
  { gw: 10, day: 3, deadline_utc: "2025-12-25T15:30:00Z" },
  { gw: 10, day: 4, deadline_utc: "2025-12-26T22:30:00Z" },
  { gw: 10, day: 5, deadline_utc: "2025-12-27T20:30:00Z" },
  { gw: 10, day: 6, deadline_utc: "2025-12-28T19:00:00Z" },
  // GW11
  { gw: 11, day: 1, deadline_utc: "2025-12-29T22:30:00Z" },
  { gw: 11, day: 2, deadline_utc: "2025-12-30T23:30:00Z" },
  { gw: 11, day: 3, deadline_utc: "2025-12-31T16:30:00Z" },
  { gw: 11, day: 4, deadline_utc: "2026-01-01T21:30:00Z" },
  { gw: 11, day: 5, deadline_utc: "2026-01-02T22:30:00Z" },
  { gw: 11, day: 6, deadline_utc: "2026-01-03T20:30:00Z" },
  { gw: 11, day: 7, deadline_utc: "2026-01-04T17:30:00Z" },
  // GW12
  { gw: 12, day: 1, deadline_utc: "2026-01-05T22:30:00Z" },
  { gw: 12, day: 2, deadline_utc: "2026-01-06T22:30:00Z" },
  { gw: 12, day: 3, deadline_utc: "2026-01-07T22:30:00Z" },
  { gw: 12, day: 4, deadline_utc: "2026-01-08T22:30:00Z" },
  { gw: 12, day: 5, deadline_utc: "2026-01-09T22:30:00Z" },
  { gw: 12, day: 6, deadline_utc: "2026-01-10T16:30:00Z" },
  { gw: 12, day: 7, deadline_utc: "2026-01-11T18:30:00Z" },
  // GW13
  { gw: 13, day: 1, deadline_utc: "2026-01-12T22:30:00Z" },
  { gw: 13, day: 2, deadline_utc: "2026-01-13T23:00:00Z" },
  { gw: 13, day: 3, deadline_utc: "2026-01-14T22:30:00Z" },
  { gw: 13, day: 4, deadline_utc: "2026-01-15T17:30:00Z" },
  { gw: 13, day: 5, deadline_utc: "2026-01-16T22:30:00Z" },
  { gw: 13, day: 6, deadline_utc: "2026-01-17T20:30:00Z" },
  { gw: 13, day: 7, deadline_utc: "2026-01-18T15:30:00Z" },
  // GW14
  { gw: 14, day: 1, deadline_utc: "2026-01-19T16:30:00Z" },
  { gw: 14, day: 2, deadline_utc: "2026-01-20T22:30:00Z" },
  { gw: 14, day: 3, deadline_utc: "2026-01-21T22:30:00Z" },
  { gw: 14, day: 4, deadline_utc: "2026-01-22T22:30:00Z" },
  { gw: 14, day: 5, deadline_utc: "2026-01-23T22:30:00Z" },
  { gw: 14, day: 6, deadline_utc: "2026-01-24T15:30:00Z" },
  { gw: 14, day: 7, deadline_utc: "2026-01-25T18:30:00Z" },
  // GW15
  { gw: 15, day: 1, deadline_utc: "2026-01-26T17:00:00Z" },
  { gw: 15, day: 2, deadline_utc: "2026-01-27T22:30:00Z" },
  { gw: 15, day: 3, deadline_utc: "2026-01-28T22:30:00Z" },
  { gw: 15, day: 4, deadline_utc: "2026-01-29T22:30:00Z" },
  { gw: 15, day: 5, deadline_utc: "2026-01-30T22:30:00Z" },
  { gw: 15, day: 6, deadline_utc: "2026-01-31T15:30:00Z" },
  { gw: 15, day: 7, deadline_utc: "2026-02-01T19:00:00Z" },
  // GW16
  { gw: 16, day: 1, deadline_utc: "2026-02-02T18:30:00Z" },
  { gw: 16, day: 2, deadline_utc: "2026-02-03T22:30:00Z" },
  { gw: 16, day: 3, deadline_utc: "2026-02-04T22:30:00Z" },
  { gw: 16, day: 4, deadline_utc: "2026-02-05T22:30:00Z" },
  { gw: 16, day: 5, deadline_utc: "2026-02-06T23:00:00Z" },
  { gw: 16, day: 6, deadline_utc: "2026-02-07T18:30:00Z" },
  { gw: 16, day: 7, deadline_utc: "2026-02-08T16:00:00Z" },
  // GW17
  { gw: 17, day: 1, deadline_utc: "2026-02-09T22:30:00Z" },
  { gw: 17, day: 2, deadline_utc: "2026-02-10T23:00:00Z" },
  { gw: 17, day: 3, deadline_utc: "2026-02-11T22:30:00Z" },
  { gw: 17, day: 4, deadline_utc: "2026-02-12T23:00:00Z" },
  // GW18
  { gw: 18, day: 1, deadline_utc: "2026-02-19T22:30:00Z" },
  { gw: 18, day: 2, deadline_utc: "2026-02-20T22:30:00Z" },
  { gw: 18, day: 3, deadline_utc: "2026-02-21T20:30:00Z" },
  { gw: 18, day: 4, deadline_utc: "2026-02-22T16:30:00Z" },
  // GW19
  { gw: 19, day: 1, deadline_utc: "2026-02-23T22:30:00Z" },
  { gw: 19, day: 2, deadline_utc: "2026-02-23T22:30:00Z" },
  { gw: 19, day: 3, deadline_utc: "2026-02-24T22:30:00Z" },
  { gw: 19, day: 4, deadline_utc: "2026-02-25T22:30:00Z" },
  { gw: 19, day: 5, deadline_utc: "2026-02-26T22:30:00Z" },
  { gw: 19, day: 6, deadline_utc: "2026-02-27T22:30:00Z" },
  { gw: 19, day: 7, deadline_utc: "2026-02-28T22:30:00Z" },
  // GW20
  { gw: 20, day: 1, deadline_utc: "2026-03-02T22:30:00Z" },
  { gw: 20, day: 2, deadline_utc: "2026-03-02T23:30:00Z" },
  { gw: 20, day: 3, deadline_utc: "2026-03-03T23:30:00Z" },
  { gw: 20, day: 4, deadline_utc: "2026-03-05T22:30:00Z" },
  { gw: 20, day: 5, deadline_utc: "2026-03-06T22:30:00Z" },
  { gw: 20, day: 6, deadline_utc: "2026-03-07T18:30:00Z" },
  { gw: 20, day: 7, deadline_utc: "2026-03-08T15:30:00Z" },
  // GW21
  { gw: 21, day: 1, deadline_utc: "2026-03-09T21:30:00Z" },
  { gw: 21, day: 2, deadline_utc: "2026-03-10T21:30:00Z" },
  { gw: 21, day: 3, deadline_utc: "2026-03-11T22:00:00Z" },
  { gw: 21, day: 4, deadline_utc: "2026-03-12T21:30:00Z" },
  { gw: 21, day: 5, deadline_utc: "2026-03-13T22:00:00Z" },
  { gw: 21, day: 6, deadline_utc: "2026-03-14T15:30:00Z" },
  { gw: 21, day: 7, deadline_utc: "2026-03-15T15:30:00Z" },
  // GW22
  { gw: 22, day: 1, deadline_utc: "2026-03-16T21:30:00Z" },
  { gw: 22, day: 2, deadline_utc: "2026-03-17T21:30:00Z" },
  { gw: 22, day: 3, deadline_utc: "2026-03-18T21:30:00Z" },
  { gw: 22, day: 4, deadline_utc: "2026-03-19T21:30:00Z" },
  { gw: 22, day: 5, deadline_utc: "2026-03-20T22:00:00Z" },
  { gw: 22, day: 6, deadline_utc: "2026-03-21T19:30:00Z" },
  { gw: 22, day: 7, deadline_utc: "2026-03-22T19:30:00Z" },
  // GW23
  { gw: 23, day: 1, deadline_utc: "2026-03-23T21:30:00Z" },
  { gw: 23, day: 2, deadline_utc: "2026-03-24T21:30:00Z" },
  { gw: 23, day: 3, deadline_utc: "2026-03-25T21:30:00Z" },
  { gw: 23, day: 4, deadline_utc: "2026-03-26T21:30:00Z" },
  { gw: 23, day: 5, deadline_utc: "2026-03-27T21:30:00Z" },
  { gw: 23, day: 6, deadline_utc: "2026-03-28T17:30:00Z" },
  { gw: 23, day: 7, deadline_utc: "2026-03-29T19:00:00Z" },
  // GW24
  { gw: 24, day: 1, deadline_utc: "2026-03-30T22:30:00Z" },
  { gw: 24, day: 2, deadline_utc: "2026-03-31T22:30:00Z" },
  { gw: 24, day: 3, deadline_utc: "2026-04-01T22:30:00Z" },
  { gw: 24, day: 4, deadline_utc: "2026-04-02T22:30:00Z" },
  { gw: 24, day: 5, deadline_utc: "2026-04-03T22:30:00Z" },
  { gw: 24, day: 6, deadline_utc: "2026-04-04T18:30:00Z" },
  { gw: 24, day: 7, deadline_utc: "2026-04-05T19:00:00Z" },
  // GW25
  { gw: 25, day: 1, deadline_utc: "2026-04-06T22:30:00Z" },
  { gw: 25, day: 2, deadline_utc: "2026-04-07T22:30:00Z" },
  { gw: 25, day: 3, deadline_utc: "2026-04-08T22:30:00Z" },
  { gw: 25, day: 4, deadline_utc: "2026-04-09T22:30:00Z" },
  { gw: 25, day: 5, deadline_utc: "2026-04-10T23:30:00Z" },
  { gw: 25, day: 6, deadline_utc: "2026-04-12T00:00:00Z" },
];

/**
 * Returns the current gameday based on UTC now.
 * Finds the first deadline that hasn't passed yet.
 */
export function getCurrentGameday(): Deadline {
  const now = new Date();
  const current = DEADLINES.find((d) => new Date(d.deadline_utc) > now);
  return current ?? DEADLINES[DEADLINES.length - 1];
}

/**
 * Returns the number of gamedays remaining in the current gameweek
 * (deadlines whose UTC time is still in the future, same gw as current).
 */
export function getGamedaysRemaining(): number {
  const now = new Date();
  const current = getCurrentGameday();
  return DEADLINES.filter(
    (d) => d.gw === current.gw && new Date(d.deadline_utc) > now
  ).length;
}

/**
 * Format a deadline_utc string as "Mon 9 Mar 22:30" style.
 */
export function formatDeadline(utc: string): string {
  const d = new Date(utc);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(d);
}

/**
 * Get total days in a gameweek.
 */
export function getTotalDaysInGameweek(gw: number): number {
  return DEADLINES.filter((d) => d.gw === gw).length;
}
