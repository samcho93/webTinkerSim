// 코드를 시뮬레이션에서 실행해요
import { NOTES, TEXT_API } from './codegen.js';
import { Emitter } from './util.js';

class StopSignal extends Error {}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export class Runner extends Emitter {
  constructor(world) {
    super();
    this.world = world;
    this.running = false;
    this.gen = 0;
  }

  makeApi() {
    const w = this.world;
    const myGen = ++this.gen;
    let last = performance.now();
    const check = () => { if (!this.running || this.gen !== myGen) throw new StopSignal(); };
    const sleep = async (sec) => {
      const end = performance.now() + Math.max(0, Number(sec) || 0) * 1000;
      while (true) {
        check();
        const left = end - performance.now();
        if (left <= 0) break;
        await new Promise((r) => setTimeout(r, Math.min(50, left)));
      }
      last = performance.now();
      check();
    };
    const note = (n) => (typeof n === 'number' ? n : NOTES[n] || Number(n) || 440);
    const api = {
      motor: (d, s) => { check(); w.cmd('motor', d, s); },
      stop: (d) => { check(); w.cmd('motor', d, 0); },
      stopAll: () => { check(); for (const io of w.insts.values()) if (io.block.component === 'dc') w.cmd('motor', io.data.id, 0); },
      servo: (d, a) => { check(); w.cmd('servo', d, a); },
      slide: (d, p) => { check(); w.cmd('slide', d, p); },
      led: (d, on = true) => { check(); w.cmd('led', d, on); },
      ledColor: (d, c) => { check(); w.cmd('ledColor', d, c); },
      lcd: (d, line, text) => { check(); w.cmd('lcd', d, line, text); },
      lcdClear: (d) => { check(); w.cmd('lcdClear', d); },
      tone: async (d, n, sec = 0.5) => {
        check();
        const io = w.resolve(d);
        if (io) { w.tone(note(n), Number(sec) || 0.5); this.emit('tone', io, note(n), sec); }
        await sleep(sec);
      },
      wait: (sec) => sleep(sec),
      button: (d) => { check(); return w.read('button', d); },
      distance: (d) => { check(); return w.read('distance', d); },
      line: (d) => { check(); return w.read('line', d); },
      tick: async () => {
        check();
        const now = performance.now();
        if (now - last > 12) { last = now; await new Promise((r) => setTimeout(r, 0)); check(); }
      },
      hl: (id) => { if (this.gen === myGen) this.emit('highlight', id); },
      print: (...a) => this.emit('print', a.join(' ')),
    };
    return api;
  }

  async run(code, { text = false } = {}) {
    this.stop(true);
    this.world.startSim();
    this.running = true;
    this.emit('start');
    const api = this.makeApi();
    try {
      let fn;
      if (text) {
        const names = Object.values(TEXT_API);
        const fns = Object.keys(TEXT_API).map((k) => api[k]);
        const eng = Object.keys(TEXT_API);
        fn = new AsyncFunction(...names, ...eng, '__tick', '출력', 'print', transformText(code));
        await fn(...fns, ...fns, api.tick, api.print, api.print);
      } else {
        fn = new AsyncFunction('api', code);
        await fn(api);
      }
      this.emit('done');
    } catch (e) {
      if (e instanceof StopSignal) return;
      console.error(e);
      this.emit('error', friendlyError(e));
    }
    // 코드가 끝나도 모터는 계속 돌 수 있어요(실제 보드처럼). 멈춤 버튼으로 멈춰요.
  }

  stop(silent) {
    const was = this.running;
    this.running = false;
    this.gen++;
    this.world.stopSim();
    if (was && !silent) this.emit('stop');
  }
}

function friendlyError(e) {
  const m = String(e && e.message || e);
  if (e instanceof SyntaxError) return '글 코드에 틀린 부분이 있어요: ' + m;
  if (/is not defined/.test(m)) return '모르는 이름이 있어요: ' + m.replace(' is not defined', '');
  return '실행 중 문제가 생겼어요: ' + m;
}

// 글 코드(자바스크립트)를 실행할 수 있게 바꿔요: 기다리기 앞에 await, 반복문에 쉬는 시간 넣기
export function transformText(src) {
  const asyncNames = new Set(['기다리기', '소리', 'wait', 'tone']);
  // 사용자가 만든 함수 이름 찾기
  const userFns = new Set();
  for (const m of src.matchAll(/function\s+([\p{L}_$][\p{L}\p{N}_$]*)\s*\(/gu)) userFns.add(m[1]);
  let out = '';
  let i = 0;
  const n = src.length;
  const isId = (c) => /[\p{L}\p{N}_$]/u.test(c);
  let lastWord = '';
  const loopStack = [];
  let pendingLoop = false;
  let parenDepth = 0;
  let loopParen = -1;
  while (i < n) {
    const c = src[i];
    // 주석/문자열은 그대로
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); const e = j < 0 ? n : j; out += src.slice(i, e); i = e; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; out += src.slice(i, e); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (isId(c) && !(i > 0 && isId(src[i - 1]))) {
      let j = i;
      while (j < n && isId(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(src[k])) k++;
      const prev = out.replace(/\s+$/, '');
      const isCall = src[k] === '(' && !/\.$/.test(prev);
      if (word === 'function') { out += /async$/.test(prev) ? 'function' : 'async function'; i = j; lastWord = word; continue; }
      if (isCall && lastWord !== 'function' && (asyncNames.has(word) || userFns.has(word)) && !/await$/.test(prev)) out += 'await ';
      if (word === 'while' || word === 'for') { pendingLoop = true; loopParen = -1; }
      if (word === 'do') { out += word; i = j; lastWord = word; loopStack.push('do'); pendingLoop = 'do'; continue; }
      out += word;
      i = j;
      lastWord = word;
      continue;
    }
    if (c === '(') { parenDepth++; if (pendingLoop === true && loopParen < 0) loopParen = parenDepth; }
    if (c === ')') { if (pendingLoop === true && loopParen === parenDepth) pendingLoop = 'body'; parenDepth--; }
    if (c === '{') {
      out += c; i++;
      if (pendingLoop === 'body' || pendingLoop === 'do') { out += ' await __tick();'; }
      pendingLoop = false;
      continue;
    }
    if (!/\s/.test(c)) lastWord = c === '(' ? lastWord : '';
    out += c;
    i++;
  }
  return out;
}
