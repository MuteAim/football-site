// 화면에 쓰는 작은 아이콘들이에요. 글자 색을 따라가도록 currentColor로 그려요.
type IconProps = { className?: string };

/** 축구공. 가운데 오각형과 바깥으로 뻗는 선만 남긴 단순한 모양이에요. */
export function BallIcon({ className = "size-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5l3.33 2.42-1.27 3.91H9.94l-1.27-3.91z" />
      <path d="M12 8.5V3M15.33 10.92l5.23-1.7M14.06 14.83l3.23 4.45M9.94 14.83l-3.23 4.45M8.67 10.92l-5.23-1.7" />
    </svg>
  );
}

/** 사이트 로고. 초록 바탕 위에 축구공이 있어요. */
export function LogoMark() {
  return (
    <span className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-600/30">
      <BallIcon className="size-[18px]" />
    </span>
  );
}

/** 경기장 가운데 선과 센터 서클. 대회 페이지 머리의 배경 무늬로 써요. */
export function PitchLines({ className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden className={className}>
      <path d="M100 0v200M0 1h200M0 199h200" />
      <circle cx="100" cy="100" r="46" />
      <circle cx="100" cy="100" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
