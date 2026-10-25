import type { NextConfig } from "next";
import { CACHE_PROFILES } from "./src/lib/cache-profiles";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // football-data.org 무료 플랜은 분당 10회까지만 호출할 수 있어서,
  // 데이터 종류별로 다시 불러오는 간격을 정해 두고 그 사이에는 저장된 결과를 보여 줘요.
  cacheLife: CACHE_PROFILES,
  images: {
    remotePatterns: [new URL("https://crests.football-data.org/**")],
    // 엠블럼은 작게만 쓰니까 작은 크기 몇 개만 만들게 해요.
    // 만드는 크기 종류가 적을수록 Vercel 무료 플랜의 이미지 변환 횟수를 아낄 수 있어요.
    imageSizes: [32, 48, 96],
    qualities: [75],
  },
  turbopack: {
    rules: {
      "*.css": {
        // CSS 모듈은 Next가 처리해야 클래스 이름과 애니메이션 연결이 유지돼요.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
