// 한국어 문장을 자연스럽게 만드는 작은 도우미예요.

/** 낱말 뒤에 붙일 "을"과 "를" 중 맞는 쪽을 골라요. 한글로 끝나지 않으면 "을(를)"이에요. */
export function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 === 0 ? "를" : "을";
}
