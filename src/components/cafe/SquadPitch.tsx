import Image from "next/image";
import { NEXON_CREDIT, pitchName, seasonIdOf, slotsOf, type FcSeasons, type SquadPlayer } from "@/lib/cafe/squad";
import { mutedClass } from "../ui";
import { CardPhoto } from "./CardPhoto";

// 드림 스쿼드를 그리는 피치와 선수 목록이에요. 스쿼드 화면, 글 화면, 스쿼드 만들기 화면이 같이 써요.

/** 피치 선. 피치 칸과 같은 가로세로 비율이라 선이 찌그러지지 않아요. */
function PitchLines() {
  return (
    <svg
      viewBox="0 0 68 90"
      preserveAspectRatio="none"
      aria-hidden
      className="absolute inset-0 size-full text-white/30"
      fill="none"
      stroke="currentColor"
    >
      <g strokeWidth={1.5}>
        <rect x="3" y="3" width="62" height="84" vectorEffect="non-scaling-stroke" />
        <line x1="3" y1="45" x2="65" y2="45" vectorEffect="non-scaling-stroke" />
        <circle cx="34" cy="45" r="7" vectorEffect="non-scaling-stroke" />
        <rect x="15" y="3" width="38" height="13" vectorEffect="non-scaling-stroke" />
        <rect x="25" y="3" width="18" height="5" vectorEffect="non-scaling-stroke" />
        <rect x="15" y="74" width="38" height="13" vectorEffect="non-scaling-stroke" />
        <rect x="25" y="82" width="18" height="5" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/** 카드 위에 붙이는 시즌 아이콘. 넥슨 CDN 그림을 그대로 써요. */
export function SeasonIcon({ seasons, spid }: { seasons: FcSeasons; spid: number }) {
  const season = seasons[seasonIdOf(spid)];
  if (!season) return null;
  return (
    <Image
      src={season.image}
      alt={season.name}
      title={season.name}
      width={24}
      height={20}
      unoptimized
      className="h-3.5 w-auto shrink-0"
    />
  );
}

/**
 * 포메이션 자리에 선수 카드를 놓은 피치. onSlot을 주면 자리를 누를 수 있어요(스쿼드 만들기 화면).
 * selected는 자리 옮기기 중에 고른 자리예요.
 */
export function SquadPitch({
  formation,
  players,
  seasons,
  onSlot,
  selected = null,
}: {
  formation: string;
  players: (SquadPlayer | null)[];
  seasons: FcSeasons;
  onSlot?: (index: number) => void;
  selected?: number | null;
}) {
  return (
    <div className="relative mx-auto aspect-[68/90] w-full max-w-[26rem] overflow-hidden rounded-2xl bg-emerald-700 bg-[repeating-linear-gradient(180deg,transparent_0_10%,rgb(255_255_255/0.05)_10%_20%)] shadow-inner dark:bg-emerald-800">
      <PitchLines />
      {slotsOf(formation).map((slot, index) => {
        const player = players[index] ?? null;
        const picked = selected === index;
        const frame = picked
          ? "ring-4 ring-amber-300"
          : player
            ? "ring-2 ring-white/80"
            : "border-2 border-dashed border-white/60";
        const body = (
          <>
            <span className={`relative size-12 overflow-hidden rounded-full bg-emerald-950/30 ${frame}`}>
              {player ? (
                <CardPhoto key={player.spid} spid={player.spid} name={player.name} />
              ) : (
                <span aria-hidden className="flex size-full items-center justify-center text-xl font-light text-white/90">
                  +
                </span>
              )}
            </span>
            <span className="flex max-w-full items-center gap-0.5 rounded-md bg-black/55 px-1 py-px text-[11px] leading-4 font-semibold text-white">
              {player ? <SeasonIcon seasons={seasons} spid={player.spid} /> : null}
              <span className="truncate" title={player?.name}>
                {player ? pitchName(player.name) : slot.label}
              </span>
            </span>
          </>
        );
        const place = "absolute flex w-[4.75rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1";
        const style = { left: `${slot.x}%`, top: `${slot.y}%` };
        if (!onSlot) {
          return (
            <div key={index} style={style} className={place}>
              {body}
            </div>
          );
        }
        return (
          <button
            key={index}
            type="button"
            style={style}
            onClick={() => onSlot(index)}
            aria-label={player ? `${slot.label} ${player.name}` : `${slot.label} 자리에 선수 넣기`}
            aria-pressed={picked || undefined}
            className={`${place} rounded-xl p-0.5 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-white`}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** 피치 아래 글로 보는 선수 목록. 자리, 시즌, 선수 이름이에요. 빈 자리는 빼요. */
export function SquadPlayerList({
  formation,
  players,
  seasons,
}: {
  formation: string;
  players: (SquadPlayer | null)[];
  seasons: FcSeasons;
}) {
  const slots = slotsOf(formation);
  return (
    <ol className="divide-y divide-zinc-100 text-sm dark:divide-white/[0.06]">
      {players.map((player, index) =>
        player ? (
          <li key={index} className="flex items-center gap-2.5 py-2">
            <span className="w-10 shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400">{slots[index]?.label}</span>
            <SeasonIcon seasons={seasons} spid={player.spid} />
            <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
            <span className={`max-w-[45%] shrink-0 truncate text-xs ${mutedClass}`}>
              {seasons[seasonIdOf(player.spid)]?.name ?? ""}
            </span>
          </li>
        ) : null,
      )}
    </ol>
  );
}

/** 넥슨 Open API 이용 약관에 따른 출처 표시 */
export function NexonCredit({ className = "" }: { className?: string }) {
  return <p className={`text-[11px] ${mutedClass} ${className}`}>{NEXON_CREDIT}</p>;
}
