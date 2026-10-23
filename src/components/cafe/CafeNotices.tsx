import Link from "next/link";
import { DEFAULT_LOCK_MESSAGE } from "@/lib/cafe/banner";
import type { Viewer } from "@/lib/cafe/types";
import { ChatIcon, LockIcon } from "../Icons";
import { cardClass, mutedClass, primaryButtonClass } from "../ui";
import { LoginLink } from "./LoginLink";

/** Supabase 주소와 키를 아직 넣지 않았을 때 보이는 안내. */
export function CafeSetupNotice() {
  return (
    <div className={`${cardClass} p-5 text-sm leading-relaxed break-keep`}>
      <p className="text-base font-semibold">카페를 열려면 설정이 조금 필요해요.</p>
      <ol className={`mt-2 list-decimal space-y-1 pl-5 ${mutedClass}`}>
        <li>supabase.com에서 무료 프로젝트를 만들어요.</li>
        <li>
          SQL Editor에 <code className="font-mono text-zinc-700 dark:text-zinc-300">supabase/schema.sql</code>{" "}
          내용을 붙여 넣고 실행해요.
        </li>
        <li>
          <code className="font-mono text-zinc-700 dark:text-zinc-300">.env.local</code>에 프로젝트 주소와 키를 넣고
          서버를 다시 켜요.
        </li>
      </ol>
      <p className={`mt-2 ${mutedClass}`}>자세한 순서는 README의 &quot;카페 설정&quot;에 있어요.</p>
    </div>
  );
}

/** 카페 관리 화면에 운영자가 아닌 사람이 들어왔을 때 보여 주는 안내. */
export function AdminOnly({ viewer }: { viewer: Viewer | null }) {
  return (
    <div className={`${cardClass} flex flex-col items-center gap-3 px-5 py-10 text-center break-keep`}>
      <span className="flex size-11 items-center justify-center rounded-full bg-zinc-500/10 text-zinc-500 dark:text-zinc-400">
        <LockIcon className="size-5" />
      </span>
      <p className="font-semibold">카페 운영자만 볼 수 있어요.</p>
      <p className={`text-sm ${mutedClass}`}>
        {viewer ? "운영자는 Supabase의 SQL Editor에서 정해요." : "운영자 계정으로 로그인해 주세요."}
      </p>
      {viewer ? null : (
        <LoginLink next="/cafe/admin" className={`mt-1 ${primaryButtonClass}`}>
          로그인하기
        </LoginLink>
      )}
    </div>
  );
}

/** 글쓰기 잠금(점검 모드) 중에 글쓰기 폼 대신 보여 주는 안내. message는 운영자가 적은 이유예요. */
export function WriteLocked({ message }: { message: string | null }) {
  return (
    <div className={`${cardClass} flex flex-col items-center gap-3 px-5 py-10 text-center break-keep`}>
      <span className="flex size-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <LockIcon className="size-5" />
      </span>
      <p className="font-semibold">지금은 글쓰기를 잠시 멈췄어요.</p>
      <p className={`text-sm ${mutedClass}`}>{message ?? DEFAULT_LOCK_MESSAGE}</p>
    </div>
  );
}

/**
 * 로그인이나 가입이 필요한 곳에 대신 보여 주는 안내.
 * 로그인하지 않았으면 로그인 버튼을, 로그인만 하고 닉네임이 없으면 닉네임 정하기 버튼을 보여 줘요.
 */
export function MemberRequired({
  viewer,
  next,
  children = "카페 회원만 쓸 수 있어요.",
}: {
  viewer: Viewer | null;
  next: string;
  children?: string;
}) {
  return (
    <div className={`${cardClass} flex flex-col items-center gap-3 px-5 py-10 text-center break-keep`}>
      <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <ChatIcon className="size-5" />
      </span>
      <p className="font-semibold">{children}</p>
      <p className={`text-sm ${mutedClass}`}>
        {viewer ? "닉네임만 정하면 바로 참여할 수 있어요." : "카카오나 구글 계정으로 10초면 가입해요."}
      </p>
      {viewer ? (
        <Link href={`/cafe/me?next=${encodeURIComponent(next)}`} className={`mt-1 ${primaryButtonClass}`}>
          닉네임 정하기
        </Link>
      ) : (
        <LoginLink next={next} className={`mt-1 ${primaryButtonClass}`}>
          로그인하기
        </LoginLink>
      )}
    </div>
  );
}
