import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isCafeConfigured } from "@/lib/cafe/config";

// 카페 로그인 유지 담당이에요. 로그인 토큰은 1시간마다 만료돼서, 화면을 그리기 전에 여기서 새 토큰으로 바꿔 둬요.
// 화면을 그리는 중에는 쿠키를 바꿀 수 없어서 이 과정이 꼭 필요해요.
// 로그인한 적 없는 방문자와 경기 일정·순위 화면은 아무것도 하지 않고 그냥 통과시켜요.
export async function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
  if (!hasSession || !isCafeConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // 새 토큰을 이번 요청의 화면에도 바로 쓰고, 브라우저에도 저장하게 해요.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // 쿠키가 담긴 응답을 CDN이 저장해 다른 사람에게 주지 않도록 막는 헤더예요.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // 토큰을 확인하면서 만료가 가까우면 새로 받아요. 이 호출과 위의 createServerClient 사이에 다른 코드를 넣지 마세요.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // 로그인이 필요한 카페 화면과 경기 응원톡 화면에서만 돌아요.
  matcher: ["/cafe/:path*", "/matches/:date/:id"],
};
