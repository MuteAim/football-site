import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeagueHeader } from "@/components/LeagueHeader";
import { HeaderSkeleton } from "@/components/Skeletons";
import { CompetitionNav } from "@/components/SiteNav";
import { getCompetition } from "@/lib/competitions";

// 가장 많이 볼 프리미어리그만 빌드할 때 미리 만들어요.
// 모든 대회를 빌드 때 만들면 무료 API 호출 한도를 바로 넘기 때문이에요.
// 나머지 대회는 첫 방문 때 만들어 저장해 두고, 다음 방문자부터는 저장된 페이지를 받아요.
export function generateStaticParams() {
  return [{ code: "PL" }];
}

async function Header({ params }: { params: LayoutProps<"/league/[code]">["params"] }) {
  const { code } = await params;
  const competition = getCompetition(code);
  if (!competition) notFound();
  return <><CompetitionNav activeCode={code} /><LeagueHeader competition={competition} /></>;
}

export default function LeagueLayout({ children, params }: LayoutProps<"/league/[code]">) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}
