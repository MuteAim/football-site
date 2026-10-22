// 글과 댓글 본문. HTML로 해석하지 않고 글자 그대로 보여 줘서 악성 코드를 심을 수 없어요.
// 줄바꿈은 그대로 살리고, http로 시작하는 주소만 눌러서 열 수 있게 바꿔요.
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;
const TRAILING = /[.,!?)\]}'"]+$/;

function splitLinks(text: string) {
  const parts: { text: string; href?: string }[] = [];
  for (const [index, chunk] of text.split(URL_PATTERN).entries()) {
    if (index % 2 === 0) {
      if (chunk) parts.push({ text: chunk });
      continue;
    }
    // 문장 끝 마침표나 괄호는 주소에서 떼어 내요.
    const tail = TRAILING.exec(chunk)?.[0] ?? "";
    const href = tail ? chunk.slice(0, -tail.length) : chunk;
    parts.push({ text: href, href });
    if (tail) parts.push({ text: tail });
  }
  return parts;
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`break-words whitespace-pre-wrap ${className}`}>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            className="break-all text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-current dark:text-emerald-400 dark:decoration-emerald-400/30"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </div>
  );
}
