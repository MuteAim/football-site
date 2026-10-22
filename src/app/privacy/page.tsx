import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cardClass, mutedClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "해외축구 카페가 어떤 개인정보를 왜 모으고, 어디에 두고, 언제 지우는지 알려 드려요.",
};

// 개인정보 보호책임자와 시행일이에요. 바뀌면 여기만 고치면 돼요.
// 내용을 바꿀 때는 시행일도 같이 바꿔 주세요.
const OFFICER = { name: "해외축구 카페 운영자", email: "ji_hyunsoo@naver.com" };
const EFFECTIVE_DATE = "2026년 10월 22일";

const linkClass =
  "font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-current dark:text-emerald-400 dark:decoration-emerald-400/30";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-zinc-100 px-5 py-5 dark:border-white/[0.07]">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <div className="mt-2.5 space-y-2.5 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-zinc-400">{children}</ul>;
}

/** 이름표가 붙은 작은 표. 휴대폰에서도 옆으로 넘기지 않게 줄 단위로 쌓아요. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-zinc-100 rounded-xl bg-zinc-50 px-3.5 text-sm dark:divide-white/[0.06] dark:bg-white/[0.03]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3 py-2">
          <dt className={`w-20 shrink-0 font-medium ${mutedClass}`}>{label}</dt>
          <dd className="min-w-0 flex-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PrivacyPage() {
  return (
    <article className={`${cardClass} mx-auto max-w-2xl break-keep`}>
      <header className="px-5 pt-6 pb-5">
        <h1 className="text-2xl font-bold tracking-tight">개인정보 처리방침</h1>
        <p className={`mt-2 text-[15px] leading-relaxed ${mutedClass}`}>
          해외축구 일정·순위 사이트(이하 &lsquo;사이트&rsquo;)는 카페 회원 서비스에 꼭 필요한 정보만 처리해요. 로그인하지
          않고 경기 일정과 순위만 볼 때는 아래 &lsquo;자동으로 남는 정보&rsquo; 말고는 모으지 않아요.
        </p>
        <p className={`mt-2 text-sm ${mutedClass}`}>시행일 {EFFECTIVE_DATE}</p>
      </header>

      <Section title="1. 처리하는 개인정보">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">카카오·구글로 로그인할 때 받는 정보</p>
        <List>
          <li>카카오: 회원번호, 카카오톡 닉네임, 프로필 사진 주소, 이메일(동의한 경우에만)</li>
          <li>구글: 계정 고유 번호, 이름, 프로필 사진 주소, 이메일</li>
        </List>
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">카페에서 직접 입력하는 정보</p>
        <List>
          <li>카페 닉네임, 응원하는 팀</li>
          <li>직접 쓴 글, 댓글, 응원톡과 추천 기록</li>
        </List>
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">자동으로 남는 정보</p>
        <List>
          <li>로그인 상태를 유지하는 쿠키</li>
          <li>접속 기록(IP 주소, 접속 시각, 브라우저 종류). 사이트를 운영하는 업체의 기록에 짧게 남아요.</li>
        </List>
        <p>실명, 전화번호, 생년월일, 주소, 결제 정보는 받지 않아요.</p>
      </Section>

      <Section title="2. 쓰는 곳">
        <List>
          <li>회원을 구분하고 로그인 상태를 유지해요.</li>
          <li>
            글, 댓글, 응원톡에 작성자를 표시해요. 다른 사람에게는 카페 닉네임과 응원팀만 보여요. 카카오·구글 이름, 이메일,
            계정 번호는 보이지 않아요.
          </li>
          <li>도배, 욕설 같은 부정 이용을 막고 신고와 분쟁에 대응해요.</li>
          <li>법령에 따른 요청에 대응해요.</li>
        </List>
      </Section>

      <Section title="3. 보관 기간과 지우는 방법">
        <List>
          <li>
            회원 정보는 탈퇴할 때까지 보관해요. 탈퇴하면 계정 정보, 닉네임, 응원팀과 직접 쓴 글·댓글·응원톡·추천 기록을 바로
            함께 지워요. 탈퇴한 회원의 글에 달린 댓글도 같이 지워져요.
          </li>
          <li>접속 기록은 운영 업체가 정한 짧은 기간 동안만 남았다가 저절로 지워져요.</li>
          <li>다른 법령이 보관하라고 정한 정보는 그 기간 동안만 따로 보관해요.</li>
          <li>지울 때는 되살릴 수 없는 방법으로 지워요.</li>
        </List>
      </Section>

      <Section title="4. 다른 곳에 주는 경우">
        <p>
          회원의 동의 없이 개인정보를 다른 곳에 주지 않아요. 수사기관 등이 법령에 정해진 절차에 따라 요구할 때만 예외예요.
        </p>
      </Section>

      <Section title="5. 처리를 맡기는 곳과 국외 이전">
        <p>사이트를 운영하려고 아래 업체에 처리를 맡겨요. 두 업체 모두 미국 회사예요.</p>
        <Facts
          rows={[
            ["업체", "Supabase Inc. (미국)"],
            ["맡기는 일", "회원 정보와 글 저장, 로그인 처리"],
            ["저장 위치", "대한민국 서울 (Amazon Web Services 서울 지역)"],
            ["보관 기간", "탈퇴할 때까지"],
          ]}
        />
        <Facts
          rows={[
            ["업체", "Vercel Inc. (미국)"],
            ["맡기는 일", "사이트 화면을 만들어 보내는 일"],
            ["옮겨 가는 곳", "미국 동부의 Vercel 서버"],
            ["옮겨 가는 정보", "로그인 쿠키, 회원 정보, 글 내용, 접속 기록"],
            ["옮기는 때와 방법", "사이트를 쓸 때마다 암호화된 인터넷 연결로 보내요"],
            ["보관 기간", "화면을 만드는 동안만 쓰고 따로 저장하지 않아요. 접속 기록은 짧게 남았다가 지워져요."],
          ]}
        />
        <p>
          회원 정보가 국외로 옮겨 가는 것을 원하지 않으면 로그인하지 않으면 돼요. 이때 경기 일정·순위와 카페 글 읽기는 그대로
          쓸 수 있지만, 글쓰기 같은 회원 기능은 쓸 수 없어요. 로그인하지 않아도 접속 기록은 Vercel 서버에 짧게 남아요.
        </p>
        <p>
          로그인 수단인 카카오(주식회사 카카오)와 Google LLC는 로그인할 때 1번의 정보를 사이트에 넘겨줘요. 사이트가 이
          회사들에 회원 정보를 보내지는 않아요.
        </p>
      </Section>

      <Section title="6. 회원의 권리와 행사 방법">
        <List>
          <li>카페 닉네임과 응원팀은 내 정보 화면에서 언제든 바꿀 수 있어요.</li>
          <li>직접 쓴 글, 댓글, 응원톡은 언제든 직접 지울 수 있어요.</li>
          <li>
            내 정보를 보거나 고치거나 지우는 것(탈퇴), 처리를 멈추는 것은 아래 연락처로 요청해 주세요. 본인인지 확인한 뒤
            10일 안에 처리해요.
          </li>
          <li>
            카카오계정의 &lsquo;연결된 서비스 관리&rsquo;나 Google 계정의 &lsquo;타사 앱 및 서비스&rsquo;에서 이 사이트와의
            연결을 끊을 수 있어요. 연결을 끊어도 사이트에 저장된 정보는 남아 있으니, 지우려면 탈퇴를 요청해 주세요.
          </li>
          <li>만 14세 미만은 가입할 수 없어요.</li>
        </List>
      </Section>

      <Section title="7. 쿠키와 브라우저 저장소">
        <List>
          <li>
            <code className="font-mono text-[13px]">sb-</code>로 시작하는 쿠키에 로그인 상태를 저장해요. 로그아웃하면
            지워져요.
          </li>
          <li>같은 창에서 이미 본 글 번호를 브라우저에 잠깐 적어 둬서 조회수를 두 번 세지 않아요. 창을 닫으면 사라져요.</li>
          <li>광고나 방문 분석용 쿠키는 쓰지 않아요.</li>
          <li>브라우저 설정에서 쿠키를 막을 수 있어요. 다만 그러면 로그인할 수 없어요.</li>
        </List>
      </Section>

      <Section title="8. 안전하게 지키는 방법">
        <List>
          <li>모든 통신을 HTTPS로 암호화해요.</li>
          <li>
            DB 권한 규칙으로 회원 정보와 글은 본인만 고칠 수 있어요. 이메일과 계정 번호는 사이트 화면이나 공개된 연결 통로로
            읽을 수 없어요.
          </li>
          <li>회원 정보를 볼 수 있는 관리 화면에는 운영자만 들어갈 수 있어요.</li>
        </List>
      </Section>

      <Section title="9. 개인정보 보호책임자와 문의">
        <Facts
          rows={[
            ["책임자", OFFICER.name],
            [
              "이메일",
              <a key="email" href={`mailto:${OFFICER.email}`} className={linkClass}>
                {OFFICER.email}
              </a>,
            ],
          ]}
        />
        {/* <p>개인정보 침해로 도움이 필요하면 아래 기관에도 문의할 수 있어요.</p>
        <List>
          <li>개인정보침해신고센터: privacy.kisa.or.kr, 국번 없이 118</li>
          <li>개인정보 분쟁조정위원회: kopico.go.kr, 1833-6972</li>
          <li>대검찰청: spo.go.kr, 국번 없이 1301</li>
          <li>경찰청: ecrm.police.go.kr, 국번 없이 182</li>
        </List> */}
      </Section>

      <Section title="10. 바뀔 때">
        <p>이 방침이 바뀌면 시행일을 고치고 이 화면에서 알려 드려요.</p>
      </Section>
    </article>
  );
}
