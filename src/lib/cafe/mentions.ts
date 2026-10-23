/** 닉네임은 대소문자를 구분하지 않아요. 이메일·URL 안의 @는 태그로 보지 않아요. */
export type Mention = { id: string; nickname: string };

export function mentionMatches(text: string) {
  return Array.from(text.matchAll(/(^|[\s([{])@([가-힣A-Za-z0-9_]{2,12})(?![가-힣A-Za-z0-9_])/g), (match) => ({
    nickname: match[2],
    start: match.index + match[1].length,
    end: match.index + match[0].length,
  }));
}

/** 커서가 놓인 태그만 검색하고, 중간에서 선택해도 기존 닉네임의 끝까지 바꿔요. */
export function activeMention(text: string, caret: number) {
  const match = /(^|[\s([{])@([가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9_]{0,12})$/.exec(text.slice(0, caret));
  if (!match) return null;
  const tail = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9_]*/.exec(text.slice(caret))?.[0] ?? "";
  if (match[2].length + tail.length > 12) return null;
  return { query: match[2], start: caret - match[2].length - 1, end: caret + tail.length };
}
