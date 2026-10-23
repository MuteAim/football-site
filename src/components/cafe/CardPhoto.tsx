"use client";

import Image from "next/image";
import { useState } from "react";
import { cardPhotos, facePhoto } from "@/lib/cafe/squad";

/**
 * FC온라인 선수 사진. 카드(spid)를 주면 그 시즌 카드의 동작 사진을, 없으면 얼굴 사진을 보여 줘요.
 * 선수(pid)만 주면 얼굴 사진이에요. 사진이 하나도 없으면 이름 첫 글자를 보여 줘요.
 * 넥슨 CDN 사진을 그대로 써서 Vercel 이미지 변환 횟수를 쓰지 않아요. 감싸는 칸에 relative와 크기를 줘야 해요.
 */
export function CardPhoto({ spid, pid, name }: { spid?: number; pid?: number; name: string }) {
  const sources = spid ? cardPhotos(spid) : pid ? [facePhoto(pid)] : [];
  // 실패한 주소를 기억해서, 카드가 바뀌면 새 카드의 사진부터 다시 시도해요.
  const [failed, setFailed] = useState<string[]>([]);
  const src = sources.find((url) => !failed.includes(url));

  if (!src) {
    return (
      <span aria-hidden className="flex size-full items-center justify-center bg-emerald-900/60 text-sm font-bold text-white">
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="64px"
      unoptimized
      onError={() => setFailed((list) => [...list, src])}
      className="object-cover object-top"
    />
  );
}
