import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { FLASH_COOKIE, isCafeConfigured, safeNext } from "@/lib/cafe/config";
import { createSessionClient } from "@/lib/cafe/supabase-server";

// 카카오·구글 로그인을 마치고 돌아오는 곳이에요.
// 받은 일회용 코드를 로그인 쿠키로 바꾸고, 처음 온 사람이면 닉네임 정하는 화면으로 보내요.
// 돌아간 화면 아래에 "로그인했어요" 알림이 뜨도록 알림 쿠키도 같이 남겨요.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code && isCafeConfigured()) {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", data.user.id)
        .maybeSingle<{ nickname: string }>();
      (await cookies()).set(
        FLASH_COOKIE,
        profile ? `${profile.nickname}님, 반가워요!` : "로그인했어요. 닉네임만 정하면 가입이 끝나요.",
        { path: "/", maxAge: 60, sameSite: "lax" },
      );
      return redirectTo(request, profile ? next : `/cafe/me?next=${encodeURIComponent(next)}`);
    }
    console.error(error);
  }
  return redirectTo(request, "/cafe/login?error=1");
}

/** Vercel처럼 앞단 서버를 거치면 원래 주소가 x-forwarded-host에 담겨 와요. */
function redirectTo(request: NextRequest, path: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base =
    forwardedHost && process.env.NODE_ENV !== "development"
      ? `https://${forwardedHost}`
      : request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, base));
}
