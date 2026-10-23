// 실행 중인 로컬 서버와 설치된 Edge로 레전드 로드를 처음부터 은퇴까지 한 번 플레이해요.
// 사용자 브라우저 프로필은 쓰지 않고 임시 프로필만 써요. 순위 도전은 DB 테스트(test:career)가 맡아요.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.CAREER_TEST_URL ?? "http://127.0.0.1:3000";
const executable = process.env.CAREER_TEST_BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const directory = await mkdtemp(join(tmpdir(), "football-career-qa-"));
const browser = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${directory}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
let launchError;
browser.on("error", (error) => { launchError = error; });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let closeBrowser;
const errors = [];
try {
  let port;
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError;
    try { port = (await readFile(join(directory, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch {}
    await sleep(150);
  }
  assert.ok(port, "테스트 브라우저를 열지 못했어요.");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      clearTimeout(task.timer); pending.delete(message.id);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`시간 초과: ${method}`)); }, 55000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const reply = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result.value;
  };
  closeBrowser = () => command("Browser.close").catch(() => {});
  // 새로 고치는 중에는 document.body가 없을 수 있어서 실패를 '아직'으로 봐요.
  const waitFor = async (expression, tries = 200) => {
    for (let i = 0; i < tries; i++) {
      if (await evaluate(`(() => { try { return Boolean(${expression}); } catch { return false; } })()`).catch(() => false)) return;
      await sleep(100);
    }
    throw new Error(`화면 대기 실패: ${expression}`);
  };
  const screenshot = async (name) => {
    const { data } = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const file = join(directory, name);
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`화면 저장: ${file}`);
  };
  const clickText = (text, selector = "button") => evaluate(`(() => { const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((item) => item.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const noOverflow = async (label) => assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), `${label} 가로 넘침`);

  await command("Runtime.enable"); await command("Page.enable");
  await command("Page.navigate", { url: `${base}/games/career?score=1500&day=2026-10-23` });
  await waitFor(`Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('새 커리어 시작') || b.textContent.includes('오늘의 순위에 도전'))`);
  assert.ok(await evaluate(`document.body.innerText.includes('레전드 점수 1,500점')`), "도전장 안내");
  for (const width of [320, 390, 1280]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await sleep(150);
    await noOverflow(`첫 화면 ${width}px`);
  }
  await screenshot("career-intro.png");

  // 선수 만들기: 실제 키 입력으로 이름을 쓰고, 국적·포지션·후보를 골라요.
  assert.ok(await clickText("새 커리어 시작") || await clickText("연습 커리어"));
  await waitFor("document.getElementById('career-name')");
  for (const width of [320, 1280]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await sleep(150);
    await noOverflow(`선수 만들기 ${width}px`);
  }
  await clickText("커리어 시작");
  await waitFor(`document.getElementById('career-name-help').textContent.includes('이름을 지어')`);
  await evaluate("document.getElementById('career-name').focus()");
  await command("Input.insertText", { text: "테스트맨" });
  await evaluate(`Array.from(document.querySelectorAll('input[name="career-pos"]')).find((input) => input.value === 'WG').click()`);
  await evaluate(`document.querySelectorAll('input[name="career-pick"]')[1].click()`);
  // 다시 뽑기를 누르면 고른 자리(빅클럽·중위권·하위권)는 그대로 두고 새 후보 세 명이 나와요.
  const candidateText = `Array.from(document.querySelectorAll('input[name="career-pick"]')).map((input) => input.closest('label').innerText).join('|')`;
  const beforeRoll = await evaluate(candidateText);
  assert.ok(await clickText("다시 뽑기"));
  await waitFor(`${candidateText} !== ${JSON.stringify(beforeRoll)}`);
  assert.ok(await evaluate(`document.querySelectorAll('input[name="career-pick"]')[1].checked`), "다시 뽑아도 고른 자리는 그대로예요");
  await noOverflow("다시 뽑기 후");
  await screenshot("career-create.png");
  assert.ok(await clickText("테스트맨의 커리어 시작"));
  await waitFor(`document.querySelector('section[aria-labelledby="career-decision"] button')`);
  assert.ok(await evaluate(`document.body.innerText.includes('테스트맨') && document.body.innerText.includes('프리시즌')`));
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('football-career-v1')).setup.reroll`), 1, "다시 뽑은 횟수가 저장돼요");
  assert.ok(await evaluate(`document.querySelector('section[aria-label="라이벌"]')?.innerText.includes('평생의 라이벌')`), "라이벌 카드");

  // 실제로 선택 버튼까지 내려간 뒤 연출 전·중·후의 스크롤 위치를 매 프레임 비교해요.
  // 시즌 리포트를 펼쳐 둔 상태와 가장 아래 선택지도 검사해요.
  let picks = 0;
  let sawAnimation = false;
  const stablePick = async ({ keyboard = false, quick = false, moveDuringAnimation = false } = {}) => {
    await sleep(450);
    const receipt = await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('section[aria-labelledby="career-decision"] button')];
      const button = buttons.at(-1);
      button.scrollIntoView({ block: 'center', behavior: 'instant' });
      return button.querySelector('span.block')?.textContent ?? button.textContent;
    })()`);
    await sleep(100);
    const metrics = await evaluate(`new Promise((resolve) => {
      const button = [...document.querySelectorAll('section[aria-labelledby="career-decision"] button')].at(-1);
      const before = JSON.parse(localStorage.getItem('football-career-v1')).choices.length;
      let y = window.scrollY;
      const started = performance.now();
      let delta = 0, busy = false;
      function sample() {
        delta = Math.max(delta, Math.abs(window.scrollY - y));
        busy ||= !!document.querySelector('[aria-busy="true"]');
        if (performance.now() - started < 1050) requestAnimationFrame(sample);
        else resolve({ delta, busy, count: JSON.parse(localStorage.getItem('football-career-v1')).choices.length - before, focus: document.activeElement.id });
      }
      requestAnimationFrame(sample);
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: ${keyboard ? 0 : 1} }));
      // 같은 위치를 연달아 눌러도 다음 결정까지 고르지 않아야 해요.
      document.querySelector('section[aria-labelledby="career-decision"] button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      if (${moveDuringAnimation}) setTimeout(() => { window.scrollBy(0, 100); y = window.scrollY; }, 180);
    })`);
    assert.ok(metrics.delta <= 2, `선택 중 스크롤이 ${metrics.delta}px 이동했어요`);
    assert.equal(metrics.count, 1, "빠른 연속 클릭으로 두 번 선택됐어요");
    if (quick) assert.equal(metrics.busy, false, "빠른 진행인데 연출을 기다렸어요");
    sawAnimation ||= metrics.busy;
    if (keyboard) assert.equal(metrics.focus, "career-decision", "키보드 초점이 다음 결정으로 이어지지 않았어요");
    const feedback = await evaluate(`document.getElementById('career-turn-result').textContent`);
    assert.ok(feedback.includes(receipt.trim()) || (receipt.includes("다음 시즌으로") && feedback.includes("시즌을 준비")), `지난 선택 표시: ${receipt} → ${feedback}`);
    picks++;
  };
  for (const width of [390, 1280, 320]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    for (let step = 0; step < 3; step++) {
      await evaluate(`(() => { const report = document.getElementById('career-report'); if (report) report.open = true; })()`);
      await stablePick();
      await noOverflow(`진행 화면 ${width}px`);
    }
    await screenshot(`career-play-${width}.png`);
    console.log(`${width}px: 선택·시즌 연출·리포트 전환 중 스크롤 위치 유지`);
  }
  // 연출을 보는 도중 직접 스크롤하면 그 위치를 유지해야 해요.
  await stablePick({ moveDuringAnimation: true });
  await evaluate(`document.querySelector('input[type="checkbox"]').click()`);
  await stablePick({ keyboard: true, quick: true });
  const savedReceipt = await evaluate(`document.getElementById('career-turn-result').textContent`);
  await command("Page.reload");
  await waitFor(`document.querySelector('section[aria-labelledby="career-decision"] button')`);
  assert.equal(await evaluate(`document.getElementById('career-turn-result').textContent`), savedReceipt, "지난 선택 결과 복원");
  assert.equal(await evaluate(`document.querySelector('input[type="checkbox"]').checked`), true, "빠른 진행 설정 복원");
  await evaluate(`document.querySelector('input[type="checkbox"]').click()`);

  // 나머지 커리어는 움직임 줄이기로 은퇴까지 진행해요.
  // 화면은 빠른 연속 클릭을 0.4초 동안 무시해요. 반영될 때까지 조금씩 쉬며 다시 눌러요.
  const choose = async () => {
    const count = `JSON.parse(localStorage.getItem('football-career-v1')).choices.length`;
    const before = await evaluate(count);
    const index = picks % 3;
    for (let attempt = 0; attempt < 40; attempt++) {
      const clicked = await evaluate(`(() => { const buttons = document.querySelectorAll('section[aria-labelledby="career-decision"] button'); if (!buttons.length) return false; buttons[Math.min(${index}, buttons.length - 1)].click(); return true; })()`);
      assert.ok(clicked || attempt > 0, "고를 버튼이 없어요");
      for (let i = 0; i < 5; i++) {
        if (await evaluate(`${count} === ${before + 1}`)) { picks++; return; }
        await sleep(100);
      }
    }
    throw new Error("선택이 반영되지 않았어요");
  };
  assert.ok(sawAnimation, "시즌 진행 연출을 보지 못했어요");
  console.log("시즌 진행 연출 확인");
  await waitFor(`!document.querySelector('[aria-busy="true"]') && document.querySelector('section[aria-labelledby="career-decision"] button')`);
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  let sawReport = false;
  let sawMoment = false;
  for (let guard = 0; guard < 140; guard++) {
    if (await evaluate(`document.body.innerText.includes('LEGEND SCORE')`)) break;
    await waitFor(`document.querySelector('section[aria-labelledby="career-decision"] button') || document.body.innerText.includes('LEGEND SCORE')`);
    if (!sawReport && await evaluate(`Boolean(document.getElementById('career-season-result'))`)) {
      sawReport = true;
      assert.ok(await evaluate(`document.getElementById('career-season-result').innerText.includes('시즌 능력치 변화')`), "시즌 종료 능력치가 펼치기 없이 보여야 해요");
      assert.equal(await evaluate(`document.querySelectorAll('#career-season-result [data-season-stats] dl:last-child > div').length`), 6, "여섯 능력치 표시");
      await evaluate(`document.getElementById('career-season-result').scrollIntoView({ block: 'start', behavior: 'instant' })`);
      await noOverflow("시즌 리포트 390px");
      await screenshot("career-season.png");
    }
    if (await evaluate(`document.body.innerText.includes('LEGEND SCORE')`)) break;
    if (!sawMoment && await evaluate(`document.body.innerText.includes('BIG MOMENT')`)) {
      sawMoment = true;
      await evaluate(`document.getElementById('career-decision').scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await noOverflow("결정적 순간 390px");
      await screenshot("career-moment.png");
    }
    await choose();
  }
  assert.ok(sawReport, "시즌 리포트를 보지 못했어요");
  assert.ok(await evaluate(`document.body.innerText.includes('LEGEND SCORE')`), "은퇴까지 가지 못했어요");
  assert.ok(await evaluate(`document.body.innerText.includes('평생의 라이벌 ·') && document.body.innerText.includes('맞대결')`), "은퇴 화면의 라이벌 비교");
  console.log(sawMoment ? "결정적 순간 화면 확인" : "이번 커리어에는 결정적 순간이 없었어요");
  await noOverflow("은퇴 화면 390px");
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await screenshot("career-retired.png");
  const hall = await evaluate(`JSON.parse(localStorage.getItem('football-career-hall-v1'))`);
  assert.equal(hall.length, 1);
  assert.equal(hall[0].name, "테스트맨");
  console.log(`은퇴까지 ${picks}번 선택 · 레전드 점수 ${hall[0].score} · ${hall[0].title} · ${hall[0].grade}`);

  // 은퇴 기록집에는 모든 시즌과 실제 선택이 남고, 직접 펼치거나 한꺼번에 볼 수 있어요.
  const seasonCount = await evaluate(`document.querySelectorAll('[data-journal-season]').length`);
  assert.ok(seasonCount >= 15, "은퇴 기록집의 시즌 누락");
  await evaluate(`document.querySelector('[data-journal-season] > summary').click()`);
  await waitFor(`document.querySelector('#career-journal [data-choice-step]')`);
  assert.ok(await evaluate(`document.querySelector('#career-journal').innerText.includes('내 선택과 그 결과')`));
  await clickText("모든 시즌 펼치기");
  await waitFor(`document.querySelectorAll('#career-journal [data-choice-step]').length === JSON.parse(localStorage.getItem('football-career-v1')).choices.length`);
  const journalText = await evaluate(`document.getElementById('career-journal').innerText`);
  assert.ok(journalText.includes("은퇴하기"), "마지막 은퇴 선택 기록");
  for (const width of [320, 390, 1280]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await noOverflow(`상세 기록집 ${width}px`);
  }
  await evaluate(`document.getElementById('career-journal').scrollIntoView({ block: 'start', behavior: 'instant' })`);
  await screenshot("career-journal.png");
  await clickText("모두 접기");
  await waitFor(`document.querySelectorAll('[data-journal-season][open]').length === 0`);

  // 새로 고쳐도 시드와 선택으로 같은 은퇴 화면이 다시 계산돼요.
  const score = await evaluate(`document.querySelector('.text-6xl').textContent`);
  await command("Page.reload");
  await waitFor(`document.body.innerText.includes('LEGEND SCORE')`);
  assert.equal(await evaluate(`document.querySelector('.text-6xl').textContent`), score);
  assert.equal(await evaluate(`document.querySelectorAll('[data-journal-season]').length`), seasonCount);
  await clickText("모든 시즌 펼치기");
  await waitFor(`document.querySelectorAll('#career-journal [data-choice-step]').length === JSON.parse(localStorage.getItem('football-career-v1')).choices.length`);
  assert.equal(await evaluate(`document.getElementById('career-journal').innerText`), journalText, "새로고침 후 전체 기록집 복원");
  await clickText("모두 접기");
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(150);
  await noOverflow("은퇴 화면 1280px");
  await screenshot("career-retired-desktop.png");

  // 공유 창과 클립보드가 없으면 직접 복사할 도전장을 보여 줘요.
  await evaluate(`Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })`);
  assert.ok(await clickText("도전장 보내기"));
  await waitFor(`document.querySelector('textarea[aria-label="복사할 도전장"]')`);
  assert.ok(await evaluate(`document.querySelector('textarea[aria-label="복사할 도전장"]').value.includes('/games/career?score=')`));
  assert.ok(await clickText("새 커리어"));
  await waitFor("document.getElementById('career-name')");
  assert.deepEqual(errors, [], "브라우저 실행 오류");
  console.log("화면 위치·연속 클릭 방지·키보드 초점·빠른 진행·선택 결과 복원·은퇴·공유·브라우저 오류 없음 확인 완료");
} finally {
  await closeBrowser?.();
  socket?.close();
  browser.kill();
}
