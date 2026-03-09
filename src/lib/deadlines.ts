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
  // GW1 (Lisbon UTC+1 until Oct 26)
  { gw: 1, day: 1, deadline_utc: "2025-10-21T23:00:00Z" },
  { gw: 1, day: 2, deadline_utc: "2025-10-22T22:30:00Z" },
  { gw: 1, day: 3, deadline_utc: "2025-10-23T23:00:00Z" },
  { gw: 1, day: 4, deadline_utc: "2025-10-24T23:00:00Z" },
  { gw: 1, day: 5, deadline_utc: "2025-10-25T22:30:00Z" },
  { gw: 1, day: 6, deadline_utc: "2025-10-26T16:30:00Z" },
  // GW2
  { gw: 2, day: 1, deadline_utc: "2025-10-27T22:30:00Z" },
  { gw: 2, day: 2, deadline_utc: "2025-10-28T22:30:00Z" },
  { gw: 2, day: 3, deadline_utc: "2025-10-29T22:30:00Z" },
  { gw: 2, day: 4, deadline_utc: "2025-10-30T22:30:00Z" },
  { gw: 2, day: 5, deadline_utc: "2025-10-31T22:30:00Z" },
  { gw: 2, day: 6, deadline_utc: "2025-11-01T20:30:00Z" },
  { gw: 2, day: 7, deadline_utc: "2025-11-02T20:00:00Z" },
  // GW3
  { gw: 3, day: 1, deadline_utc: "2025-11-03T23:30:00Z" },
  { gw: 3, day: 2, deadline_utc: "2025-11-05T00:00:00Z" },
  { gw: 3, day: 3, deadline_utc: "2025-11-05T23:30:00Z" },
  { gw: 3, day: 4, deadline_utc: "2025-11-07T01:30:00Z" },
  { gw: 3, day: 5, deadline_utc: "2025-11-07T23:30:00Z" },
  { gw: 3, day: 6, deadline_utc: "2025-11-08T23:30:00Z" },
  { gw: 3, day: 7, deadline_utc: "2025-11-09T20:00:00Z" },
  // GW4
  { gw: 4, day: 1, deadline_utc: "2025-11-10T23:30:00Z" },
  { gw: 4, day: 2, deadline_utc: "2025-11-12T00:00:00Z" },
  { gw: 4, day: 3, deadline_utc: "2025-11-12T23:30:00Z" },
  { gw: 4, day: 4, deadline_utc: "2025-11-13T23:30:00Z" },
  { gw: 4, day: 5, deadline_utc: "2025-11-14T23:30:00Z" },
  { gw: 4, day: 6, deadline_utc: "2025-11-15T21:30:00Z" },
  { gw: 4, day: 7, deadline_utc: "2025-11-16T20:00:00Z" },
  // GW5
  { gw: 5, day: 1, deadline_utc: "2025-11-17T23:30:00Z" },
  { gw: 5, day: 2, deadline_utc: "2025-11-18T23:30:00Z" },
  { gw: 5, day: 3, deadline_utc: "2025-11-19T23:30:00Z" },
  { gw: 5, day: 4, deadline_utc: "2025-11-20T23:30:00Z" },
  { gw: 5, day: 5, deadline_utc: "2025-11-21T23:30:00Z" },
  { gw: 5, day: 6, deadline_utc: "2025-11-22T17:30:00Z" },
  { gw: 5, day: 7, deadline_utc: "2025-11-23T17:30:00Z" },
  // GW6
  { gw: 6, day: 1, deadline_utc: "2025-11-24T23:30:00Z" },
  { gw: 6, day: 2, deadline_utc: "2025-11-25T23:30:00Z" },
  { gw: 6, day: 3, deadline_utc: "2025-11-26T21:30:00Z" },
  { gw: 6, day: 4, deadline_utc: "2025-11-29T00:00:00Z" },
  { gw: 6, day: 5, deadline_utc: "2025-11-29T21:30:00Z" },
  { gw: 6, day: 6, deadline_utc: "2025-11-30T19:30:00Z" },
  // GW7
  { gw: 7, day: 1, deadline_utc: "2025-12-01T23:30:00Z" },
  { gw: 7, day: 2, deadline_utc: "2025-12-02T23:30:00Z" },
  { gw: 7, day: 3, deadline_utc: "2025-12-03T23:30:00Z" },
  { gw: 7, day: 4, deadline_utc: "2025-12-04T23:30:00Z" },
  { gw: 7, day: 5, deadline_utc: "2025-12-05T23:30:00Z" },
  { gw: 7, day: 6, deadline_utc: "2025-12-06T21:30:00Z" },
  { gw: 7, day: 7, deadline_utc: "2025-12-07T16:30:00Z" },
  // GW8
  { gw: 8, day: 1, deadline_utc: "2025-12-08T23:30:00Z" },
  { gw: 8, day: 2, deadline_utc: "2025-12-09T22:30:00Z" },
  { gw: 8, day: 3, deadline_utc: "2025-12-11T00:00:00Z" },
  { gw: 8, day: 4, deadline_utc: "2025-12-12T00:30:00Z" },
  { gw: 8, day: 5, deadline_utc: "2025-12-12T23:30:00Z" },
  { gw: 8, day: 6, deadline_utc: "2025-12-13T22:00:00Z" },
  { gw: 8, day: 7, deadline_utc: "2025-12-14T19:30:00Z" },
  // GW9
  { gw: 9, day: 1, deadline_utc: "2025-12-15T23:30:00Z" },
  { gw: 9, day: 2, deadline_utc: "2025-12-18T00:30:00Z" },
  { gw: 9, day: 3, deadline_utc: "2025-12-18T23:30:00Z" },
  { gw: 9, day: 4, deadline_utc: "2025-12-19T23:30:00Z" },
  { gw: 9, day: 5, deadline_utc: "2025-12-20T21:30:00Z" },
  { gw: 9, day: 6, deadline_utc: "2025-12-21T20:00:00Z" },
  // GW10
  { gw: 10, day: 1, deadline_utc: "2025-12-22T23:30:00Z" },
  { gw: 10, day: 2, deadline_utc: "2025-12-23T23:30:00Z" },
  { gw: 10, day: 3, deadline_utc: "2025-12-25T16:30:00Z" },
  { gw: 10, day: 4, deadline_utc: "2025-12-26T23:30:00Z" },
  { gw: 10, day: 5, deadline_utc: "2025-12-27T21:30:00Z" },
  { gw: 10, day: 6, deadline_utc: "2025-12-28T20:00:00Z" },
  // GW11
  { gw: 11, day: 1, deadline_utc: "2025-12-29T23:30:00Z" },
  { gw: 11, day: 2, deadline_utc: "2025-12-31T00:30:00Z" },
  { gw: 11, day: 3, deadline_utc: "2025-12-31T17:30:00Z" },
  { gw: 11, day: 4, deadline_utc: "2026-01-01T22:30:00Z" },
  { gw: 11, day: 5, deadline_utc: "2026-01-02T23:30:00Z" },
  { gw: 11, day: 6, deadline_utc: "2026-01-03T21:30:00Z" },
  { gw: 11, day: 7, deadline_utc: "2026-01-04T18:30:00Z" },
  // GW12
  { gw: 12, day: 1, deadline_utc: "2026-01-05T23:30:00Z" },
  { gw: 12, day: 2, deadline_utc: "2026-01-06T23:30:00Z" },
  { gw: 12, day: 3, deadline_utc: "2026-01-07T23:30:00Z" },
  { gw: 12, day: 4, deadline_utc: "2026-01-08T23:30:00Z" },
  { gw: 12, day: 5, deadline_utc: "2026-01-09T23:30:00Z" },
  { gw: 12, day: 6, deadline_utc: "2026-01-10T17:30:00Z" },
  { gw: 12, day: 7, deadline_utc: "2026-01-11T19:30:00Z" },
  // GW13
  { gw: 13, day: 1, deadline_utc: "2026-01-12T23:30:00Z" },
  { gw: 13, day: 2, deadline_utc: "2026-01-14T00:00:00Z" },
  { gw: 13, day: 3, deadline_utc: "2026-01-14T23:30:00Z" },
  { gw: 13, day: 4, deadline_utc: "2026-01-15T18:30:00Z" },
  { gw: 13, day: 5, deadline_utc: "2026-01-16T23:30:00Z" },
  { gw: 13, day: 6, deadline_utc: "2026-01-17T21:30:00Z" },
  { gw: 13, day: 7, deadline_utc: "2026-01-18T16:30:00Z" },
  // GW14
  { gw: 14, day: 1, deadline_utc: "2026-01-19T17:30:00Z" },
  { gw: 14, day: 2, deadline_utc: "2026-01-20T23:30:00Z" },
  { gw: 14, day: 3, deadline_utc: "2026-01-21T23:30:00Z" },
  { gw: 14, day: 4, deadline_utc: "2026-01-22T23:30:00Z" },
  { gw: 14, day: 5, deadline_utc: "2026-01-23T23:30:00Z" },
  { gw: 14, day: 6, deadline_utc: "2026-01-24T16:30:00Z" },
  { gw: 14, day: 7, deadline_utc: "2026-01-25T19:30:00Z" },
  // GW15
  { gw: 15, day: 1, deadline_utc: "2026-01-26T18:00:00Z" },
  { gw: 15, day: 2, deadline_utc: "2026-01-27T23:30:00Z" },
  { gw: 15, day: 3, deadline_utc: "2026-01-28T23:30:00Z" },
  { gw: 15, day: 4, deadline_utc: "2026-01-29T23:30:00Z" },
  { gw: 15, day: 5, deadline_utc: "2026-01-30T23:30:00Z" },
  { gw: 15, day: 6, deadline_utc: "2026-01-31T16:30:00Z" },
  { gw: 15, day: 7, deadline_utc: "2026-02-01T20:00:00Z" },
  // GW16
  { gw: 16, day: 1, deadline_utc: "2026-02-02T19:30:00Z" },
  { gw: 16, day: 2, deadline_utc: "2026-02-03T23:30:00Z" },
  { gw: 16, day: 3, deadline_utc: "2026-02-04T23:30:00Z" },
  { gw: 16, day: 4, deadline_utc: "2026-02-05T23:30:00Z" },
  { gw: 16, day: 5, deadline_utc: "2026-02-07T00:00:00Z" },
  { gw: 16, day: 6, deadline_utc: "2026-02-07T19:30:00Z" },
  { gw: 16, day: 7, deadline_utc: "2026-02-08T17:00:00Z" },
  // GW17
  { gw: 17, day: 1, deadline_utc: "2026-02-09T23:30:00Z" },
  { gw: 17, day: 2, deadline_utc: "2026-02-11T00:00:00Z" },
  { gw: 17, day: 3, deadline_utc: "2026-02-11T23:30:00Z" },
  { gw: 17, day: 4, deadline_utc: "2026-02-13T00:00:00Z" },
  // GW18
  { gw: 18, day: 1, deadline_utc: "2026-02-19T23:30:00Z" },
  { gw: 18, day: 2, deadline_utc: "2026-02-20T23:30:00Z" },
  { gw: 18, day: 3, deadline_utc: "2026-02-21T21:30:00Z" },
  { gw: 18, day: 4, deadline_utc: "2026-02-22T17:30:00Z" },
  // GW19
  { gw: 19, day: 1, deadline_utc: "2026-02-23T23:30:00Z" },
  { gw: 19, day: 2, deadline_utc: "2026-02-24T23:30:00Z" },
  { gw: 19, day: 3, deadline_utc: "2026-02-26T00:00:00Z" },
  { gw: 19, day: 4, deadline_utc: "2026-02-26T23:30:00Z" },
  { gw: 19, day: 5, deadline_utc: "2026-02-27T23:30:00Z" },
  { gw: 19, day: 6, deadline_utc: "2026-02-28T17:30:00Z" },
  { gw: 19, day: 7, deadline_utc: "2026-03-01T17:30:00Z" },
  // GW20
  { gw: 20, day: 1, deadline_utc: "2026-03-02T23:30:00Z" },
  { gw: 20, day: 2, deadline_utc: "2026-03-03T23:30:00Z" },
  { gw: 20, day: 3, deadline_utc: "2026-03-04T23:30:00Z" },
  { gw: 20, day: 4, deadline_utc: "2026-03-05T23:30:00Z" },
  { gw: 20, day: 5, deadline_utc: "2026-03-06T23:30:00Z" },
  { gw: 20, day: 6, deadline_utc: "2026-03-07T19:30:00Z" },
  { gw: 20, day: 7, deadline_utc: "2026-03-08T16:30:00Z" },
  // GW21
  { gw: 21, day: 1, deadline_utc: "2026-03-09T22:30:00Z" },
  { gw: 21, day: 2, deadline_utc: "2026-03-10T22:30:00Z" },
  { gw: 21, day: 3, deadline_utc: "2026-03-11T23:00:00Z" },
  { gw: 21, day: 4, deadline_utc: "2026-03-12T22:30:00Z" },
  { gw: 21, day: 5, deadline_utc: "2026-03-13T23:00:00Z" },
  { gw: 21, day: 6, deadline_utc: "2026-03-14T16:30:00Z" },
  { gw: 21, day: 7, deadline_utc: "2026-03-15T16:30:00Z" },
  // GW22
  { gw: 22, day: 1, deadline_utc: "2026-03-16T22:30:00Z" },
  { gw: 22, day: 2, deadline_utc: "2026-03-17T22:30:00Z" },
  { gw: 22, day: 3, deadline_utc: "2026-03-18T22:30:00Z" },
  { gw: 22, day: 4, deadline_utc: "2026-03-19T22:30:00Z" },
  { gw: 22, day: 5, deadline_utc: "2026-03-20T23:00:00Z" },
  { gw: 22, day: 6, deadline_utc: "2026-03-21T20:30:00Z" },
  { gw: 22, day: 7, deadline_utc: "2026-03-22T20:30:00Z" },
  // GW23
  { gw: 23, day: 1, deadline_utc: "2026-03-23T22:30:00Z" },
  { gw: 23, day: 2, deadline_utc: "2026-03-24T22:30:00Z" },
  { gw: 23, day: 3, deadline_utc: "2026-03-25T22:30:00Z" },
  { gw: 23, day: 4, deadline_utc: "2026-03-26T22:30:00Z" },
  { gw: 23, day: 5, deadline_utc: "2026-03-27T22:30:00Z" },
  { gw: 23, day: 6, deadline_utc: "2026-03-28T18:30:00Z" },
  { gw: 23, day: 7, deadline_utc: "2026-03-29T20:00:00Z" },
  // GW24
  { gw: 24, day: 1, deadline_utc: "2026-03-30T23:30:00Z" },
  { gw: 24, day: 2, deadline_utc: "2026-03-31T23:30:00Z" },
  { gw: 24, day: 3, deadline_utc: "2026-04-01T23:30:00Z" },
  { gw: 24, day: 4, deadline_utc: "2026-04-02T23:30:00Z" },
  { gw: 24, day: 5, deadline_utc: "2026-04-03T23:30:00Z" },
  { gw: 24, day: 6, deadline_utc: "2026-04-04T19:30:00Z" },
  { gw: 24, day: 7, deadline_utc: "2026-04-05T20:00:00Z" },
  // GW25
  { gw: 25, day: 1, deadline_utc: "2026-04-06T23:30:00Z" },
  { gw: 25, day: 2, deadline_utc: "2026-04-07T23:30:00Z" },
  { gw: 25, day: 3, deadline_utc: "2026-04-08T23:30:00Z" },
  { gw: 25, day: 4, deadline_utc: "2026-04-09T23:30:00Z" },
  { gw: 25, day: 5, deadline_utc: "2026-04-10T23:30:00Z" },
  { gw: 25, day: 6, deadline_utc: "2026-04-12T22:30:00Z" },
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
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[d.getUTCDay()];
  const date = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dayName} ${date} ${month} ${hours}:${mins}`;
}

/**
 * Get total days in a gameweek.
 */
export function getTotalDaysInGameweek(gw: number): number {
  return DEADLINES.filter((d) => d.gw === gw).length;
}
