"use client";

import { ErrorState } from "@/components/ErrorState";

export default function CafeErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      title="카페 글을 불러오지 못했어요."
      description="잠시 연결이 불안정했을 수 있어요. 다시 시도해 주세요."
    />
  );
}
