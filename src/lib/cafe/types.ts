import type { SquadPlayer } from "./squad";
import type { Mention } from "./mentions";

// 카페 화면에 쓰는 데이터 모양이에요. DB 칸 이름(snake_case)은 data.ts에서 이 모양으로 바꿔요.

/** 회원이 고른 응원팀. id는 football-data.org의 팀 번호예요. */
export type FanTeam = {
  id: number;
  name: string;
  crest: string;
};

/** 응원팀으로 고를 수 있는 한 리그의 팀들 */
export type LeagueTeams = {
  code: string;
  name: string;
  teams: FanTeam[];
};

export type Author = {
  id: string;
  nickname: string;
  isManager: boolean;
  /** 운영자. 카페 관리 화면을 쓰고 매니저 권한도 같이 가져요. */
  isAdmin: boolean;
  /** 지금까지 받은 골. 등급을 정해요. 상점에서 써도 줄지 않아요. */
  goals: number;
  /** 상점에서 사서 쓰고 있는 닉네임 색과 프로필 테두리 아이템 */
  nameColor: string | null;
  frame: string | null;
  team: FanTeam | null;
};

/** 상점 아이템. 가격은 DB가 정해요. */
export type ShopItem = {
  id: string;
  kind: "color" | "frame";
  price: number;
};

/** 골 내역 한 줄 */
export type GoalEvent = {
  id: number;
  /** reward는 운영자가 SQL로 직접 준 골이에요. 예: 레전드 로드 초기화 보상 */
  kind: "attendance" | "streak" | "prediction" | "minority" | "quiz" | "reward";
  amount: number;
  /** 한국 날짜(YYYY-MM-DD). 예측 골은 킥오프 날짜예요. */
  day: string;
};

/** 선수 맞히기 문제 하나. choices는 보기 4개의 선수 이름이고, 사진은 /cafe/game/photo?round=id로 받아요. */
export type QuizRound = {
  id: number;
  choices: string[];
};

/** 내 선수 맞히기 상태. played와 earned는 오늘 받은 문제 수와 골, round는 아직 안 푼 문제예요. */
export type QuizStatus = {
  streak: number;
  played: number;
  earned: number;
  round: QuizRound | null;
};

/** 선수 맞히기 답의 결과. prize는 이번에 받은 골이에요. */
export type QuizResult = {
  correct: boolean;
  answer: string;
  prize: number;
  streak: number;
  played: number;
  earned: number;
};

export type PostSummary = {
  id: number;
  board: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  author: Author;
  /** 운영자가 공지로 올린 글 */
  pinned: boolean;
};

export type Post = PostSummary & {
  body: string;
  updatedAt: string | null;
  /** 글에 붙인 드림 스쿼드. 스쿼드를 지우면 null이 돼요. */
  squad: SquadSummary | null;
};

/** 드림 스쿼드의 내용. players는 포메이션 자리 순서대로 11칸이고 빈 자리는 null이에요. */
export type SquadSummary = {
  id: number;
  name: string;
  formation: string;
  players: (SquadPlayer | null)[];
};

export type Squad = SquadSummary & {
  author: Author;
  createdAt: string;
  updatedAt: string | null;
};

export type Comment = {
  mentions: Mention[];
  id: number;
  /** 답글이면 맨 위 댓글 번호, 아니면 null */
  parentId: number | null;
  /** 답글이 남아 있어서 "삭제된 댓글" 자리로 남은 댓글 */
  deleted: boolean;
  body: string;
  createdAt: string;
  author: Author;
};

/** 승부 예측. 홈팀 승, 무승부, 원정팀 승 */
export type PredictionPick = "home" | "draw" | "away";

export type PredictionCounts = Record<PredictionPick, number>;

/** 예측 순위 한 줄 */
export type RankingEntry = {
  author: Author;
  /** 결과가 나온 경기 중 킥오프 전에 고른 예측 수 */
  settled: number;
  hits: number;
};

export type TalkSide = "home" | "away";

export type Talk = {
  id: number;
  userId: string;
  side: TalkSide | null;
  body: string;
  createdAt: string;
};

/** 내 소식 한 줄. 댓글·태그·추천은 actor/post/comment, 예측은 match, 업데이트는 update를 채워요. */
export type CafeNotification = {
  id: number;
  kind: "comment" | "reply" | "like" | "prediction" | "mention" | "update";
  update: { id: number; title: string; body: string } | null;
  read: boolean;
  createdAt: string;
  actor: Author | null;
  post: { id: number; board: string; title: string } | null;
  /** 달린 댓글이나 답글. 답글이 남아 "삭제된 댓글" 자리가 됐으면 deleted가 true예요. */
  comment: { id: number; body: string; deleted: boolean } | null;
  /** day는 경기 화면 주소에 쓰는 한국 날짜(YYYY-MM-DD), goals는 받은 골이에요. */
  match: { id: number; day: string; label: string | null; goals: number } | null;
};

/** 카페 설정. 운영자가 카페 관리 화면에서 바꿔요. */
export type CafeSettings = {
  cafeName: string;
  tagline: string;
  /** banner.ts의 BANNER_COLORS 이름 */
  bannerColor: string;
  /** 카페 맨 위 한 줄 공지. href는 이 사이트 주소(/로 시작)나 https 주소예요. */
  notice: { on: boolean; text: string | null; href: string | null };
  /** 글쓰기 잠금(점검 모드). 켜면 매니저와 운영자만 글·댓글·응원톡을 써요. */
  lock: { on: boolean; message: string | null };
};

/** 운영 기록 한 줄. changes는 바뀐 칸마다 [이전 값, 새 값]이거나, 공지 고정처럼 동작의 내용이에요. */
export type AdminLog = {
  id: number;
  area: string;
  target: string | null;
  changes: Record<string, unknown>;
  createdAt: string;
  /** SQL Editor에서 직접 바꿨으면 null이에요. */
  actor: Author | null;
};

/** 지금 보고 있는 사람. 로그인했지만 닉네임을 아직 안 정했으면 profile이 null이에요. */
export type Viewer = {
  id: string;
  profile: Author | null;
};

/** 폼을 보낸 뒤 화면에 돌려주는 결과. 실패하면 쓰던 내용을 values로 돌려줘서 지워지지 않게 해요. */
export type FormState = {
  error: string | null;
  message?: string;
  values?: Record<string, string>;
};
