import { useEffect, type RefObject } from "react";

/**
 * 가로로 넘기는 메뉴에서 지금 고른 칸이 화면 밖에 있으면 가운데로 끌어와요.
 * 휴대폰에서는 뒤쪽 칸이 처음부터 가려져 있어서 필요해요. 고른 칸에는 aria-current="page"가 있어야 해요.
 */
export function useCenterActive(ref: RefObject<HTMLElement | null>, activeKey: unknown) {
  useEffect(() => {
    const nav = ref.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const start = active.offsetLeft;
    const end = start + active.offsetWidth;
    if (start >= nav.scrollLeft && end <= nav.scrollLeft + nav.clientWidth) return;
    nav.scrollTo({ left: start - (nav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }, [ref, activeKey]);
}
