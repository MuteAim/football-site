"use client";

import { useActionState } from "react";
import { saveProfile } from "@/lib/cafe/actions";
import { NICKNAME_HINT } from "@/lib/cafe/config";
import type { FormState } from "@/lib/cafe/types";
import { errorTextClass, inputClass, primaryButtonClass } from "../ui";

const initialState: FormState = { error: null };

/** 닉네임 정하기. 처음 가입할 때와 나중에 바꿀 때 같이 써요. */
export function ProfileForm({ nickname, next }: { nickname?: string; next: string }) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const joining = nickname === undefined;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">닉네임</span>
        <div className="flex gap-2">
          <input
            name="nickname"
            required
            minLength={2}
            maxLength={12}
            autoComplete="nickname"
            defaultValue={state.values?.nickname ?? nickname}
            placeholder="예: 손흥민팬"
            className={inputClass}
          />
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "저장 중…" : joining ? "가입하기" : "바꾸기"}
          </button>
        </div>
      </label>
      {state.error ? (
        <p role="alert" className={errorTextClass}>
          {state.error}
        </p>
      ) : state.message ? (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{NICKNAME_HINT}</p>
      )}
    </form>
  );
}
