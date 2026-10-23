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
    <span className="flex size-9 shrink-0 -rotate-6 items-center justify-center rounded-xl bg-[#d4f77d] text-[#132b1e] ring-1 ring-white/10 dark:bg-zinc-100 dark:text-zinc-950">
      <BallIcon className="size-6 rotate-6" />
    </span>
  );
}

/** 축구장 라인. 장식이므로 보조 기술에는 읽히지 않아요. */
export function PitchLines({ className }: IconProps) {
  return (
    <svg viewBox="0 0 360 240" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden className={className}>
      <rect x="10" y="10" width="340" height="220" rx="2" />
      <path d="M180 10v220M10 62h56v116H10M350 62h-56v116h56M10 94h22v52H10M350 94h-22v52h22" />
      <circle cx="180" cy="120" r="32" />
      <circle cx="180" cy="120" r="2" fill="currentColor" />
      <circle cx="49" cy="120" r="2" fill="currentColor" />
      <circle cx="311" cy="120" r="2" fill="currentColor" />
      <path d="M66 96a30 30 0 0 1 0 48M294 96a30 30 0 0 0 0 48" />
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

/** 카페 맨 위 한 줄 공지. 확성기 모양이에요. */
export function MegaphoneIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </LineIcon>
  );
}

/** 글쓰기 잠금. 자물쇠 모양이에요. */
export function LockIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M5.5 11h13a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-6A1.5 1.5 0 0 1 5.5 11z" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </LineIcon>
  );
}

/** 공지로 올린 글. 압정 모양이에요. */
export function PinIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" />
      <path d="M12 13v7" />
    </LineIcon>
  );
}

/** 더하기. 새로 만들기 버튼에 써요. */
export function PlusIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M12 5v14M5 12h14" />
    </LineIcon>
  );
}

/** 드림 스쿼드. 유니폼 모양이에요. */
export function ShirtIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M9 4 4 6.5 5.5 11 8 10v10h8V10l2.5 1L20 6.5 15 4a3 3 0 0 1-6 0z" />
    </LineIcon>
  );
}

/** 선수 맞히기. 물음표가 붙은 선수 카드 모양이에요. */
export function QuizCardIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M9.75 9.5a2.25 2.25 0 1 1 3.2 2.05c-.6.3-.95.8-.95 1.45v.5" />
      <path d="M12 16.5h.01" />
    </LineIcon>
  );
}

/** 카페 관리. 조절 막대 모양이에요. */
export function SlidersIcon({ className = "size-4" }: IconProps) {
  return (
    <LineIcon className={className}>
      <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <path d="M16 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM10 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
    </LineIcon>
  );
}
