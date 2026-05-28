import { useMemo, type ReactNode } from "react";
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
  actions?: ReactNode;
  onSelectPlayedGame?: (gameId: string) => void;
  onSelectScheduledGame?: (slot: TeamGameSlot) => void;
}

function Circle({
  slot,
  onPlayed,
  onScheduled,
}: {
  slot: TeamGameSlot | null;
  onPlayed?: (id: string) => void;
  onScheduled?: (slot: TeamGameSlot) => void;
}) {
  const oppLogo = slot ? getTeamLogo(slot.opponent) : null;
  let tip = "—";
  if (slot) {
    if (slot.played) {
      const v = slot.isHome ? "vs" : "@";
      const r = slot.won ? "W" : slot.won === false ? "L" : "·";
      tip = `${v} ${slot.opponent} — ${r} ${slot.myPts ?? "-"}-${slot.oppPts ?? "-"} (${format(new Date(slot.tipoffUtc), "MMM d")})`;
    } else {
      const v = slot.isHome ? "vs" : "@";
      tip = `${v} ${slot.opponent} — ${format(new Date(slot.tipoffUtc), "EEE MMM d")}`;
    }
  }
  const clickable = !!slot && ((slot.played && !!onPlayed) || (!slot.played && !!onScheduled));
  const handle = () => {
    if (!slot) return;
    if (slot.played) onPlayed?.(slot.gameId);
    else onScheduled?.(slot);
  };
  const content = slot ? (
    oppLogo ? (
      <img src={oppLogo} alt={slot.opponent} className="w-7 h-7 object-contain drop-shadow" />
    ) : (
      <span className="text-[9px] font-bold text-white">{slot.opponent}</span>
    )
  ) : (
    <span className="text-[8px] text-muted-foreground/40">—</span>
  );
  const className =
    "relative flex items-center justify-center shrink-0 transform-gpu transition-transform duration-200 ease-out hover:scale-[1.4] hover:z-10 hover:drop-shadow-[0_0_10px_hsl(45_90%_55%/0.85)]" +
    (clickable ? " cursor-pointer" : " cursor-default");
  if (clickable) {
    return (
      <button type="button" title={tip} onClick={handle} className={className}>
        {content}
      </button>
    );
  }
  return (
    <div title={tip} className={className}>
      {content}
    </div>
  );
}

function TeamRow({
  team,
  referenceIso,
  align,
  onPlayed,
  onScheduled,
}: {
  team: string | null;
  referenceIso: string | null;
  align: "left" | "right";
  onPlayed?: (id: string) => void;
  onScheduled?: (slot: TeamGameSlot) => void;
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
      <span className="text-[9px] font-heading uppercase tracking-[0.18em] text-white/85 mr-1">Last</span>
      {past.map((s, i) => <Circle key={`p${i}`} slot={s} onPlayed={onPlayed} onScheduled={onScheduled} />)}
      <span className="mx-1 text-amber-400/40 text-xs">•</span>
      {next.map((s, i) => <Circle key={`n${i}`} slot={s} onPlayed={onPlayed} onScheduled={onScheduled} />)}
      <span className="text-[9px] font-heading uppercase tracking-[0.18em] text-white/85 ml-1">Next</span>
    </div>
  );
  return <div className={align === "right" ? "ml-auto" : "mr-auto"}>{content}</div>;
}

export default function GameTeamsFormRail({
  awayTeam,
  homeTeam,
  referenceIso,
  actions,
  onSelectPlayedGame,
  onSelectScheduledGame,
}: Props) {
  const gameSelected = !!(awayTeam && homeTeam);

  return (
    <div className="rounded-2xl border border-amber-300/40 dark:border-amber-400/20 bg-stone-900/80 dark:bg-background/55 backdrop-blur-sm px-4 py-2.5 flex items-center gap-4">
      {gameSelected ? (
        <>
          <TeamRow
            team={awayTeam}
            referenceIso={referenceIso}
            align="left"
            onPlayed={onSelectPlayedGame}
            onScheduled={onSelectScheduledGame}
          />
          <div className="flex-1 flex items-center justify-center">
            {actions ?? null}
          </div>
          <TeamRow
            team={homeTeam}
            referenceIso={referenceIso}
            align="right"
            onPlayed={onSelectPlayedGame}
            onScheduled={onSelectScheduledGame}
          />
        </>
      ) : (
        <p className="flex-1 text-center text-xs md:text-sm font-bold text-white leading-snug">
          Pick a game to see each team's recent and upcoming matchups
        </p>
      )}
    </div>
  );
}