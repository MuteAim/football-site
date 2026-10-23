import type { Author } from "./types";

// 회원 한 명을 읽을 때 가져오는 칸과, 그 칸을 화면용 모양으로 바꾸는 방법이에요.
// 서버와 응원톡(브라우저)이 같이 써요.

export const PROFILE_COLUMNS =
  "id, nickname, is_manager, is_admin, goals, team_id, team_name, team_crest, name_color, avatar_frame";

export type RawProfile = {
  id: string;
  nickname: string;
  is_manager: boolean;
  is_admin: boolean;
  goals: number;
  team_id: number | null;
  team_name: string | null;
  team_crest: string | null;
  name_color: string | null;
  avatar_frame: string | null;
};

export function toAuthor(raw: RawProfile): Author {
  return {
    id: raw.id,
    nickname: raw.nickname,
    isManager: raw.is_manager,
    isAdmin: raw.is_admin,
    goals: raw.goals,
    nameColor: raw.name_color,
    frame: raw.avatar_frame,
    // DB가 세 칸을 다 같이 채우거나 비우게 막아 둬서, 하나만 봐도 되지만 타입을 위해 다 확인해요.
    team:
      raw.team_id != null && raw.team_name && raw.team_crest
        ? { id: raw.team_id, name: raw.team_name, crest: raw.team_crest }
        : null,
  };
}

/** 매니저나 운영자인지. 아무 글이나 지우고, 글쓰기 잠금 중에도 쓸 수 있어요. */
export function isStaff(author: Author | null | undefined): boolean {
  return author?.isManager === true || author?.isAdmin === true;
}
