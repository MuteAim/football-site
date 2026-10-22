import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginButtons } from "@/components/cafe/LoginButtons";
import { cardClass, mutedClass, primaryButtonClass, skeletonClass } from "@/components/ui";
import { signIn } from "@/lib/cafe/actions";
import { safeNext } from "@/lib/cafe/config";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "로그인" };

async function LoginContent({ searchParams }: { searchParams: PageProps<"/cafe/login">["searchParams"] }) {
  const [params, viewer] = await Promise.all([searchParams, getViewer()]);
  const next = safeNext(params.next);

  if (viewer) {
    const href = viewer.profile ? next : `/cafe/me?next=${encodeURIComponent(next)}`;
    return (
      <div className={`${cardClass} p-6 text-center`}>
        <p className="font-semibold">
          {viewer.profile ? `${viewer.profile.nickname}님, 이미 로그인했어요.` : "로그인은 끝났어요. 닉네임만 정해 주세요."}
        </p>
        <Link href={href} className={`mt-4 ${primaryButtonClass}`}>
          {viewer.profile ? "카페로 가기" : "닉네임 정하기"}
        </Link>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-6`}>
      <h1 className="text-xl font-bold tracking-tight">카페 로그인</h1>
      <p className={`mt-1 text-sm ${mutedClass}`}>처음이면 로그인한 뒤 닉네임만 정하면 가입이 끝나요.</p>
      {params.error ? (
        <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-3.5 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
          로그인하지 못했어요. 다시 시도해 주세요.
        </p>
      ) : null}
      <form action={signIn} className="mt-6">
        <input type="hidden" name="next" value={next} />
        <LoginButtons />
      </form>
      <p className={`mt-5 text-xs leading-relaxed ${mutedClass}`}>
        로그인한 계정의 이름과 이메일은 다른 회원에게 보이지 않아요. 카페에서는 직접 정한 닉네임만 보여요.
      </p>
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/cafe/login">) {
  return (
    <div className="mx-auto max-w-sm break-keep">
      <Suspense fallback={<div className={`h-[300px] animate-pulse rounded-2xl ${skeletonClass}`} />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
