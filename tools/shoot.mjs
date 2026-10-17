// 따라하기 그림 자동 촬영 (개발용). 사용법: node tools/shoot.mjs http://localhost:8791 [장면이름...]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:8791';
const only = process.argv.slice(3);
const NAMES = ['home', 'home-examples', 'run-car', 'save', 'maker-1', 'maker-2', 'maker-3', 'maker-hole', 'maker-multi', 'maker-group', 'maker-link', 'maker-copy', 'maker-align', 'maker-stl', 'blocks-1', 'blocks-wheel', 'blocks-servo', 'assemble-1', 'assemble-ghost', 'assemble-car', 'code-car', 'code-text', 'arm-assemble', 'arm-run', 'avoid-run', 'line-run', 'button', 'board-select', 'codeview'];
const list = only.length ? only : NAMES;
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'tsim-shot-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1400,860', '--hide-scrollbars', '--force-device-scale-factor=1', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find((x) => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) { /* 아직 */ }
    await sleep(200);
  }
  throw new Error('edge not ready');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });

for (const name of list) {
  await send('Page.navigate', { url: `${base}/?shot=${name}` });
  let ok = false;
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    const r = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value) { ok = true; break; }
  }
  await sleep(300);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`tutorial/img/${name}.png`, Buffer.from(shot.result.data, 'base64'));
  console.log(name, ok ? 'ok' : 'TIMEOUT');
}
ws.close();
edge.kill();
process.exit(0);
