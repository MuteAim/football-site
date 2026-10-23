// 선수 맞히기의 문제 은행(supabase/schema.sql의 quiz_players 목록)을 넥슨 Open API의 FC온라인 카드 목록으로 다시 만들어요.
//
//   node scripts/quiz-players.mjs
//
// 카드가 20장 넘게 나온 선수와 ICON 시즌(레전드) 선수를 모으고, 얼굴 사진이 있는 선수만 남겨요.
// 이름이 같은 선수(ICON 카드와 현역 카드가 따로 있는 경우)는 카드가 많은 쪽 하나만 넣어서 보기에 같은 이름이 두 번 나오지 않게 해요.
// 사진으로 보여 줄 대표 카드는 가장 최근 카드 세 장 중 동작 사진이 있는 것이고, 하나도 없으면 얼굴 사진을 써요.
// 바뀐 목록은 schema.sql을 SQL Editor에서 다시 실행해야 DB에 들어가요. 목록에서 빠진 선수는 DB에 남아 있어도 괜찮아요.
import { readFile, writeFile } from "node:fs/promises";

const META_URL = "https://open.api.nexon.com/static/fconline/meta";
const PHOTO_CDN = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common";
/** ICON TM, ICON TM(제한), ICON 시즌. 넥슨이 레전드로 뽑은 선수라 카드가 적어도 문제로 내요. */
const ICON_SEASONS = new Set([100, 101, 110]);
/** 이만큼 카드가 나온 선수는 오래 활약한 유명 선수로 봐요. */
const MIN_CARDS = 20;
const SCHEMA = new URL("../supabase/schema.sql", import.meta.url);
const START = "-- quiz-players:start";
const END = "-- quiz-players:end";

const response = await fetch(`${META_URL}/spid.json`);
if (!response.ok) throw new Error(`FC온라인 선수 목록을 받지 못했어요: ${response.status}`);
const cards = await response.json();

const names = new Map();
const players = new Map();
for (const card of cards) {
  if (!Number.isSafeInteger(card.id) || card.id <= 0 || typeof card.name !== "string" || !card.name.trim()) continue;
  names.set(card.id, card.name.trim());
  const pid = card.id % 1_000_000;
  const player = players.get(pid) ?? { pid, cards: [], icon: false };
  player.cards.push(card.id);
  if (ICON_SEASONS.has(Math.floor(card.id / 1_000_000))) player.icon = true;
  players.set(pid, player);
}

const byName = new Map();
for (const player of players.values()) {
  if (!player.icon && player.cards.length < MIN_CARDS) continue;
  // 시즌 번호가 큰 카드가 최근 카드예요. 이름은 최근 카드의 표기를 따라요.
  player.cards.sort((a, b) => b - a);
  player.name = names.get(player.cards[0]);
  const other = byName.get(player.name);
  if (!other || player.cards.length > other.cards.length) byName.set(player.name, player);
}

async function exists(url) {
  try {
    return (await fetch(url, { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

/** 한꺼번에 너무 많이 묻지 않게 limit개씩만 동시에 확인해요. */
async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

const checked = await mapLimit([...byName.values()], 12, async (player) => {
  if (!(await exists(`${PHOTO_CDN}/players/p${player.pid}.png`))) return null;
  let spid = null;
  for (const id of player.cards.slice(0, 3)) {
    if (await exists(`${PHOTO_CDN}/playersAction/p${id}.png`)) {
      spid = id;
      break;
    }
  }
  return { pid: player.pid, name: player.name, spid };
});
const rows = checked.filter(Boolean).sort((a, b) => a.pid - b.pid);
if (rows.length < 100) throw new Error(`선수가 ${rows.length}명뿐이라 목록을 바꾸지 않았어요.`);

const sql = [
  "insert into public.quiz_players (pid, name, spid) values",
  rows.map((row) => `  (${row.pid}, '${row.name.replaceAll("'", "''")}', ${row.spid ?? "null"})`).join(",\n"),
  "on conflict (pid) do update set name = excluded.name, spid = excluded.spid;",
].join("\n");

const schema = await readFile(SCHEMA, "utf8");
const start = schema.indexOf(START);
const end = schema.indexOf(END);
if (start < 0 || end < start) throw new Error("schema.sql에서 quiz-players 표시를 찾지 못했어요.");
// 파일의 줄 끝 문자(Windows는 CRLF)를 따라가서 줄 끝이 섞이지 않게 해요.
const eol = schema.includes("\r\n") ? "\r\n" : "\n";
await writeFile(SCHEMA, `${schema.slice(0, start + START.length)}${eol}${sql.replaceAll("\n", eol)}${eol}${schema.slice(end)}`);
console.log(`선수 ${rows.length}명을 적었어요. 동작 사진이 있는 선수는 ${rows.filter((row) => row.spid).length}명이에요.`);
