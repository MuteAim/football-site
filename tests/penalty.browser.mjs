// 실행 중인 로컬 서버와 설치된 Edge로 검사해요. 사용자 브라우저 프로필은 사용하지 않아요.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.PENALTY_TEST_URL ?? "http://127.0.0.1:3000";
const executable = process.env.PENALTY_TEST_BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const directory = await mkdtemp(join(tmpdir(), "football-penalty-qa-"));
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
  const waitFor = async (expression) => {
    for (let i = 0; i < 160; i++) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
    throw new Error(`화면 대기 실패: ${expression}`);
  };
  const screenshot = async (name) => {
    const { data } = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const file = join(directory, name);
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`화면 저장: ${file}`);
  };
  await command("Runtime.enable"); await command("Page.enable");
  await command("Page.navigate", { url: `${base}/games/penalty?score=1500&day=2000-01-01` });
  await waitFor(`!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('바로 킥오프'))`);
  await sleep(500);
  assert.ok(await evaluate(`document.body.innerText.includes('당시 기록') || document.body.innerText.includes('2000-01-01에 1500점')`));
  for (const width of [320, 390, 1280]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: width < 600 });
    await sleep(100);
    assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), `${width}px 가로 넘침`);
  }
  await screenshot("penalty-desktop.png");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await screenshot("penalty-mobile.png");
  console.log("320/390/1280px 화면·지난 날짜 도전장 확인 완료");

  await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('바로 킥오프')).click()`);
  await waitFor("!!document.querySelector('[data-shoot]')");
  // 첫 슛은 시간 초과, 다음 슛은 실제 키 입력으로 처리해요.
  await waitFor(`document.querySelector('[aria-label="2번째 슛 완료, 0골"]') || document.querySelector('[aria-label="1번째 시간 초과"]') || Array.from(document.querySelectorAll('span')).some(s => s.getAttribute('aria-label') === '1번째 시간 초과')`);
  await waitFor("!!document.querySelector('[data-shoot]')");
  await sleep(180);
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  // 남은 슛은 화면에 실제 표시된 흰 막대와 금색 구간을 보고 눌러요.
  const body = await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const step = () => {
      if (document.body.innerText.includes('FULL TIME')) return resolve(document.body.innerText);
      if (performance.now() - started > 45000) return reject(new Error('한 판이 끝나지 않았어요.'));
      const button = document.querySelector('[data-shoot]');
      if (button) {
        const meter = button.previousElementSibling;
        const marker = meter.lastElementChild.getBoundingClientRect();
        const gold = meter.children[1].getBoundingClientRect();
        if (Math.abs(marker.x + marker.width / 2 - gold.x - gold.width / 2) <= 8) button.click();
      }
      requestAnimationFrame(step);
    }; step();
  })`);
  assert.ok(body.includes("연습 기록"));
  const saved = await evaluate(`JSON.parse(localStorage.getItem('football-penalty-best-v1'))`);
  assert.ok(saved.score > 0 && saved.score <= 2250);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label$="번째 대기"]').length`), 0);
  console.log(`10번의 슛·시간 초과·키보드·터치 버튼·결과·로컬 최고점 확인: ${saved.score}점`);
  await screenshot("penalty-result.png");

  // 시스템 공유창 없이 복사 불가 시의 수동 공유 경로도 검사해요.
  await evaluate(`Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('도전장 보내기')).click()`);
  await waitFor(`!!document.querySelector('textarea[aria-label="복사할 도전장"]')`);
  assert.ok(await evaluate(`document.querySelector('textarea').value.includes('/games/penalty?score=')`));
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('한 판 더 도전')).click()`);
  await waitFor("!!document.querySelector('[data-shoot]')");
  assert.ok(await evaluate(`document.querySelector('[aria-label="0번 슛 완료, 0골"]') !== null`));
  assert.deepEqual(errors, [], "브라우저 실행 오류");
  console.log("도전장 복사 실패 대체 경로·재도전 초기화·브라우저 오류 없음 확인 완료");
} finally {
  await closeBrowser?.();
  socket?.close();
  browser.kill();
}
