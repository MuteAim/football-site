import { levelOf } from "@/lib/cafe/levels";
import { frameClass } from "@/lib/cafe/shop";
import type { FanTeam } from "@/lib/cafe/types";
import { Crest } from "../Crest";

// 회원 프로필 동그라미. 응원팀을 골랐으면 그 팀 엠블럼을, 아니면 닉네임 첫 글자를 회원마다 정해진 색 위에 보여 줘요.
// Tailwind가 클래스를 찾을 수 있게 색 이름을 문자열 그대로 적어 둬요.
const COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
];

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

const SIZES = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
};
const TEXT_SIZES = { sm: "text-[11px]", md: "text-[13px]", lg: "text-base" };

/** 동그라미 안 엠블럼 크기. 가장자리에 닿지 않게 동그라미보다 조금 작게 그려요. */
const CREST_SIZES = { sm: 16, md: 22, lg: 28 };

function fanLabel(team: FanTeam) {
  return `${team.name} 팬`;
}

export function Avatar({
  id,
  nickname,
  team,
  frame,
  size = "md",
}: {
  id: string;
  nickname: string;
  team?: FanTeam | null;
  /** 상점에서 산 테두리 아이템 */
  frame?: string | null;
  size?: keyof typeof SIZES;
}) {
  const ring = frameClass(frame);
  // 테두리가 있으면 같은 크기 안에서 테두리 두께만큼 안을 줄여서, 줄 맞춤이 흔들리지 않게 해요.
  const box = ring ? "size-full" : SIZES[size];
  const inner = team ? (
    <span
      role="img"
      aria-label={fanLabel(team)}
      title={fanLabel(team)}
      className={`flex shrink-0 items-center justify-center rounded-full bg-white ${ring ? "" : "ring-1 ring-zinc-950/10 dark:ring-white/15"} ${box}`}
    >
      <Crest src={team.crest} size={ring ? CREST_SIZES[size] - 2 : CREST_SIZES[size]} />
    </span>
  ) : (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${box} ${TEXT_SIZES[size]} ${colorFor(id || nickname)}`}
    >
      {nickname.slice(0, 1).toUpperCase()}
    </span>
  );

  if (!ring) return inner;
  return <span className={`flex shrink-0 rounded-full p-[2px] ${SIZES[size]} ${ring}`}>{inner}</span>;
}

/** 프로필 동그라미가 없는 글 목록에서 닉네임 앞에 붙이는 작은 응원팀 엠블럼. */
export function TeamCrest({ team }: { team: FanTeam | null }) {
  if (!team) return null;
  return (
    <span
      role="img"
      aria-label={fanLabel(team)}
      title={fanLabel(team)}
      className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full dark:bg-white"
    >
      <Crest src={team.crest} size={14} />
    </span>
  );
}

/** 골로 정해지는 회원 등급. 닉네임 바로 뒤에 붙여요. 마우스를 올리면 골 수가 보여요. */
export function LevelBadge({ goals }: { goals: number }) {
  const level = levelOf(goals);
  return (
    <span
      title={`${goals.toLocaleString("ko-KR")}골`}
      className={`shrink-0 rounded px-1 py-px text-[10px] font-bold leading-tight whitespace-nowrap ${level.className}`}
    >
      {level.name}
    </span>
  );
}

/** 닉네임 옆에 붙는 작은 표시. 매니저나 글쓴이를 알려 줘요. */
export function NameBadge({ children, tone = "emerald" }: { children: string; tone?: "emerald" | "zinc" }) {
  return (
    <span
      // 좁은 줄에서도 글자가 두 줄로 꺾이지 않고, 닉네임이 먼저 줄어들게 해요.
      className={`shrink-0 rounded px-1 py-px text-[10px] font-bold leading-tight whitespace-nowrap ${
        tone === "emerald"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}
