import { useMemo } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";

export default function PlayerMarquee() {
  const { data } = usePlayersQuery({ sort: "value5", order: "desc", limit: 40 });

  const photos = useMemo(() => {
    const items: { id: number; photo: string; name: string }[] = (data?.items ?? [])
      .map((p: any) => ({
        id: p.core?.id ?? p.id,
        photo: p.core?.photo ?? p.photo,
        name: p.core?.name ?? p.name,
      }))
      .filter((p: any) => !!p.photo);
    // shuffle and slice
    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 14);
    // duplicate for seamless loop
    return [...shuffled, ...shuffled];
  }, [data]);

  if (photos.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden opacity-[0.18] motion-reduce:opacity-[0.08]"
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
      aria-hidden
    >
      <div
        className="flex gap-10 motion-safe:animate-[marquee_60s_linear_infinite]"
        style={{ width: "max-content" }}
      >
        {photos.map((p, i) => (
          <div
            key={`${p.id}-${i}`}
            className="relative h-56 w-44 flex-shrink-0 rounded-2xl overflow-hidden bg-gradient-to-b from-primary/30 to-transparent"
          >
            <img
              src={p.photo}
              alt=""
              className="h-full w-full object-cover object-top grayscale"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}