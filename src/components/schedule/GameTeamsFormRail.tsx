import { useMemo } from "react";
import { format } from "date-fns";
import { getTeamLogo } from "@/lib/nba-teams";
import { useTeamRecentUpcoming, type TeamGameSlot } from "@/hooks/useTeamRecentUpcoming";

interface Props {
  awayTeam: string | null;
  homeTeam: string | null;
  awayName: string;
  homeName: string;
  referenceIso: string | null;
  blurb?: string;
}

function Circle({ slot, leading }: { slot: TeamGameSlot | null; leading?: boolean }) {
  const oppLogo = slot ? getTeamLogo(slot.opponent) : null;
  let ring = "hsl(var(--border))";
  let tip = "—";
  if (slot) {
    if (slot.played) {
      ring = slot.won
        ? "hsl(142 76% 45%)"
        : slot.won === false
          ? "hsl(0 84% 60%)"
          : "hsl(var(--border))";
      const v = slot.isHome ? "vs" : "@";
      const r = slot.won ? "W" : slot.won === false ? "L" : "·";
      tip = `${v} ${slot.opponent} — ${r} ${slot.myPts ?? "-"}-${slot.oppPts ?? "-"} (${format(new Date(slot.tipoffUtc), "MMM d")})`;
    } else {
      ring = "hsl(45 90% 55% / 0.55)";
      const v = slot.isHome ? "vs" : "@";
      tip = `${v} ${slot.opponent} — ${format(new Date(slot.tipoffUtc), "EEE MMM d")}`;
    }
  }
  return (
    <div
      title={tip}
      className={`w-6 h-6 rounded-full bg-background/70 flex items-center justify-center overflow-hidden shrink-0 ${leading ? "" : ""}`}
      style={{ border: `2px solid ${ring}` }}
    >
      {slot ? (
        oppLogo ? (
          <img src={oppLogo} alt={slot.opponent} className="w-3.5 h-3.5 object-contain" />
        ) : (
          <span className="text-[7px] font-bold">{slot.opponent}</span>
        )
      ) : (
        <span className="text-[8px] text-muted-foreground/40">—</span>
      )}
    </div>
  );
}

function TeamRow({
  team,
  referenceIso,
  align,
}: {
  team: string | null;
  referenceIso: string | null;
  align: "left" | "right";
}) {
  const { data } = useTeamRecentUpcoming(team, referenceIso);
  const past = useMemo(() => {
    const arr: (TeamGameSlot | null)[] = [...(data?.past ?? [])];
    while (arr.length < 2) arr.unshift(null);
    return arr.slice(-2);
  }, [data]);
  const next = useMemo(() => {
    const arr: (TeamGameSlot | null)[] = [...(data?.next ?? [])];
    while (arr.length < 2) arr.push(null);
    return arr.slice(0, 2);
  }, [data]);

  const content = (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/70 mr-1">Last</span>
      {past.map((s, i) => <Circle key={`p${i}`} slot={s} />)}
      <span className="mx-1 text-amber-400/40 text-xs">•</span>
      {next.map((s, i) => <Circle key={`n${i}`} slot={s} />)}
      <span className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/70 ml-1">Next</span>
    </div>
  );
  return <div className={align === "right" ? "ml-auto" : "mr-auto"}>{content}</div>;
}

export default function GameTeamsFormRail({
  awayTeam,
  homeTeam,
  awayName,
  homeName,
  referenceIso,
  blurb,
}: Props) {
  const sentence =
    blurb ??
    (awayTeam && homeTeam
      ? `${awayName} face ${homeName} — recent form and what's next`
      : "Pick a game to see each team's recent and upcoming matchups");

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-background/55 backdrop-blur-sm px-4 py-2.5 flex items-center gap-4">
      <TeamRow team={awayTeam} referenceIso={referenceIso} align="left" />
      <span className="text-amber-400/40 select-none">|</span>
      <p className="flex-1 text-center text-[11px] md:text-xs text-foreground/85 leading-snug">
        {sentence}
      </p>
      <span className="text-amber-400/40 select-none">|</span>
      <TeamRow team={homeTeam} referenceIso={referenceIso} align="right" />
    </div>
  );
}