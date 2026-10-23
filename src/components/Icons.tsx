import type { ReactNode } from "react";

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

// ---------- 카페 아이콘 ----------
// 축구공 아이콘과 같은 굵기의 선으로 그려요.

function LineIcon({ className, children }: IconProps & { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

/** 말풍선. 카페 메뉴와 댓글·응원톡에 써요. */
export function ChatIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H12l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z" />
    </LineIcon>
  );
}

export function PencilIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </LineIcon>
  );
}

/** 추천. filled면 속을 채워서 이미 누른 상태를 보여 줘요. */
export function HeartIcon({ className = "size-4", filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}

export function EyeIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </LineIcon>
  );
}

export function SendIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M20 4L4 11l6.5 2.5L13 20l7-16z" />
      <path d="M10.5 13.5L20 4" />
    </LineIcon>
  );
}

export function UserIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </LineIcon>
  );
}

/** 답글 표시. 위에서 내려와 오른쪽으로 꺾이는 화살표예요. */
export function ReplyIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M6 5v6a3 3 0 0 0 3 3h9" />
      <path d="M15 10.5l3.5 3.5-3.5 3.5" />
    </LineIcon>
  );
}

/** 승부 예측 순위 등 순위표 표시. 트로피 모양이에요. */
export function TrophyIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5.5a2 2 0 0 0 0 4H8M16 6h2.5a2 2 0 0 1 0 4H16" />
      <path d="M12 13v4M9 20h6M10 17h4" />
    </LineIcon>
  );
}

export function CheckIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </LineIcon>
  );
}

export function ChevronDownIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M6 9l6 6 6-6" />
    </LineIcon>
  );
}

/** 골 상점. 쇼핑백 모양이에요. */
export function BagIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </LineIcon>
  );
}

/** 내 소식. 종 모양이에요. */
export function BellIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </LineIcon>
  );
}
