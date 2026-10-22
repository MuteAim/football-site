"use client";

import { useState, useTransition } from "react";
import { buyItem, equipItem } from "@/lib/cafe/actions";
import type { ShopKind } from "@/lib/cafe/shop";
import { errorTextClass, primaryButtonClass, secondaryButtonClass } from "../ui";

/** 상점 아이템 버튼. 안 샀으면 사기, 샀으면 쓰기와 벗기예요. 끝나면 서버가 화면을 다시 그려요. */
export function ShopItemActions({
  itemId,
  kind,
  name,
  price,
  owned,
  equipped,
  balance,
}: {
  itemId: string;
  kind: ShopKind;
  name: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  balance: number;
}) {
  const [pending, startAction] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startAction(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  let button;
  if (!owned) {
    const affordable = balance >= price;
    button = (
      <button
        type="button"
        disabled={!affordable || pending}
        onClick={() => {
          if (window.confirm(`${price}골로 「${name}」 아이템을 살까요?`)) run(() => buyItem(itemId));
        }}
        className={`w-full ${primaryButtonClass}`}
      >
        {pending ? "사는 중…" : affordable ? `${price}골에 사기` : "골이 모자라요"}
      </button>
    );
  } else if (equipped) {
    button = (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => equipItem(kind, null))}
        className={`w-full ${secondaryButtonClass}`}
      >
        {pending ? "바꾸는 중…" : "벗기"}
      </button>
    );
  } else {
    button = (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => equipItem(kind, itemId))}
        className={`w-full ${primaryButtonClass}`}
      >
        {pending ? "바꾸는 중…" : "쓰기"}
      </button>
    );
  }

  return (
    <div>
      {button}
      {error ? (
        <p role="alert" className={`mt-1.5 ${errorTextClass}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
