import "server-only";
import { cacheLife } from "next/cache";
import { playerIdOf, type FcSeasons } from "./cafe/squad";

// 넥슨 Open API의 FC온라인 기본 자료(선수 카드 목록, 시즌 목록)예요. 둘 다 API 키 없이 받아요.
// 넥슨 규칙상 받아 둔 자료는 30일 안에 새로 받아야 해서, 카드 목록은 하루, 시즌 목록은 일주일 안에 새로 받아요.
const META_URL = "https://open.api.nexon.com/static/fconline/meta";

type RawCard = { id: number; name: string };
type RawSeason = { seasonId: number; className: string; seasonImg: string };

/**
 * 선수 한 명. 같은 선수 번호의 카드를 모아 두고, 검색할 때 쓰려고 띄어쓰기를 뺀 이름(key)과
 * 낱말(words, "리오넬 메시"면 "리오넬"과 "메시")도 들고 있어요.
 */
type IndexedPlayer = { pid: number; name: string; key: string; words: string[]; spids: number[] };
type CardIndex = { players: IndexedPlayer[]; names: Map<number, string>; loadedAt: number };

/** 검색에서 내놓는 선수 한 명. spids는 그 선수의 카드 번호예요. */
export type PlayerResult = { pid: number; name: string; spids: number[] };

const INDEX_TTL = 24 * 60 * 60_000;
let cardIndex: CardIndex | null = null;
let loading: Promise<CardIndex> | null = null;

/** 띄어쓰기를 지우고 영문은 소문자로 바꿔서, "손 흥민"으로 찾아도 "손흥민"이 나오게 해요. */
function searchKey(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

async function buildIndex(): Promise<CardIndex> {
  // 6MB가 넘어서 Next.js 데이터 캐시(2MB까지)에 넣지 않고, 받은 뒤 서버 메모리에 들고 있어요.
  const response = await fetch(`${META_URL}/spid.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`FC온라인 선수 목록을 받지 못했어요: ${response.status}`);
  const cards = (await response.json()) as RawCard[];

  const players = new Map<number, IndexedPlayer>();
  const names = new Map<number, string>();
  for (const card of cards) {
    if (!Number.isSafeInteger(card.id) || card.id <= 0 || typeof card.name !== "string" || !card.name) continue;
    names.set(card.id, card.name);
    const pid = playerIdOf(card.id);
    const player = players.get(pid);
    if (player) player.spids.push(card.id);
    else {
      const words = card.name.split(/\s+/).map(searchKey).filter(Boolean);
      players.set(pid, { pid, name: card.name, key: searchKey(card.name), words, spids: [card.id] });
    }
  }
  // 시즌 번호가 큰 카드가 대체로 최근 카드라서 앞에 둬요.
  for (const player of players.values()) player.spids.sort((a, b) => b - a);
  return { players: [...players.values()], names, loadedAt: Date.now() };
}

/** 카드 목록. 서버마다 메모리에 하루 동안 들고 있고, 여러 요청이 한꺼번에 와도 한 번만 받아요. */
async function getIndex(): Promise<CardIndex> {
  if (cardIndex && Date.now() - cardIndex.loadedAt < INDEX_TTL) return cardIndex;
  loading ??= buildIndex()
    .then((index) => {
      cardIndex = index;
      return index;
    })
    .finally(() => {
      loading = null;
    });
  try {
    return await loading;
  } catch (error) {
    // 새로 받다가 실패해도 예전 목록이 있으면 그걸 써요.
    if (cardIndex) return cardIndex;
    throw error;
  }
}

/**
 * 이름으로 선수 찾기. 이름이나 이름의 한 낱말이 똑같은 선수("메시"면 "리오넬 메시"), 그렇게 시작하는 선수,
 * 이름 어딘가에 들어간 선수 순서예요. 같은 순서끼리는 카드가 많은(오래 나온 인기 선수) 순서예요.
 */
export async function searchPlayers(query: string, limit = 20): Promise<PlayerResult[]> {
  const key = searchKey(query);
  if (!key) return [];
  const { players } = await getIndex();

  const found: { player: IndexedPlayer; rank: number }[] = [];
  for (const player of players) {
    if (!player.key.includes(key)) continue;
    const rank =
      player.key === key || player.words.includes(key)
        ? 0
        : player.key.startsWith(key) || player.words.some((word) => word.startsWith(key))
          ? 1
          : 2;
    found.push({ player, rank });
  }
  found.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.player.spids.length - a.player.spids.length ||
      a.player.name.localeCompare(b.player.name, "ko"),
  );
  return found.slice(0, limit).map(({ player }) => ({ pid: player.pid, name: player.name, spids: player.spids }));
}

/** 카드 번호들의 선수 이름. 없는 카드는 빠져요. 스쿼드를 저장할 때 화면이 보낸 이름 대신 써요. */
export async function cardNames(spids: number[]): Promise<Map<number, string>> {
  const { names } = await getIndex();
  const found = new Map<number, string>();
  for (const spid of spids) {
    const name = names.get(spid);
    if (name) found.set(spid, name);
  }
  return found;
}

/** 시즌 목록. 카드 위 시즌 아이콘과 시즌 이름에 써요. 읽지 못하면 빈 목록을 잠깐만 저장해 두고 다시 읽어요. */
export async function getSeasons(): Promise<FcSeasons> {
  "use cache";
  try {
    const response = await fetch(`${META_URL}/seasonid.json`);
    if (!response.ok) throw new Error(`FC온라인 시즌 목록을 받지 못했어요: ${response.status}`);
    const seasons: FcSeasons = {};
    for (const season of (await response.json()) as RawSeason[]) {
      if (!Number.isSafeInteger(season.seasonId) || !season.seasonImg?.startsWith("https://")) continue;
      seasons[season.seasonId] = { name: season.className, image: season.seasonImg };
    }
    cacheLife("days");
    return seasons;
  } catch (error) {
    console.error(error);
    cacheLife("minutes");
    return {};
  }
}
