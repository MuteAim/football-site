"use client";

import { useCallback, useEffect, useId, useRef, type CSSProperties } from "react";
import type { CareerCinematicScene, FinalCinematic } from "@/lib/career/cinematics";
import { TrophyIcon } from "../Icons";
import styles from "./career.module.css";

function FinalScene({ scene }: { scene: FinalCinematic }) {
  const direction = scene.direction === "L" ? -1 : scene.direction === "R" ? 1 : 0;
  const opposite = direction === 0 ? -62 : -direction * 62;
  // 선방 장면의 선택은 골키퍼 방향이고, 슈팅 장면의 선택은 공 방향이에요.
  const x = scene.shot === "wide" ? 154 : scene.kind === "save" && scene.shot === "goal" ? opposite : direction * 60;
  const keeper = scene.kind === "save" || scene.shot === "saved" ? direction * 60 : opposite;
  return (
    <div className={styles.finalPitch} aria-hidden="true">
      <svg viewBox="0 0 480 245" className={styles.pitchArt}>
        <defs><pattern id="career-goal-net" width="15" height="13" patternUnits="userSpaceOnUse"><path d="M15 0H0V13" fill="none" stroke="white" strokeOpacity=".2" /></pattern></defs>
        <path d="M25 225L125 26H355L455 225Z" fill="#19533d" />
        <path d="M25 225H455M63 150H417M104 70H376M170 225L190 128H290L310 225" fill="none" stroke="#bce7c2" strokeOpacity=".25" />
        <ellipse cx="240" cy="182" rx="38" ry="11" fill="none" stroke="white" strokeOpacity=".22" />
        <path d="M139 100V24H341V100" fill="url(#career-goal-net)" stroke="#efffe9" strokeWidth="5" strokeLinejoin="round" />
        <path d="M139 100H341" stroke="white" strokeOpacity=".35" />
        <g data-cinematic-keeper className={styles.finalKeeper} style={{ "--keeper-x": `${keeper}px`, "--keeper-turn": `${keeper === 0 ? 0 : keeper < 0 ? -48 : 48}deg` } as CSSProperties}>
          <circle cx="240" cy="61" r="10" fill="#ffd8ad" />
          <path d="M227 84L210 68M253 84L270 68M234 93L225 114M246 93L255 114" stroke="#c8f46c" strokeWidth="9" strokeLinecap="round" />
          <path d="M227 76H253L250 98H230Z" fill="#d4f77d" />
          <circle cx="207" cy="65" r="6" fill="white" /><circle cx="273" cy="65" r="6" fill="white" />
        </g>
        <ellipse className={styles.ballShadow} cx="240" cy="199" rx="17" ry="5" fill="black" opacity=".25" />
        <g data-cinematic-ball className={styles.finalShot} style={{ "--shot-x": `${x}px`, "--shot-y": `${scene.shot === "wide" ? -164 : -132}px` } as CSSProperties}>
          <circle cx="240" cy="187" r="13" fill="white" />
          <path d="M240 179L246 183L244 190H236L234 183ZM229 186L232 195M248 195L252 186M235 175L244 175" fill="#102c26" stroke="#102c26" strokeWidth="2" />
        </g>
      </svg>
      <div className={styles.shotLabel}>{scene.shot === "goal" ? "GOAL" : scene.shot === "saved" ? "SAVED" : "OFF TARGET"}</div>
    </div>
  );
}

export function CareerCinematic({ scene, onDone }: { scene: CareerCinematicScene; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const finished = useRef(false);
  const title = useId();
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    dialog.current?.close();
    onDone();
  }, [onDone]);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    const timer = window.setTimeout(finish, scene.duration);
    return () => window.clearTimeout(timer);
  }, [scene.duration, finish]);
  const awards = scene.type === "awards";
  return (
    <dialog ref={dialog} aria-labelledby={title} data-career-cinematic={scene.type} data-shot={scene.type === "final" ? scene.shot : undefined}
      className={styles.cinematic} onClose={finish} onCancel={(event) => { event.preventDefault(); finish(); }}>
      <div className={styles.cinematicScene} style={{ "--scene-duration": `${scene.duration}ms` } as CSSProperties}>
        <div className={styles.spotlight} aria-hidden="true" />
        {awards ? <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{
          "--x": `${(i * 37 + 9) % 100}%`, "--delay": `${(i % 7) * 80}ms`, "--turn": `${i % 2 ? 360 : -360}deg`,
          backgroundColor: ["#e9c15b", "#d4f77d", "#fff1bd", "#ffffff"][i % 4],
        } as CSSProperties} />)}</div> : null}
        <p className={styles.cinematicEyebrow}>{awards ? scene.ballonDor ? "BALLON D’OR" : "AWARDS NIGHT" : "THE FINAL MOMENT"}</p>
        <p className={styles.cinematicSubtitle}>{scene.subtitle}</p>
        {scene.type === "final" ? <>
          <h2 id={title} className={styles.finalTitle}>{scene.title} 결승</h2>
          <p className={styles.finalVersus}>{scene.player} <span>vs</span> {scene.opponent}</p>
          <FinalScene scene={scene} />
          <div className={styles.cinematicResult}>
            <p className={scene.won ? styles.winner : styles.runnerUp}>{scene.won ? "CHAMPIONS" : "끝까지 싸웠다"}</p>
            <p className={styles.resultStory}>{scene.result}</p>
          </div>
        </> : <>
          <div className={`${styles.awardEmblem} ${scene.ballonDor ? styles.goldenBall : ""}`} aria-hidden="true">
            {scene.ballonDor ? <span className={styles.goldSphere}><span>★</span></span> : <TrophyIcon className="size-20" />}
          </div>
          <p className={styles.awardPlayer}>{scene.player}</p>
          <h2 id={title} className={styles.awardTitle}>{scene.title}</h2>
          <p className={styles.awardCaption}>{scene.ballonDor ? "세계 최고의 선수, 그 이름을 새기다." : "이번 시즌의 빛나는 순간을 기억하세요."}</p>
          {scene.honors.length > 1 ? <ul className={styles.awardHonors}>{scene.honors.slice(1).map((honor) => <li key={honor}>{honor}</li>)}</ul> : null}
        </>}
        <button type="button" data-cinematic-skip onClick={finish} className={styles.cinematicContinue}>계속하기 <span aria-hidden="true">→</span></button>
        <p className={styles.cinematicHint}>잠시 후 자동으로 이어져요 · Esc로 넘기기</p>
        <div className={styles.cinematicTimer} aria-hidden="true"><span /></div>
      </div>
    </dialog>
  );
}
