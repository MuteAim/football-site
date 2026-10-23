import { getUnreadCount } from "@/lib/cafe/notifications";
import { getViewer } from "@/lib/cafe/viewer";

/**
 * 안 읽은 내 소식 수. 카페 머리는 화면을 옮겨도 다시 그려지지 않아서, 계정 메뉴가 화면을 옮길 때마다 여기에 물어봐요.
 * 회원이 아니면 0이에요.
 */
export async function GET() {
  const viewer = await getViewer();
  const count = viewer?.profile ? await getUnreadCount() : 0;
  return Response.json({ count }, { headers: { "cache-control": "no-store" } });
}
