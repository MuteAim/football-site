"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { activeMention, type Mention } from "@/lib/cafe/mentions";
import { inputClass, mutedClass } from "../ui";

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows: number;
  label: string;
  placeholder: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

export function MentionTextarea({ value, onChange, maxLength, rows, label, placeholder, autoFocus, disabled }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const hintId = useId();
  const list = useRef<HTMLUListElement>(null);
  const [token, setToken] = useState<ReturnType<typeof activeMention>>(null);
  const [result, setResult] = useState<{ query: string; members: Mention[]; error: boolean } | null>(null);
  const [selected, setSelected] = useState(0);
  const query = token?.query;
  const current = result?.query === query ? result : null;
  const members = current?.members ?? [];
  const opened = token !== null && !disabled;

  useEffect(() => {
    if (opened) list.current?.children[selected]?.scrollIntoView({ block: "nearest" });
  }, [opened, selected]);

  useEffect(() => {
    if (!autoFocus || !input.current) return;
    input.current.focus();
    input.current.setSelectionRange(input.current.value.length, input.current.value.length);
  }, [autoFocus]);

  useEffect(() => {
    if (query === undefined) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/cafe/members?q=${encodeURIComponent(query)}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) throw new Error("member search failed");
        const data = await response.json() as { members: Mention[] };
        if (!controller.signal.aborted) setResult({ query, members: data.members, error: false });
      } catch {
        if (!controller.signal.aborted) setResult({ query, members: [], error: true });
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  function locate(element: HTMLTextAreaElement) {
    const next = element.selectionStart === element.selectionEnd
      ? activeMention(element.value, element.selectionStart) : null;
    setToken(next);
    setSelected(0);
  }

  function pick(member: Mention) {
    if (!token || !input.current) return;
    const prefix = value.slice(0, token.start);
    const suffix = value.slice(token.end);
    const tag = `@${member.nickname}${/^\s/.test(suffix) ? "" : " "}`;
    const next = prefix + tag + suffix;
    if (next.length > maxLength) return;
    onChange(next);
    setToken(null);
    input.current.focus();
    requestAnimationFrame(() => input.current?.setSelectionRange(prefix.length + tag.length, prefix.length + tag.length));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!opened || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); setToken(null); return; }
    if (!members.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + members.length) % members.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(members[selected] ?? members[0]);
    }
  }

  return (
    <div>
      <textarea
        ref={input} name="body" required value={value} disabled={disabled}
        maxLength={maxLength} rows={rows} placeholder={placeholder} aria-label={label}
        aria-describedby={hintId} aria-autocomplete="list"
        aria-controls={opened ? listId : undefined}
        aria-activedescendant={opened && members.length ? `${listId}-${Math.min(selected, members.length - 1)}` : undefined}
        onChange={(event) => { onChange(event.target.value); locate(event.target); }}
        onClick={(event) => locate(event.currentTarget)}
        onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) locate(event.currentTarget); }}
        onBlur={() => setToken(null)} onKeyDown={onKeyDown}
        className={`${inputClass} resize-y leading-relaxed`}
      />
      {opened ? (
        <div className="mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <p className={`px-3 pt-2 text-xs ${mutedClass}`}>태그할 회원 · ↑↓ 선택, Enter 입력</p>
          <ul ref={list} id={listId} role="listbox" aria-label="태그할 카페 회원" className="max-h-56 overflow-y-auto p-1">
            {members.map((member, index) => (
              <li key={member.id} id={`${listId}-${index}`} role="option" aria-selected={selected === index}
                onPointerDown={(event) => event.preventDefault()} onClick={() => pick(member)}
                onPointerMove={() => setSelected(index)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold ${selected === index ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}`}>
                @{member.nickname}
              </li>
            ))}
          </ul>
          {!members.length ? <p role="status" className={`px-3 pb-3 text-sm ${mutedClass}`}>
            {!current ? "회원을 찾고 있어요…" : current.error ? "회원을 불러오지 못했어요. 잠시 후 다시 입력해 주세요." : "일치하는 회원이 없어요."}
          </p> : null}
        </div>
      ) : null}
      <p id={hintId} className={`mt-1 text-xs ${mutedClass}`}>@닉네임으로 카페 회원을 태그하면 상대에게 알림이 가요.</p>
    </div>
  );
}
