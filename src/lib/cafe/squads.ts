import "server-only";
import { cache } from "react";
import { CafeError } from "./data";
import { PROFILE_COLUMNS, type RawProfile, toAuthor } from "./profile";
import type { SquadPlayer } from "./squad";
import { publicClient } from "./supabase-server";
import type { Squad } from "./types";

// 드림 스쿼드 읽기예요. 스쿼드는 누구나 볼 수 있어서 로그인 없이 읽어요.

type RawSquad = {
  id: number;
  name: string;
  formation: string;
  players: (SquadPlayer | null)[];
  created_at: string;
  updated_at: string | null;
  author: RawProfile | RawProfile[] | null;
};

const SQUAD_COLUMNS = `id, name, formation, players, created_at, updated_at, author:profiles!user_id(${PROFILE_COLUMNS})`;

function toSquad(raw: RawSquad): Squad | null {
  const author = Array.isArray(raw.author) ? raw.author[0] : raw.author;
  // 만든 회원이 지워지면 스쿼드도 같이 지워져서 글쓴이가 없을 일은 없지만, 타입을 위해 확인해요.
  if (!author) return null;
  return {
    id: raw.id,
    name: raw.name,
    formation: raw.formation,
    players: raw.players,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    author: toAuthor(author),
  };
}

/** 스쿼드 하나. 화면 제목과 본문이 같이 불러도 한 번만 읽어요. */
export const getSquad = cache(async (id: number): Promise<Squad | null> => {
  const supabase = await publicClient();
  const { data, error } = await supabase.from("squads").select(SQUAD_COLUMNS).eq("id", id).maybeSingle<RawSquad>();
  if (error) throw new CafeError(error.message);
  return data ? toSquad(data) : null;
});

/** 최근에 만든 스쿼드. userId를 주면 그 회원의 스쿼드만이에요. */
export async function listSquads({ userId, limit }: { userId?: string; limit: number }): Promise<Squad[]> {
  const supabase = await publicClient();
  let query = supabase.from("squads").select(SQUAD_COLUMNS);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.order("id", { ascending: false }).limit(limit);
  if (error) throw new CafeError(error.message);
  return (data as RawSquad[]).flatMap((raw) => toSquad(raw) ?? []);
}
