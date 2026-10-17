// 💻 코딩·실행: 왼쪽은 코딩, 오른쪽은 시뮬레이션
/* global Blockly */
import { h, toast, modal, debounce, downloadFile } from './util.js';
import { toolbox, genSim, genText, genBoard, TEXT_API } from './codegen.js';
import { BOARDS, wiringRows } from './boards.js';
import { COMPONENTS } from './components.js';
import { P } from './project.js';
import { FIRMWARE_ARDUINO, FIRMWARE_MICROBIT, FIRMWARE_PICO } from './hardware.js';

const TEXT_HELP = [
  ['모터("바퀴1", 100);', '모터 돌리기 (-100~100)'],
  ['멈추기("바퀴1");', '모터 멈추기'],
  ['모두멈추기();', '모든 모터 멈추기'],
  ['서보("팔1", 90);', '서보 각도 (0~180)'],
  ['밀기("밀기1", 100);', '밀기 모터 위치 (0~100%)'],
  ['LED("불빛1", true);', 'LED 켜기 (false = 끄기)'],
  ['LED색("불빛1", "파랑");', 'LED 색깔'],
  ['소리("버저1", "도", 0.5);', '음 울리기'],
  ['화면("화면1", 1, "Hello");', 'LCD 줄에 쓰기'],
  ['기다리기(1);', '1초 기다리기'],
  ['버튼("버튼1")', '버튼 눌림 (참/거짓)'],
  ['거리("거리센서1")', '거리 (cm)'],
  ['라인("라인센서1")', '검은 선 위? (참/거짓)'],
  ['출력("안녕");', '아래 기록창에 글 쓰기'],
];

export function createCoding(app) {
  const world = app.world;
  const runner = app.runner;
  const el = h('section', { class: 'coding' });
  let ws = null;
  let loadedFor = null;
  let mode = 'block';

  // ---------- 위쪽 도구 ----------
  const modeBlock = h('button', { class: 'seg', onclick: () => setMode('block') }, '🧩 블록 코딩');
  const modeText = h('button', { class: 'seg', onclick: () => setMode('text') }, '⌨️ 글 코딩');
  const boardSel = h('select', { class: 'input small', onchange: () => { app.project.board = boardSel.value; app.changed('board', { rebuild: false }); refreshStatus(true); } },
    Object.entries(BOARDS).map(([k, b]) => h('option', { value: k }, b.icon + ' ' + b.name)));
  const runBtn = h('button', { class: 'btn run', onclick: run }, '▶ 실행');
  const stopBtn = h('button', { class: 'btn stop', onclick: () => runner.stop() }, '■ 멈춤');
  const resetBtn = h('button', { class: 'btn', onclick: () => { runner.stop(true); world.resetSim(); setRunUI(false); } }, '↺ 처음으로');
  const followBtn = h('button', { class: 'btn small toggle on', onclick: () => { world.follow = !world.follow; followBtn.classList.toggle('on', world.follow); } }, '🎥 따라가기');
  const hwBtn = h('button', { class: 'btn small', onclick: openHw }, '🔌 보드 연결');
  el.append(h('div', { class: 'code-top' },
    h('div', { class: 'segs' }, modeBlock, modeText),
    h('span', { class: 'label' }, '보드'), boardSel,
    h('button', { class: 'btn small', onclick: openCodeView }, '📄 보드 코드 보기'),
    hwBtn,
    h('span', { class: 'grow' }),
    runBtn, stopBtn, resetBtn, followBtn));

  // ---------- 코딩 영역 / 시뮬레이션 영역 ----------
  const blocklyDiv = h('div', { class: 'blockly' });
  const textArea = h('textarea', { class: 'code-text', spellcheck: false, placeholder: '// 여기에 코드를 적어요' });
  const textHelp = h('div', { class: 'text-help' },
    h('div', { class: 'row' }, h('b', {}, '명령어 (눌러서 넣기)'), h('span', { class: 'grow' }), h('button', { class: 'btn tiny', onclick: blocksToText }, '🧩 블록을 글로 바꾸기')),
    h('div', { class: 'cmds' }, TEXT_HELP.map(([c, d]) => h('button', { class: 'cmd', title: d, onclick: () => insertText(c) }, h('code', {}, c), h('small', {}, d)))));
  const textPane = h('div', { class: 'text-pane' }, textArea, textHelp);
  const codePane = h('div', { class: 'code-pane' }, blocklyDiv, textPane);
  const viewBox = h('div', { class: 'view' });
  const statusBox = h('div', { class: 'status' });
  const logBox = h('div', { class: 'log' });
  const simPane = h('div', { class: 'sim-pane' }, viewBox, h('div', { class: 'sim-bottom' }, statusBox, logBox));
  const resizer = h('div', { class: 'resizer', title: '끌어서 크기 바꾸기' });
  el.append(h('div', { class: 'split' }, codePane, resizer, simPane));

  // 가운데 막대 끌기
  resizer.addEventListener('pointerdown', (e) => {
    resizer.setPointerCapture(e.pointerId);
    const split = resizer.parentElement;
    const move = (ev) => {
      const r = split.getBoundingClientRect();
      const pct = Math.min(75, Math.max(25, ((ev.clientX - r.left) / r.width) * 100));
      codePane.style.flexBasis = pct + '%';
      if (ws) Blockly.svgResize(ws);
    };
    const up = () => { resizer.removeEventListener('pointermove', move); resizer.removeEventListener('pointerup', up); };
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', up);
  });

  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = textArea.selectionStart;
      textArea.setRangeText('  ', s, textArea.selectionEnd, 'end');
    }
  });
  textArea.addEventListener('input', debounce(() => { app.project.code.text = textArea.value; app.changed('code', { rebuild: false }); }, 500));

  function insertText(c) {
    const s = textArea.selectionStart;
    textArea.setRangeText(c + '\n', s, textArea.selectionEnd, 'end');
    textArea.focus();
    app.project.code.text = textArea.value;
    app.changed('code', { rebuild: false });
  }
  function blocksToText() {
    if (!ws) return;
    textArea.value = genText(ws);
    app.project.code.text = textArea.value;
    app.changed('code', { rebuild: false });
    toast('🧩 블록을 글 코드로 바꿨어요');
  }

  function setMode(m) {
    mode = m;
    app.project.code.mode = m;
    modeBlock.classList.toggle('on', m === 'block');
    modeText.classList.toggle('on', m === 'text');
    blocklyDiv.style.display = m === 'block' ? '' : 'none';
    textPane.style.display = m === 'text' ? '' : 'none';
    if (m === 'text' && !textArea.value.trim() && ws) blocksToText();
    if (m === 'block' && ws) setTimeout(() => Blockly.svgResize(ws), 0);
  }

  // ---------- Blockly ----------
  function ensureWs() {
    if (ws) return;
    ws = Blockly.inject(blocklyDiv, {
      toolbox: toolbox(),
      renderer: 'zelos',
      media: 'https://cdn.jsdelivr.net/npm/blockly@10.4.3/media/',
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
      grid: { spacing: 24, length: 2, colour: '#e2e8f0', snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    ws.addChangeListener((e) => { if (e.type !== Blockly.Events.UI && !e.isUiEvent && !loading) saveWsSoon(); });
  }
  let loading = false;
  const saveWsSoon = debounce(() => saveWs(), 500);
  function saveWs() {
    if (!ws || loading) return;
    app.project.code.blockly = Blockly.serialization.workspaces.save(ws);
    app.changed('code', { rebuild: false });
  }
  function loadWs() {
    ensureWs();
    loading = true;
    try {
      ws.clear();
      const st = app.project.code.blockly;
      if (st) Blockly.serialization.workspaces.load(st, ws);
      if (!ws.getTopBlocks(false).length) {
        const b = ws.newBlock('tsim_start');
        b.initSvg(); b.render(); b.moveBy(40, 40);
      }
    } catch (e) { console.error(e); toast('코드 블록을 불러오지 못했어요'); }
    loading = false;
    loadedFor = app.project;
    textArea.value = app.project.code.text || '';
  }

  runner.on('highlight', (id) => { if (ws && mode === 'block') ws.highlightBlock(id); });

  // ---------- 실행 ----------
  function setRunUI(on) {
    runBtn.classList.toggle('active', on);
    runBtn.textContent = on ? '▶ 다시 실행' : '▶ 실행';
    el.classList.toggle('running', on);
  }
  function run() {
    log('▶ 실행해요', 'info');
    world.v.dom.focus();
    if (mode === 'block') {
      const { code, count } = genSim(ws);
      if (!count) { toast('▶ 시작하면 블록 아래에 블록을 붙여 주세요'); return; }
      runner.run(code);
    } else {
      runner.run(textArea.value, { text: true });
    }
    setRunUI(true);
  }
  runner.on('stop', () => { setRunUI(false); if (ws) ws.highlightBlock(null); log('■ 멈췄어요', 'info'); });
  runner.on('done', () => { if (ws) ws.highlightBlock(null); log('✔ 코드가 끝났어요. (돌고 있는 모터는 ■ 멈춤으로 멈춰요)', 'ok'); });
  runner.on('error', (m) => { log('⚠ ' + m, 'err'); toast('⚠ ' + m, 4000); setRunUI(false); runner.stop(true); });
  runner.on('print', (m) => log('💬 ' + m));

  function log(msg, cls = '') {
    logBox.append(h('div', { class: 'logline ' + cls }, msg));
    while (logBox.childNodes.length > 80) logBox.firstChild.remove();
    logBox.scrollTop = logBox.scrollHeight;
  }

  // ---------- 화면 속 버튼 누르기 ----------
  world.dom.addEventListener('pointerdown', (e) => {
    if (app.current !== 'code') return;
    const hit = world.pick(e);
    const o = hit && hit.object.userData.owner;
    const io = o && o.instId && world.insts.get(o.instId);
    if (io && io.block.component === 'button') {
      io.state.pressed = true;
      world.v.controls.enabled = false;
      const up = () => { io.state.pressed = false; world.v.controls.enabled = true; window.removeEventListener('pointerup', up); };
      window.addEventListener('pointerup', up);
    }
  });

  // ---------- 부품 상태 ----------
  let statusRows = [];
  function refreshStatus(full) {
    const p = app.project;
    if (full) {
      statusRows = [];
      statusBox.replaceChildren(h('div', { class: 'st-title' }, '🔌 부품 상태 ', h('small', {}, BOARDS[p.board].name)));
      for (const inst of p.instances) {
        const comp = P.compOf(p, inst);
        if (!comp || comp === 'none') continue;
        const c = COMPONENTS[comp];
        const val = h('b', {}, '-');
        let ctrl = null;
        if (comp === 'button') {
          ctrl = h('button', { class: 'btn tiny press' }, '꾹 누르기');
          const set = (v) => () => { const io = world.insts.get(inst.id); if (io) io.state.pressed = v; };
          ctrl.addEventListener('pointerdown', set(true));
          ctrl.addEventListener('pointerup', set(false));
          ctrl.addEventListener('pointerleave', set(false));
        }
        statusBox.append(h('div', { class: 'st-row' }, h('span', {}, c.icon + ' ' + inst.name), val, ctrl));
        statusRows.push({ inst, comp, val });
      }
      if (!statusRows.length) statusBox.append(h('div', { class: 'hint' }, '부품이 아직 없어요. 🚗 조립하기에서 붙여 주세요.'));
    }
    for (const r of statusRows) {
      const io = world.insts.get(r.inst.id);
      if (!io) continue;
      const st = io.state;
      let t = '';
      if (r.comp === 'dc') t = '속도 ' + Math.round(st.speed);
      else if (r.comp === 'servo') t = Math.round(st.cur) + '도';
      else if (r.comp === 'linear') t = Math.round(st.cur) + '%';
      else if (r.comp === 'led') t = st.on ? '켜짐' : '꺼짐';
      else if (r.comp === 'button') t = st.pressed || st.hwPressed ? '눌림 ✋' : '안 눌림';
      else if (r.comp === 'distance') t = world.measure(io) + ' cm';
      else if (r.comp === 'line') t = world.lineSee(io) ? '⚫ 검은 선' : '⚪ 흰 바닥';
      else if (r.comp === 'lcd') t = st.lines.filter(Boolean).join(' / ') || '(비어 있음)';
      else if (r.comp === 'buzzer') t = '';
      if (r.val.textContent !== t) r.val.textContent = t;
    }
  }
  setInterval(() => { if (app.current === 'code') refreshStatus(false); }, 200);

  // ---------- 보드 코드 보기 ----------
  function signs() {
    const s = {};
    for (const io of world.insts.values()) s[io.data.id] = io.dirSign || 1;
    return s;
  }
  function openCodeView() {
    ensureWs();
    const p = app.project;
    const board = BOARDS[p.board];
    const bc = genBoard(ws, p, signs());
    const tabs = [
      ['board', `🔌 ${board.name} 코드 (${board.langName})`, bc.code],
      ['text', '⌨️ 글 코드 (자바스크립트)', mode === 'text' ? textArea.value : genText(ws)],
    ];
    modal({
      title: '📄 코드 보기',
      wide: true,
      body: (c) => {
        const pre = h('pre', { class: 'codeview' });
        const tabBar = h('div', { class: 'segs' });
        let curCode = '';
        const show = (i) => {
          [...tabBar.children].forEach((b, k) => b.classList.toggle('on', k === i));
          if (i === 2) {
            pre.replaceChildren(h('table', { class: 'wiring' },
              h('tr', {}, h('th', {}, '부품'), h('th', {}, '종류'), h('th', {}, `${board.name} 연결`)),
              wiringRows(p).map((r) => h('tr', { class: r.ok ? '' : 'bad' }, h('td', {}, r.icon + ' ' + r.name), h('td', {}, r.comp), h('td', {}, r.text)))));
            curCode = wiringRows(p).map((r) => `${r.name}\t${r.comp}\t${r.text}`).join('\n');
          } else { pre.textContent = tabs[i][2]; curCode = tabs[i][2]; }
        };
        tabs.forEach((t, i) => tabBar.append(h('button', { class: 'seg', onclick: () => show(i) }, t[1])));
        tabBar.append(h('button', { class: 'seg', onclick: () => show(2) }, '📋 연결표'));
        c.append(tabBar, pre,
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => { navigator.clipboard.writeText(curCode).then(() => toast('📋 복사했어요')); } }, '📋 복사하기'),
            h('button', { class: 'btn small', onclick: () => downloadFile(bc.file, bc.code, 'text/plain') }, `💾 ${bc.file} 내려받기`),
            h('span', { class: 'hint' }, board.lang === 'arduino' ? '아두이노 IDE(또는 웹 편집기)에 붙여 넣어 보드에 올려요.' : (p.board === 'microbit' ? 'python.microbit.org 에 붙여 넣어 마이크로비트로 보내요.' : '마이크로파이썬 편집기에 main.py 로 저장해요.'))));
        show(0);
      },
      buttons: [{ label: '닫기' }],
    });
  }

  // ---------- 실제 보드 연결 ----------
  function openHw() {
    const p = app.project;
    const board = BOARDS[p.board];
    const fw = board.lang === 'arduino' ? FIRMWARE_ARDUINO : p.board === 'microbit' ? FIRMWARE_MICROBIT : FIRMWARE_PICO;
    const hw = app.hw;
    modal({
      title: '🔌 실제 보드와 연결하기',
      wide: true,
      body: (c) => {
        const status = h('b', {}, hw.connected ? '🟢 연결됨' : '⚪ 연결 안 됨');
        const logv = h('pre', { class: 'hwlog' });
        const off = hw.on('log', (m) => { logv.textContent = (logv.textContent + m + '\n').split('\n').slice(-12).join('\n'); });
        const offS = hw.on('status', (v) => { status.textContent = v ? '🟢 연결됨' : '⚪ 연결 안 됨'; });
        c.closest && setTimeout(() => { const back = c.closest('.modal-back'); if (back) new MutationObserver((_, o) => { if (!back.isConnected) { off(); offS(); o.disconnect(); } }).observe(document.body, { childList: true }); }, 0);
        c.append(
          h('p', {}, '시뮬레이션에서 ▶ 실행하면 실제 부품도 똑같이 움직여요. 크롬이나 엣지 브라우저에서 USB 케이블로 연결해요.'),
          h('ol', { class: 'big-steps' },
            h('li', {}, h('b', {}, `${board.name}에 "연결 프로그램"을 한 번 올려요. `),
              p.board === 'microbit' ? h('a', { href: 'https://python.microbit.org/v/3', target: '_blank', rel: 'noopener' }, 'python.microbit.org 열기 ↗') : null,
              h('details', {}, h('summary', {}, '연결 프로그램 보기'), h('pre', { class: 'codeview small' }, fw),
                h('button', { class: 'btn tiny', onclick: () => navigator.clipboard.writeText(fw).then(() => toast('📋 복사했어요')) }, '📋 복사'))),
            h('li', {}, h('b', {}, '부품을 연결표대로 꽂아요. '), h('button', { class: 'btn tiny', onclick: openCodeView }, '📋 연결표 보기')),
            h('li', {}, h('b', {}, '아래 버튼을 누르고 보드를 골라요.'))),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', onclick: async () => {
              try {
                if (hw.connected) await hw.disconnect();
                else { await hw.connect(p); toast('🟢 보드와 연결했어요'); }
                hwBtn.classList.toggle('on', hw.connected);
              } catch (e) { toast('연결하지 못했어요: ' + e.message, 4000); }
            } }, hw.connected ? '연결 끊기' : '🔌 보드 연결하기'),
            status),
          !hw.supported ? h('p', { class: 'warn' }, '⚠ 이 브라우저는 USB 연결을 지원하지 않아요. 크롬 또는 엣지를 사용해 주세요.') : null,
          logv);
      },
      buttons: [{ label: '닫기' }],
    });
  }

  app.on('project', () => { loadedFor = null; });

  return {
    el,
    onShow() {
      world.mount(viewBox);
      world.showArrows = false;
      if (world.needsRebuild) world.rebuild();
      for (const r of world.robots.values()) r.arrow.visible = false;
      boardSel.value = app.project.board || 'uno';
      if (loadedFor !== app.project) loadWs();
      else ensureWs();
      setMode(app.project.code.mode || 'block');
      refreshStatus(true);
      setTimeout(() => ws && Blockly.svgResize(ws), 30);
      setRunUI(runner.running);
      if (world.fittedFor !== app.project) { world.fittedFor = app.project; setTimeout(() => { if (world.robotGroup.children.length) world.v.fit(world.robotGroup, { pad: 1.25 }); }, 60); }
    },
    onHide() { if (ws) Blockly.hideChaff(); },
    get ws() { return ws; },
    run,
  };
}

void TEXT_API;
