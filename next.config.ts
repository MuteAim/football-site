import type { NextConfig } from "next";
import { CACHE_PROFILES } from "./src/lib/cache-profiles";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // football-data.org 무료 플랜은 분당 10회까지만 호출할 수 있어서,
  // 데이터 종류별로 다시 불러오는 간격을 정해 두고 그 사이에는 저장된 결과를 보여 줘요.
  cacheLife: CACHE_PROFILES,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
