import { Suspense } from "react";
import { MyTeamSection } from "@/components/cafe/MyTeamCard";
import { DayMatches } from "@/components/DayMatches";

// 홈은 오늘(한국 시간) 열리는 전체 대회 경기를 보여 줘요.
// 응원팀을 고른 회원에게는 맨 위에 내 팀 카드를 따로 붙여요. 이 자리만 요청 때마다 그려요.
export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <MyTeamSection />
      </Suspense>
      <DayMatches />
    </>
  );
}
