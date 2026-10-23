import { getQuizPhotoSources } from "@/lib/cafe/quiz";
import { getViewer } from "@/lib/cafe/viewer";

/**
 * 선수 맞히기 문제의 사진. ?round=문제 번호로 부르면 내 문제의 정답 선수 사진을 넥슨 CDN에서 받아 그대로 넘겨줘요.
 * 넥슨 사진 주소에는 선수 번호가 들어 있어서, 화면에 그 주소를 주면 보기와 맞춰 볼 수 있어요.
 * 그래서 서버가 대신 받아 주고, 내 문제가 아니면 보여 주지 않아요.
 */
export async function GET(request: Request) {
  const round = Number(new URL(request.url).searchParams.get("round"));
  if (!Number.isSafeInteger(round) || round <= 0) return new Response(null, { status: 400 });

  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401 });
  const sources = await getQuizPhotoSources(round, viewer.id);
  if (!sources) return new Response(null, { status: 404 });

  for (const url of sources) {
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) continue;
    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/png",
        // 문제마다 주소가 달라서 내 브라우저에만 잠깐 남겨 둬요.
        "cache-control": "private, max-age=3600",
      },
    });
  }
  return new Response(null, { status: 404 });
}
