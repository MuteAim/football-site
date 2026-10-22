import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, LevelBadge } from "@/components/cafe/Avatar";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { ShopItemActions } from "@/components/cafe/ShopItemActions";
import { cardClass, cardHeadingClass, mutedClass } from "@/components/ui";
import { getMyShop, listShopItems } from "@/lib/cafe/goals";
import { nameColorClass, SHOP_LOOKS, type ShopKind } from "@/lib/cafe/shop";
import type { Author, ShopItem } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "골 상점" };

const SECTIONS: { kind: ShopKind; title: string; description: string }[] = [
  { kind: "color", title: "닉네임 색", description: "글, 댓글, 응원톡에서 내 닉네임이 이 색으로 보여요." },
  { kind: "frame", title: "프로필 테두리", description: "프로필 그림을 이 테두리로 감싸요." },
];

function ItemCard({
  item,
  me,
  balance,
  owned,
}: {
  item: ShopItem;
  me: Author | null;
  balance: number;
  owned: boolean;
}) {
  const look = SHOP_LOOKS[item.id];
  const equipped = me !== null && (item.kind === "color" ? me.nameColor : me.frame) === item.id;

  return (
    <li
      className={`flex flex-col gap-2 rounded-xl p-3 ${
        equipped ? "bg-emerald-500/5 ring-2 ring-emerald-500" : "ring-1 ring-zinc-950/10 dark:ring-white/10"
      }`}
    >
      {/* 내 닉네임과 프로필 그림에 미리 입혀 보여 줘요. 로그인하지 않았으면 예시로 보여요. */}
      <div className="flex h-11 items-center justify-center">
        {item.kind === "color" ? (
          <span className={`truncate text-lg font-bold ${look.className}`}>{me?.nickname ?? "닉네임"}</span>
        ) : (
          <Avatar id={me?.id ?? item.id} nickname={me?.nickname ?? "골"} team={me?.team} frame={item.id} size="lg" />
        )}
      </div>
      {/* 칸이 좁아서 이름과 가격을 두 줄로 나눠요. */}
      <div className="text-center">
        <p className="truncate text-sm font-semibold">{look.name}</p>
        <p className={`text-xs tabular-nums ${owned ? "font-semibold text-emerald-700 dark:text-emerald-400" : mutedClass}`}>
          {equipped ? "쓰는 중" : owned ? "가짐" : `${item.price.toLocaleString("ko-KR")}골`}
        </p>
      </div>
      {me ? (
        <ShopItemActions
          itemId={item.id}
          kind={item.kind}
          name={look.name}
          price={item.price}
          owned={owned}
          equipped={equipped}
          balance={balance}
        />
      ) : null}
    </li>
  );
}

async function Shop() {
  // 회원마다 남은 골과 산 아이템이 달라서 요청 때마다 그려요.
  await connection();
  const [viewer, items] = await Promise.all([getViewer(), listShopItems()]);
  const me = viewer?.profile ?? null;
  const mine = me ? await getMyShop(me.id) : { balance: 0, owned: [] };

  return (
    <>
      {me ? (
        <div className={`${cardClass} mb-4 flex items-center gap-3 px-4 py-3`}>
          <Avatar id={me.id} nickname={me.nickname} team={me.team} frame={me.frame} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              <span className={`truncate ${nameColorClass(me.nameColor)}`}>{me.nickname}</span>
              <LevelBadge goals={me.goals} />
            </p>
            <p className={`text-xs tabular-nums ${mutedClass}`}>모은 골 {me.goals.toLocaleString("ko-KR")}골</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-xs ${mutedClass}`}>쓸 수 있는 골</p>
            <p className="text-xl font-bold tracking-tight tabular-nums">
              {mine.balance.toLocaleString("ko-KR")}
              <span className="ml-0.5 text-sm">골</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <MemberRequired viewer={viewer} next="/cafe/shop">
            회원이 되면 모은 골로 꾸미기 아이템을 살 수 있어요.
          </MemberRequired>
        </div>
      )}

      {SECTIONS.map((section) => (
        <section key={section.kind} className={`${cardClass} mb-4`}>
          <h2 className={cardHeadingClass}>{section.title}</h2>
          <p className={`px-4 pt-3 text-sm ${mutedClass}`}>{section.description}</p>
          <ul className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            {items
              .filter((item) => item.kind === section.kind)
              .map((item) => (
                <ItemCard key={item.id} item={item} me={me} balance={mine.balance} owned={mine.owned.includes(item.id)} />
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function ShopPage() {
  return (
    <div className="break-keep">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">골 상점</h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          모은 골로 닉네임 색과 프로필 테두리를 사요. 등급은 지금까지 모은 골로 정해져서, 골을 써도 등급은 그대로예요.
        </p>
      </div>
      <Suspense fallback={<PostListSkeleton rows={6} />}>
        <Shop />
      </Suspense>
    </div>
  );
}
