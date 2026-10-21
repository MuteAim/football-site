import Image from "next/image";

type CrestProps = { src: string | null | undefined; size?: number };

// football-data.org 엠블럼 원본은 장당 10KB 안팎의 PNG라 작은 화면에서 늦게 떠요.
// Next.js 이미지 최적화로 표시 크기에 맞는 작은 WebP로 바꿔서 같은 서버에서 내려줍니다.
// 그 외 주소나 SVG는 최적화하지 않고 그대로 보여 줘요.
const OPTIMIZABLE = /^https:\/\/crests\.football-data\.org\/[^?#]+\.(png|jpe?g|gif|webp)$/i;

export function Crest({ src, size = 20 }: CrestProps) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized={!OPTIMIZABLE.test(src)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
