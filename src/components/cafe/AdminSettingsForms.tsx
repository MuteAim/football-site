"use client";

import Link from "next/link";
import { useActionState, useState, type MouseEvent, type ReactNode } from "react";
import { publishUpdate, saveBanner, saveLock, saveNotice } from "@/lib/cafe/admin-actions";
import { BANNER_COLORS, DEFAULT_LOCK_MESSAGE, SETTING_LIMITS } from "@/lib/cafe/banner";
import type { CafeSettings, FormState } from "@/lib/cafe/types";
import { LockIcon } from "../Icons";
import { confirmDialog, showToast } from "../feedback";
import { cardClass, cardHeadingClass, errorTextClass, inputClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "../ui";
import { CafeBanner, NoticeBar } from "./CafeBanner";

// 카페 관리 화면의 설정 폼들이에요. 저장하면 서버가 이 화면과 카페 머리를 새 값으로 다시 그려요.

const initialState: FormState = { error: null };

export function UpdateForm() {
  const [state, formAction, pending] = useSave(publishUpdate);
  return (
    <Section title="업데이트 알림" description="새 기능과 개선 사항을 등록하면 모든 회원의 내 소식에 한 번씩 알려요. 등록한 내용은 업데이트 소식에 남아요.">
      <form action={formAction} className="space-y-4 p-4">
        <Field label="버전">
          <input name="version" required maxLength={60} defaultValue={state.values?.version}
            placeholder="예: 2026.10.23" className={inputClass} />
        </Field>
        <Field label="제목">
          <input name="title" required maxLength={100} defaultValue={state.values?.title}
            placeholder="예: 댓글에서 회원을 태그할 수 있어요" className={inputClass} />
        </Field>
        <Field label="업데이트 내용">
          <textarea name="body" required maxLength={3000} rows={5} defaultValue={state.values?.body}
            placeholder="새로 추가되거나 달라진 기능을 알려 주세요." className={`${inputClass} resize-y`} />
        </Field>
        <FormFooter error={state.error}>
          <Link href="/cafe/updates" className={secondaryButtonClass}>등록된 소식</Link>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "등록 중…" : "등록하고 알림 보내기"}
          </button>
        </FormFooter>
      </form>
    </Section>
  );
}

const dangerButtonClass =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95 disabled:pointer-events-none disabled:opacity-50";

/** 저장 동작을 감싸서, 끝나면 화면 아래에 알려 줘요. */
function useSave(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  return useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error && result.message) showToast(result.message);
    return result;
  }, initialState);
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className={`${cardClass} mb-4`}>
      <h2 className={cardHeadingClass}>{title}</h2>
      <p className={`px-4 pt-3 text-sm ${mutedClass}`}>{description}</p>
      {children}
    </section>
  );
}

/** 입력칸 이름표. 오른쪽에 쓴 글자 수를 보여 줄 수 있어요. */
function Field({ label, count, children }: { label: string; count?: [number, number]; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
        {label}
        {count ? (
          <span className={`text-xs font-normal tabular-nums ${mutedClass}`}>
            {count[0]}/{count[1]}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function FormFooter({ error, children }: { error: string | null; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <p role="alert" className={errorTextClass}>
        {error}
      </p>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}

/** 배너의 카페 이름, 소개, 색. 고치는 대로 위의 미리 보기가 바뀌어요. */
export function BannerForm({ settings }: { settings: CafeSettings }) {
  const [state, formAction, pending] = useSave(saveBanner);
  const [name, setName] = useState(settings.cafeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [color, setColor] = useState(settings.bannerColor);

  return (
    <Section title="배너" description="카페 모든 화면 맨 위에 보여요. 이름은 작게, 소개는 크게 나와요.">
      <form action={formAction} className="space-y-4 p-4">
        <div aria-label="배너 미리 보기" role="img">
          <CafeBanner name={name || " "} tagline={tagline || " "} color={color} preview />
        </div>
        <Field label="카페 이름" count={[name.length, SETTING_LIMITS.cafeName]}>
          <input
            name="cafeName"
            required
            maxLength={SETTING_LIMITS.cafeName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="소개" count={[tagline.length, SETTING_LIMITS.tagline]}>
          <input
            name="tagline"
            required
            maxLength={SETTING_LIMITS.tagline}
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            className={inputClass}
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">배너 색</legend>
          {/* 휴대폰에서는 네 개씩 두 줄로, 넓은 화면에서는 한 줄로 놓아요. */}
          <div className="grid grid-cols-4 gap-3 sm:flex sm:flex-wrap">
            {Object.entries(BANNER_COLORS).map(([key, look]) => (
              <label key={key} className="flex cursor-pointer flex-col items-center gap-1">
                <input
                  type="radio"
                  name="bannerColor"
                  value={key}
                  checked={color === key}
                  onChange={() => setColor(key)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`block size-9 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white transition peer-checked:ring-zinc-900 peer-focus-visible:ring-emerald-500 dark:ring-offset-zinc-900 dark:peer-checked:ring-white ${look.swatch}`}
                />
                <span className={`text-xs ${mutedClass} peer-checked:font-semibold peer-checked:text-zinc-900 dark:peer-checked:text-white`}>
                  {look.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <FormFooter error={state.error}>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "저장하는 중…" : "배너 저장"}
          </button>
        </FormFooter>
      </form>
    </Section>
  );
}

/** 카페 맨 위 한 줄 공지. 끄면 쓴 내용은 남아 있어서 다시 켤 때 그대로 써요. */
export function NoticeForm({ settings }: { settings: CafeSettings }) {
  const [state, formAction, pending] = useSave(saveNotice);
  const [on, setOn] = useState(settings.notice.on);
  const [text, setText] = useState(settings.notice.text ?? "");
  const [href, setHref] = useState(settings.notice.href ?? "");

  return (
    <Section title="공지 띠" description="배너 바로 아래에 한 줄로 보여요. 링크를 넣으면 띠를 눌러 그 주소로 가요.">
      <form action={formAction} className="space-y-4 p-4">
        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            name="noticeOn"
            checked={on}
            onChange={(event) => setOn(event.target.checked)}
            className="size-5 accent-emerald-600"
          />
          카페 맨 위에 공지 띄우기
        </label>
        <Field label="내용" count={[text.length, SETTING_LIMITS.notice]}>
          <input
            name="noticeText"
            maxLength={SETTING_LIMITS.notice}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="예: 오늘 밤 손흥민 경기 응원톡 열려요!"
            className={inputClass}
          />
        </Field>
        <Field label="링크 (없어도 돼요)">
          <input
            name="noticeHref"
            maxLength={SETTING_LIMITS.noticeHref}
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="/cafe/free/12 또는 https://…"
            inputMode="url"
            className={inputClass}
          />
          <span className={`mt-1 block text-xs ${mutedClass}`}>
            이 사이트 주소는 /로 시작하게, 다른 사이트는 https://로 시작하게 써요. 다른 사이트는 새 탭에서 열려요.
          </span>
        </Field>
        {on && text.trim() ? (
          <div aria-label="공지 띠 미리 보기" role="img" className="-mt-1">
            <NoticeBar notice={{ on, text: text.trim(), href: href.trim() || null }} preview />
          </div>
        ) : null}
        <FormFooter error={state.error}>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "저장하는 중…" : "공지 저장"}
          </button>
        </FormFooter>
      </form>
    </Section>
  );
}

/**
 * 글쓰기 잠금(점검 모드). 잠그면 매니저와 운영자를 뺀 회원은 글·댓글·응원톡을 못 쓰고, 화면에 안내 띠가 떠요.
 * 잠글 때는 확인 창으로 한 번 더 물어봐요.
 */
export function LockForm({ settings }: { settings: CafeSettings }) {
  const [state, formAction, pending] = useSave(saveLock);
  const locked = settings.lock.on;

  async function confirmLock(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const button = event.currentTarget;
    const ok = await confirmDialog({
      title: "글쓰기를 잠글까요?",
      description: "매니저와 운영자를 뺀 모든 회원이 글·댓글·응원톡을 못 써요. 잠금을 풀 때까지 이어져요.",
      confirmLabel: "잠그기",
      tone: "danger",
    });
    if (ok) button.form?.requestSubmit(button);
  }

  return (
    <Section
      title="글쓰기 잠금"
      description="도배나 분쟁이 생겼을 때 잠시 글쓰기를 멈춰요. 읽기와 추천, 승부 예측은 그대로 돼요."
    >
      <form action={formAction} className="space-y-4 p-4">
        <p
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            locked ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
          }`}
        >
          <LockIcon className="size-4" />
          {locked ? "지금 잠겨 있어요" : "지금은 열려 있어요"}
        </p>
        <Field label="안내 문구 (없어도 돼요)">
          <input
            name="lockMessage"
            maxLength={SETTING_LIMITS.lockMessage}
            defaultValue={state.values?.lockMessage ?? settings.lock.message ?? ""}
            placeholder={DEFAULT_LOCK_MESSAGE}
            className={inputClass}
          />
        </Field>
        <FormFooter error={state.error}>
          {locked ? (
            <>
              <button type="submit" name="locked" value="on" disabled={pending} className={secondaryButtonClass}>
                문구만 바꾸기
              </button>
              <button type="submit" name="locked" value="off" disabled={pending} className={primaryButtonClass}>
                {pending ? "바꾸는 중…" : "잠금 풀기"}
              </button>
            </>
          ) : (
            <button
              type="submit"
              name="locked"
              value="on"
              disabled={pending}
              onClick={(event) => void confirmLock(event)}
              className={dangerButtonClass}
            >
              {pending ? "잠그는 중…" : "글쓰기 잠그기"}
            </button>
          )}
        </FormFooter>
      </form>
    </Section>
  );
}
