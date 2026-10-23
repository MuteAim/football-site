import { createSessionClient } from "@/lib/cafe/supabase-server";
import { getViewer } from "@/lib/cafe/viewer";

/** 태그 자동완성. 가입한 회원만 검색하고, 공개 닉네임과 식별자만 반환해요. */
export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store" };
  const viewer = await getViewer();
  if (!viewer?.profile) return Response.json({ members: [] }, { status: 401, headers });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9_]{0,12}$/.test(query)) {
    return Response.json({ members: [] }, { status: 400, headers });
  }
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("profiles")
    .select("id, nickname")
    .ilike("nickname", `${query.replaceAll("_", "\\_")}%`)
    .neq("id", viewer.id)
    .order("nickname")
    .limit(8);
  if (error) return Response.json({ members: [] }, { status: 503, headers });
  return Response.json({ members: data ?? [] }, { headers });
}
