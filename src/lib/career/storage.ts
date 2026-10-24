import { CAREER_ARCHIVE_KEY, mergeRetirements, readRetirements } from "./archive";

// 레전드 로드가 브라우저에 남기는 칸이에요. 한 브라우저를 여러 계정이 번갈아 쓸 수 있어서
// 진행 중인 커리어와 은퇴 보관함을 계정마다 따로 두고, 로그인하지 않은 기록은 guest 칸에 둬요.

/** 진행 중인 커리어(시드와 선택). 뒤에 계정 칸 이름이 붙어요. */
export const CAREER_SAVE_KEY = "football-career-v1";

type CareerStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** owner는 로그인한 회원 번호예요. 로그인하지 않았으면 null이고 guest 칸을 써요. */
export function careerKeys(owner: string | null): { save: string; archive: string } {
  const scope = owner ?? "guest";
  return { save: `${CAREER_SAVE_KEY}:${scope}`, archive: `${CAREER_ARCHIVE_KEY}:${scope}` };
}

/** 진행 중인 커리어는 받는 칸이 비어 있을 때만 옮겨요. 이미 있으면 그대로 두고 false를 돌려줘요. */
function moveSave(storage: CareerStorage, from: string, to: string): boolean {
  const value = storage.getItem(from);
  if (value === null) return true;
  if (storage.getItem(to) !== null) return false;
  storage.setItem(to, value);
  storage.removeItem(from);
  return true;
}

/** 은퇴 보관함은 합쳐요. 옮길 보관함을 읽지 못하면 지우지 않고 그대로 둬요. */
function moveArchive(storage: CareerStorage, from: string, to: string) {
  if (storage.getItem(from) === null) return;
  const incoming = readRetirements(storage, from);
  storage.setItem(to, JSON.stringify(mergeRetirements(readRetirements(storage, to), incoming)));
  storage.removeItem(from);
}

/**
 * 불러오기 전에 이 브라우저의 칸을 정리해요. 다른 회원의 칸은 건드리지 않아요.
 * 1. 계정을 나누기 전의 칸(이름 뒤에 아무것도 없는 칸)은 처음 들어온 사람에게 넘겨요. 업데이트 뒤 한 번만 일어나요.
 * 2. 회원이면 로그인하기 전에 이 브라우저에서 한 기록(guest 칸)을 가져가요.
 *    은퇴 보관함은 합치고, 진행 중인 커리어는 회원에게 진행 중인 커리어가 없을 때만 가져가요.
 */
export function adoptCareerStorage(storage: CareerStorage, owner: string | null) {
  const keys = careerKeys(owner);
  const steps: [string, string, "save" | "archive"][] = [
    [CAREER_SAVE_KEY, keys.save, "save"],
    [CAREER_ARCHIVE_KEY, keys.archive, "archive"],
  ];
  if (owner) {
    const guest = careerKeys(null);
    steps.push([guest.save, keys.save, "save"], [guest.archive, keys.archive, "archive"]);
  }
  for (const [from, to, kind] of steps) {
    try {
      if (kind === "save") {
        // 받을 칸에 이미 커리어가 있으면, 계정을 나누기 전 칸의 커리어는 예전 것이라 지워요.
        if (!moveSave(storage, from, to) && from === CAREER_SAVE_KEY) storage.removeItem(from);
      } else moveArchive(storage, from, to);
    } catch {
      // 저장소를 쓸 수 없으면 다음에 다시 시도해요.
    }
  }
}
