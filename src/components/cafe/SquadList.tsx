import Link from "next/link";
import type { SquadPlayer } from "@/lib/cafe/squad";
import type { Squad } from "@/lib/cafe/types";
import { ChevronRightIcon } from "../Icons";
import { cardListClass, mutedClass } from "../ui";
import { CardPhoto } from "./CardPhoto";

/** 스쿼드를 짧게 보여 주는 사진 줄. 공격수부터 네 명의 사진을 겹쳐 보여 줘요. */
export function SquadFaces({ players }: { players: (SquadPlayer | null)[] }) {
  const faces = players.filter((player) => player !== null).slice(-4).reverse();
  return (
    <span className="flex shrink-0 -space-x-2.5">
      {faces.map((player) => (
        <span
          key={player.spid}
          className="relative size-9 overflow-hidden rounded-full bg-emerald-800 ring-2 ring-white dark:ring-zinc-900"
        >
          <CardPhoto spid={player.spid} name={player.name} />
        </span>
      ))}
    </span>
  );
}

/** 스쿼드 목록 한 줄 */
function SquadRow({ squad, showAuthor }: { squad: Squad; showAuthor: boolean }) {
  const players = squad.players.filter((player) => player !== null);
  return (
    <li>
      <Link
        href={`/cafe/squad/${squad.id}`}
        className="-mx-4 flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
      >
        <SquadFaces players={squad.players} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{squad.name}</span>
          <span className={`block truncate text-xs ${mutedClass}`}>
            {squad.formation} · 선수 {players.length}명{showAuthor ? ` · ${squad.author.nickname}` : ""}
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-zinc-400" />
      </Link>
    </li>
  );
}

export function SquadList({ squads, showAuthor }: { squads: Squad[]; showAuthor: boolean }) {
  return (
    <ul className={cardListClass}>
      {squads.map((squad) => (
        <SquadRow key={squad.id} squad={squad} showAuthor={showAuthor} />
      ))}
    </ul>
  );
}
