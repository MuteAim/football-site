# 해외축구 일정·순위

football-data.org 무료 API로 만든 해외축구 정보 사이트예요.
경기 일정, 결과, 순위, 득점 순위를 모두 한국 시간 기준으로 보여 줍니다.

## 실행하기

```bash
npm install
cp .env.example .env.local   # 복사한 파일에 football-data.org 키를 넣어 주세요.
npm run dev                  # http://localhost:3000
```

배포 전처럼 확인하려면 `npm run build` 후 `npm run start`를 실행하세요.
개발 모드에서는 캐시와 링크 미리 불러오기가 실제 배포와 다르게 동작해요.

## 페이지

| 주소 | 내용 |
| --- | --- |
| `/` | 오늘 열리는 전체 대회 경기 |
| `/matches/2026-10-25` | 특정 날짜의 경기, 오늘 기준 앞뒤 60일까지 |
| `/league/PL` | 순위표 |
| `/league/PL/fixtures` | 다가오는 경기 |
| `/league/PL/results` | 지난 경기 결과 |
| `/league/PL/scorers` | 득점 순위 상위 20명 |

대회 코드는 PL, PD, BL1, SA, FL1, CL, ELC, DED, PPL, BSA, CLI, WC, EC예요.

## 폴더 구조

| 파일 | 역할 |
| --- | --- |
| `src/lib/football-data.ts` | API 호출과 캐시 |
| `src/lib/cache-profiles.ts` | 데이터 종류별 캐시 시간 |
| `src/lib/competitions.ts` | 대회 목록과 한글 이름 |
| `src/lib/teams-ko.ts` | 팀 한글 이름 |
| `src/lib/time.ts` | 한국 시간 변환과 날짜 묶기 |
| `src/components/` | 화면 조각 |
| `src/app/` | 페이지 |

## API 호출 한도 관리

무료 플랜은 분당 10회까지만 호출할 수 있어서 이렇게 막아 두었어요.

- 같은 데이터는 정해진 간격에 한 번만 불러요. 경기는 5분, 순위는 10분, 득점 순위는 30분이에요.
- 페이지 결과와 API 응답을 둘 다 저장해요. Vercel에서는 API 응답 저장소를 모든 서버가 같이 써요.
- 빌드할 때는 홈과 프리미어리그 페이지만 미리 만들어요. API는 4번만 불러요.
- 나머지 대회 페이지는 첫 방문 때 만들어 저장하고, 다음 방문자부터는 저장된 페이지를 받아요.
- 상단 대회 메뉴는 링크 미리 불러오기를 꺼 두었어요.
  켜 두면 화면에 보이는 대회마다 페이지를 미리 만들면서 API 호출이 한꺼번에 몰려요.
  대신 누르는 순간 메뉴가 깜빡여서 눌린 걸 바로 알 수 있어요.
- 날짜 버튼은 미리 불러오기를 켜 두었어요. 날짜 페이지들은 같은 API 응답을 나눠 써서 호출이 늘지 않아요.

캐시가 실제로 쓰이는지 확인하려면 이렇게 실행하세요.

```bash
NEXT_PRIVATE_DEBUG_CACHE=1 npm run start
```

## 화면 속도

- **팀 엠블럼은** Next.js 이미지 최적화로 작은 WebP로 바꿔서 이 사이트 주소에서 내려줘요.
  원본 PNG보다 용량이 훨씬 작고, 엠블럼 서버까지 따로 갔다 오지 않아요.
  만드는 크기를 세 가지로 제한해서 Vercel 무료 플랜의 이미지 변환 한도 안에 들어와요.
- **글꼴은** 웹폰트를 받지 않고 기기에 있는 한글 글꼴을 써요.
  글꼴 파일을 기다리거나 도중에 글꼴이 바뀌면서 화면이 다시 그려지는 일이 없어요.
  Pretendard로 되돌리고 싶으면 `src/app/layout.tsx`에 Pretendard CSS 링크를 다시 넣으면 돼요.

## Vercel 배포

1. 이 폴더를 GitHub 저장소로 올리고 Vercel에서 가져와요.
2. Vercel 프로젝트 설정의 Environment Variables에 `FOOTBALL_DATA_API_KEY`를 넣어요. 빌드할 때도 필요해요.
3. 광고를 붙이면 Vercel 무료 플랜 약관상 상업적 이용이라 유료 플랜이 필요해요.

## 한글 팀 이름 추가

`src/lib/teams-ko.ts`에 팀 ID와 이름을 넣으면 돼요. 팀 ID는 아래처럼 확인해요.

```bash
curl -H "X-Auth-Token: 내_키" https://api.football-data.org/v4/competitions/PL/teams
```

5대 리그, 챔피언십, 에레디비시, 프리메이라 리가, 챔피언스리그 참가팀은 들어 있어요.
브라질 리그, 코파 리베르타도레스, 국가대표는 영어 이름으로 나와요.

## 알아 둘 점

- 무료 플랜은 스코어와 일정이 몇 분 늦게 반영돼요.
- 라인업과 골 시간 같은 경기 상세 정보는 무료 플랜에 없어요.
- API의 최종 점수에는 승부차기 골이 합쳐져 있어서, 화면에서는 정규·연장 점수와 승부차기 점수를 따로 계산해요.
- 끝난 토너먼트는 순위표 API가 404를 줘서 "순위표 없음"으로 보여 줘요.
- `npm audit` 경고는 린트 도구 쪽 패키지에만 해당해요. `npm audit fix --force`는 린트 설정을 옛 버전으로 내리니 실행하지 마세요.
