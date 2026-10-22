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
  /** 지금까지 받은 골. 등급을 정해요. */
  goals: number;
  team: FanTeam | null;
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
