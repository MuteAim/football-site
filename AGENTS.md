<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 업데이트 알림 운영

- 사용자의 상시 요청: 이 프로젝트의 업데이트를 배포하면 에이전트가 업데이트 알림 작성과 실제 발송까지 처리한다. 매번 별도의 발송 승인을 묻지 않는다. 사용자가 초안만 요청하거나 발송을 보류하라고 한 경우에는 그 요청을 따른다.
- 사용자에게 보이는 기능 추가·개선·버그 수정이 운영 환경에 배포되어 정상 동작하는 것을 확인한 뒤, 배포된 변경만 묶어 알린다. 배포 전이나 배포 실패 상태에서는 발송하지 않는다. 내부 정리나 문서만 바뀐 경우에는 회원 알림을 보내지 않는다.
- 기존 `/cafe/admin`의 업데이트 알림 형식인 `버전`, `제목`, `업데이트 내용`을 따른다. 기존 `site_updates`의 버전 규칙(현재 `0.2.x`)을 이어 다음 버전을 정하고, 같은 변경을 중복 발송하지 않는다.
- 제목은 100자 이내, 본문은 3,000자 이내의 한국어로 쓴다. 회원 입장에서 달라진 점, 이용 방법, 실제 서비스 링크를 중심으로 정리한다. 본문은 일반 텍스트와 줄바꿈을 사용하고, 링크는 `https://`로 시작하는 전체 주소로 적는다.
- 기존 업데이트 등록 경로와 승인된 운영자 접근을 사용한다. `site_updates` 등록 시 기존 DB 트리거가 회원의 `내 소식` 알림을 생성하므로 알림을 따로 중복 생성하지 않는다. 자격 증명은 코드·커밋·출력에 포함하지 않는다.
- 등록 후 저장된 업데이트와 알림 처리 결과를 확인하고, 사용자에게 배포 및 알림 완료 여부를 함께 보고한다. 접근 권한이나 연결 문제로 등록하지 못하면 실제 상태와 필요한 다음 조치를 알리고 발송했다고 표현하지 않는다.
