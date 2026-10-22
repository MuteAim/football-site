// 카페 화면에 쓰는 데이터 모양이에요. DB 칸 이름(snake_case)은 data.ts에서 이 모양으로 바꿔요.

export type Author = {
  id: string;
  nickname: string;
  isManager: boolean;
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
  body: string;
  createdAt: string;
  author: Author;
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
  profile: { nickname: string; isManager: boolean } | null;
};

/** 폼을 보낸 뒤 화면에 돌려주는 결과. 실패하면 쓰던 내용을 values로 돌려줘서 지워지지 않게 해요. */
export type FormState = {
  error: string | null;
  message?: string;
  values?: Record<string, string>;
};
