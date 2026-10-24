import { ImageResponse } from "next/og";
import { getCareerCard } from "@/lib/cafe/career-cards";
import { NATIONS, POSITIONS } from "@/lib/career/data";

export const alt = "레전드 로드 공유 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 카드에 쓰는 글자만 담은 한글 글꼴을 받아요. 받지 못하면 기본 글꼴로 그려요. */
async function koreanFont(text: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const response = await fetch(url);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const shared = await getCareerCard((await params).code);
  const card = shared?.card;
  const t = card?.totals;
  const name = card?.name ?? "레전드 로드";
  const sub = card ? `${POSITIONS[card.pos as keyof typeof POSITIONS]?.name ?? card.pos} · ${NATIONS[card.nation as keyof typeof NATIONS]?.name ?? card.nation} · ${t!.firstYear}–${t!.lastYear}` : "유망주에서 발롱도르까지";
  const title = card ? `「${card.title}」` : "나만의 축구 인생을 만들어 보세요";
  const score = card ? card.score.toLocaleString("ko-KR") : "";
  const stats: [string, string][] = card && t ? [
    ["시즌", `${t.seasons}`], ["경기", t.apps.toLocaleString("ko-KR")],
    card.pos === "GK" ? ["무실점", `${t.cleanSheets}`] : ["골", `${t.goals}`], ["발롱도르", `${t.ballonDor}`], ["트로피", `${t.trophies}`],
  ] : [];
  const by = shared ? `${shared.nickname} 님의 선수 · ${card!.grade}` : "";
  const text = [name, sub, title, score, by, "LEGEND ROAD SCORE 레전드 점수 점 해외축구 MATCHDAY", ...stats.flat()].join("");
  const [bold, regular] = await Promise.all([koreanFont(text, 900), koreanFont(text, 500)]);
  const fonts = [
    ...(bold ? [{ name: "Noto Sans KR", data: bold, weight: 900 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Noto Sans KR", data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px", background: "linear-gradient(135deg, #0d1f19, #1d3a2c)", color: "white", fontFamily: "Noto Sans KR" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 900, letterSpacing: 6, color: "#d4f77d" }}>LEGEND ROAD</div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>해외축구 MATCHDAY</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{sub}</div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>{name}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 34, fontWeight: 900, color: "#fcd34d" }}>{title}</div>
          </div>
          {card ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 900, letterSpacing: 4, color: "rgba(217,249,157,0.75)" }}>LEGEND SCORE</div>
              <div style={{ display: "flex", alignItems: "baseline", color: "#d4f77d" }}>
                <span style={{ fontSize: 132, fontWeight: 900, letterSpacing: -4 }}>{score}</span>
                <span style={{ marginLeft: 10, fontSize: 36, fontWeight: 900 }}>점</span>
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            {stats.map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", marginRight: 44 }}>
                <span style={{ fontSize: 20, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>{label}</span>
                <span style={{ fontSize: 40, fontWeight: 900, color: label === "발롱도르" && value !== "0" ? "#fcd34d" : "white" }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>{by}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
