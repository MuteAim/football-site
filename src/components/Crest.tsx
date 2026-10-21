/* eslint-disable @next/next/no-img-element -- 엠블럼은 작은 외부 이미지라 이미지 최적화 없이 그대로 씁니다. */
type CrestProps = { src: string | null | undefined; size?: number };

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
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
