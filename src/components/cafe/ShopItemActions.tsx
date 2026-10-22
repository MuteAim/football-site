"use client";

import { useState, useTransition } from "react";
import { buyItem, equipItem } from "@/lib/cafe/actions";
import type { ShopKind } from "@/lib/cafe/shop";
import { objectParticle } from "@/lib/korean";
import { confirmDialog, showToast } from "../feedback";
import { errorTextClass, primaryButtonClass, secondaryButtonClass } from "../ui";

/** 상점 아이템 버튼. 안 샀으면 사기, 샀으면 쓰기와 벗기예요. 끝나면 알림을 띄우고 서버가 화면을 다시 그려요. */
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

  const named = `${name}${objectParticle(name)}`;

  function run(action: () => Promise<{ error: string | null }>, done: string) {
    setError(null);
    startAction(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else showToast(done);
    });
  }

  async function buy() {
    const ok = await confirmDialog({
      title: `${named} 살까요?`,
      description: `${price.toLocaleString("ko-KR")}골을 쓰면 ${(balance - price).toLocaleString("ko-KR")}골이 남아요. 등급은 그대로예요.`,
      confirmLabel: `${price.toLocaleString("ko-KR")}골에 사기`,
    });
    if (ok) run(() => buyItem(itemId), `${named} 샀어요. 쓰기를 누르면 바로 보여요.`);
  }

  let button;
  if (!owned) {
    const affordable = balance >= price;
    button = (
      <button
        type="button"
        disabled={!affordable || pending}
        onClick={() => void buy()}
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
        onClick={() => run(() => equipItem(kind, null), `${named} 벗었어요`)}
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
        onClick={() => run(() => equipItem(kind, itemId), `${named} 쓰고 있어요`)}
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
