import { searchPlayers } from "@/lib/fconline";

/**
 * 드림 스쿼드의 선수 검색. ?q=이름으로 찾아서 선수마다 카드 번호들을 돌려줘요.
 * 결과는 이름에만 달려 있어서 CDN에 하루 저장해 두고, 같은 검색은 서버를 거치지 않게 해요.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 20);
  try {
    const players = await searchPlayers(query);
    return Response.json(
      { players },
      { headers: { "cache-control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "FC온라인 선수 목록을 불러오지 못했어요. 잠시 후 다시 찾아 주세요." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
