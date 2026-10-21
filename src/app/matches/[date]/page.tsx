import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DayMatches } from "@/components/DayMatches";
import { DaySkeleton } from "@/components/Skeletons";
import { addDays, formatDayHeading, isDateKey, todayKst } from "@/lib/time";

// 동적 경로는 빌드할 때 최소 하나를 미리 만들어야 해서, 빌드 시점의 내일 날짜를 넣었어요.
// 다른 날짜는 첫 방문 때 만들어 저장해 두고, 다음 방문자부터는 저장된 페이지를 받아요.
export function generateStaticParams() {
  return [{ date: addDays(todayKst(), 1) }];
}

export async function generateMetadata({ params }: PageProps<"/matches/[date]">): Promise<Metadata> {
  const { date } = await params;
  return { title: isDateKey(date) ? `${formatDayHeading(date)} 경기 일정` : "날짜를 찾을 수 없어요" };
}

async function DateContent({ params }: { params: PageProps<"/matches/[date]">["params"] }) {
  const { date } = await params;
  if (!isDateKey(date)) notFound();
  return <DayMatches date={date} />;
}

export default function DatePage({ params }: PageProps<"/matches/[date]">) {
  return (
    <Suspense fallback={<DaySkeleton rows={8} />}>
      <DateContent params={params} />
    </Suspense>
  );
}
