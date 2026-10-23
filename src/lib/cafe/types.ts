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
  kind: "attendance" | "streak" | "prediction" | "minority";
  amount: number;
  /** 한국 날짜(YYYY-MM-DD). 예측 골은 킥오프 날짜예요. */
  day: string;
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
};

export type Post = PostSummary & {
  body: string;
  updatedAt: string | null;
};

export type Comment = {
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

/** 내 소식 한 줄. 종류에 따라 actor·post·comment(댓글, 답글, 추천)나 match(승부 예측)가 채워져요. */
export type CafeNotification = {
  id: number;
  kind: "comment" | "reply" | "like" | "prediction";
  read: boolean;
  createdAt: string;
  actor: Author | null;
  post: { id: number; board: string; title: string } | null;
  /** 달린 댓글이나 답글. 답글이 남아 "삭제된 댓글" 자리가 됐으면 deleted가 true예요. */
  comment: { id: number; body: string; deleted: boolean } | null;
  /** day는 경기 화면 주소에 쓰는 한국 날짜(YYYY-MM-DD), goals는 받은 골이에요. */
  match: { id: number; day: string; label: string | null; goals: number } | null;
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
