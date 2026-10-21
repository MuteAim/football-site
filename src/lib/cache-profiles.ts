// 데이터 종류별 캐시 시간이에요. 단위는 초입니다.
// stale은 브라우저가 들고 있는 시간, revalidate는 서버가 football-data.org를 다시 부르는 간격,
// expire는 아무도 안 볼 때 최대로 보관하는 시간이에요.
// next.config.ts의 cacheLife와 API 응답 캐시가 모두 이 값을 같이 씁니다.
// 무료 플랜은 분당 10회 호출 제한이 있으니 revalidate를 너무 줄이지 마세요.
export const CACHE_PROFILES = {
  matches: { stale: 300, revalidate: 300, expire: 86400 },
  standings: { stale: 300, revalidate: 600, expire: 86400 },
  scorers: { stale: 300, revalidate: 1800, expire: 86400 },
};
