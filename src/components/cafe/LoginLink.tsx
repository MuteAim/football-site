"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LinkPending } from "../LinkPending";

/**
 * 로그인 화면으로 가는 링크. 로그인을 마치면 지금 보던 화면(또는 next)으로 돌아오게 주소를 같이 넘겨요.
 */
export function LoginLink({
  next,
  className,
  children,
}: {
  next?: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const back = next ?? pathname;
  const href = back === "/cafe/login" ? back : `/cafe/login?next=${encodeURIComponent(back)}`;
  return (
    <Link href={href} className={`relative ${className ?? ""}`}>
      {children}
      <LinkPending className="rounded-full bg-white/20" />
    </Link>
  );
}
