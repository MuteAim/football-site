import { useId, type CSSProperties } from "react";
import { shotSetup, type Shot } from "@/lib/penalty";
import styles from "./penalty.module.css";

/** 사진을 내려받지 않는 작은 SVG 경기장. 실제 판정은 아래 타이밍 게이지와 같아요. */
export function PenaltyPitch({ day, index, shot }: { day: string; index: number; shot: Shot | null }) {
  const id = useId().replaceAll(":", "");
  const setup = shotSetup(day, index);
  const targetX = 100 + setup.target * 0.4;
  const ballX = shot ? 100 + shot.position * 0.4 : 300;
  const scored = !!shot?.streak;
  const keeperX = shot ? scored ? (ballX > 300 ? 230 : 370) : ballX : 300;
  const ballStyle = { "--ball-x": `${ballX - 300}px`, "--ball-y": "-184px" } as CSSProperties;
  return (
    <svg viewBox="0 0 600 340" className="block w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#101e2b" /><stop offset="1" stopColor="#213b43" /></linearGradient>
        <linearGradient id={`${id}-grass`} x2="0" y2="1"><stop stopColor="#164d3e" /><stop offset="1" stopColor="#102c26" /></linearGradient>
        <pattern id={`${id}-net`} width="18" height="16" patternUnits="userSpaceOnUse"><path d="M18 0H0V16" fill="none" stroke="white" strokeOpacity=".18" strokeWidth="1" /></pattern>
      </defs>
      <rect width="600" height="340" fill={`url(#${id}-sky)`} />
      <path d="M0 36L200 175H60ZM600 36L400 175H540Z" fill="#d8f9e8" opacity=".05" />
      <path d="M0 75Q300 130 600 75V175H0Z" fill="#12282b" />
      {[98, 116, 134].map((y) => <path key={y} d={`M0 ${y}Q300 ${y + 30} 600 ${y}`} stroke="#88b7a6" strokeOpacity=".18" strokeWidth="4" strokeDasharray="2 11" />)}
      <path d="M24 32H80M520 32H576" stroke="#edfff5" strokeWidth="7" strokeDasharray="8 4" />
      <path d="M52 37V147M548 37V147" stroke="#7a9992" strokeWidth="3" />
      <path d="M0 169H600V340H0Z" fill={`url(#${id}-grass)`} />
      <path d="M0 215H600M0 295H600" stroke="white" strokeOpacity=".025" strokeWidth="40" />
      <path d="M100 174L26 286H574L500 174M201 286Q300 327 399 286" stroke="#a9dbb6" strokeOpacity=".35" strokeWidth="2" fill="none" />
      <path d="M100 70L118 92H482L500 70V184H100Z" fill="#081d1b" fillOpacity=".5" />
      <path d="M100 70H500V184H100ZM118 92H482V174H118Z" fill={`url(#${id}-net)`} />
      <path d="M100 70L118 92M500 70L482 92M100 184L118 174M500 184L482 174" stroke="white" strokeOpacity=".3" />
      <rect x={targetX - setup.width * 0.2} y="80" width={setup.width * 0.4} height="96" rx="5" fill="#c5f579" opacity=".22" />
      <rect x={targetX - setup.width / 15} y="80" width={setup.width * 2 / 15} height="96" rx="3" fill="#fcd66c" opacity=".5" />
      <circle cx={targetX} cy="120" r="15" fill="none" stroke="#fce9a6" strokeWidth="2" />
      <path d={`M${targetX - 7} 120H${targetX + 7}M${targetX} 113V127`} stroke="#fce9a6" strokeWidth="2" />
      <path d="M98 184V68H502V184" fill="none" stroke="#ecf5eb" strokeWidth="6" strokeLinejoin="round" />
      <ellipse cx={keeperX} cy="184" rx="26" ry="5" fill="black" opacity=".2" />
      <g className={styles.keeper} style={{ transform: `translate(${keeperX}px, 144px) rotate(${shot ? (keeperX < 300 ? -26 : 26) : 0}deg)` }}>
        <circle cy="-20" r="10" fill="#e7bd8d" />
        <path d="M-13 -7H13L17 19H-17Z" fill="#fb8b63" />
        <path d="M-13 -3L-30 -14M13 -3L30 -14" stroke="#fb8b63" strokeWidth="10" strokeLinecap="round" />
        <path d="M-30 -14L-34 -19M30 -14L34 -19" stroke="#fff6d9" strokeWidth="9" strokeLinecap="round" />
        <path d="M-9 19L-16 37M9 19L16 37" stroke="#193047" strokeWidth="10" strokeLinecap="round" />
        <text y="12" textAnchor="middle" fill="#412d2a" fontSize="13" fontWeight="900">1</text>
      </g>
      <ellipse cx="300" cy="312" rx="18" ry="5" fill="black" opacity=".25" />
      <g key={`${index}-${shot?.grade ?? "ready"}`} className={shot && shot.grade !== "timeout" ? styles.ballShot : ""} style={ballStyle}>
        <circle cx="300" cy="304" r="14" fill="#f5f6ed" stroke="#c5cfbf" />
        <path d="M300 296L307 301L304 309H296L293 301Z" fill="#1c2b2c" />
        <path d="M300 296V290M307 301L313 298M304 309L308 315M296 309L292 315M293 301L287 298" stroke="#1c2b2c" strokeWidth="2" />
      </g>
      <circle cx="300" cy="265" r="2.5" fill="white" opacity=".6" />
    </svg>
  );
}
