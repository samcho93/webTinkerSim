// 🚗 조립하기: 바탕 모양 위에 블럭을 마우스로 끌어다 붙여요
import * as THREE from 'three';
import { h, uid, toast, ask, modal, clamp } from './util.js';
import { COMPONENTS, MOTIONS, LED_COLORS } from './components.js';
import { STAGES } from './world.js';
import { P } from './project.js';
import { libStructure } from './library.js';
import { boardPinText } from './codegen.js';
import { NOTES } from './codegen.js';

export function createAssemble(app) {
  const world = app.world;
  const el = h('section', { class: 'assemble three-col' });
  const left = h('aside', { class: 'side left' });
  const center = h('div', { class: 'center' });
  const right = h('aside', { class: 'side right' });
  el.append(left, center, right);

  const robotList = h('div', { class: 'robot-list' });
  const palette = h('div', { class: 'palette' });
  left.append(
    h('h3', {}, '🤖 내 작품(로봇)'),
    robotList,
    h('button', { class: 'btn wide', onclick: () => chooseBase() }, '➕ 새 로봇 만들기 (바탕 고르기)'),
    h('h3', {}, '🧩 블럭 붙이기'),
    h('p', { class: 'hint' }, '블럭을 끌어서 바탕 모양 위에 놓아요. 놓을 면에 자동으로 착! 붙어요.'),
    palette,
    h('button', { class: 'btn small', onclick: () => app.go('blocks') }, '🔧 블럭 만들러 가기'));

  const viewBox = h('div', { class: 'view' });
  const stageSel = h('select', { class: 'input small', onchange: () => { app.project.stage = stageSel.value; world.stageType = null; app.changed('stage'); } },
    Object.entries(STAGES).map(([k, s]) => h('option', { value: k }, s.icon + ' ' + s.name)));
  const placeHint = h('div', { class: 'place-hint' });
  center.append(viewBox,
    h('div', { class: 'toolbar floating' },
      h('span', {}, '무대'), stageSel,
      h('span', { class: 'sep' }),
      h('button', { class: 'tbtn', onclick: () => fitAll() }, '🎯 전체 보기'),
      h('button', { class: 'tbtn', onclick: () => app.go('code') }, '💻 코딩하러 가기 →')),
    placeHint,
    h('div', { class: 'view-hint' }, '블럭을 눌러 고르고 끌면 다른 곳으로 옮겨져요 · 바탕을 끌면 로봇이 움직여요 · 주황 화살표 = 로봇의 앞쪽'));

  let mounted = false;
  let placing = null; // { block, spin, mount }
  let drag = null;
  let downInfo = null;

  // ---------------- 왼쪽 목록 ----------------
  function refreshLeft() {
    const p = app.project;
    const sel = world.selected;
    robotList.replaceChildren();
    if (!p.robots.length) robotList.append(h('div', { class: 'empty' }, '바탕 모양을 골라 로봇을 만들어요'));
    for (const r of p.robots) {
      const isSel = sel && sel.type === 'robot' && sel.id === r.id;
      const item = h('div', { class: 'robot-item' },
        h('button', { class: 'ri-head' + (isSel ? ' on' : ''), onclick: () => select({ type: 'robot', id: r.id }) }, '🤖 ', h('b', {}, r.name)));
      const tree = h('div', { class: 'tree' });
      const walk = (parentId, depth) => {
        for (const i of P.instsOf(p, r.id).filter((x) => (x.parentId || null) === parentId)) {
          const b = P.block(p, i.blockId);
          const on = sel && sel.type === 'inst' && sel.id === i.id;
          tree.append(h('button', { class: 'tree-item' + (on ? ' on' : ''), style: { paddingLeft: 10 + depth * 16 + 'px' }, onclick: () => select({ type: 'inst', id: i.id }) },
            (depth ? '└ ' : '') + (b ? b.icon : '❔') + ' ' + i.name));
          walk(i.id, depth + 1);
        }
      };
      walk(null, 0);
      item.append(tree);
      robotList.append(item);
    }
    palette.replaceChildren(...p.blocks.map((b) => {
      const c = h('div', { class: 'pal-card', title: '끌어서 붙이기' }, h('span', { class: 'pi' }, b.icon), h('b', {}, b.name), h('small', {}, COMPONENTS[b.component].name));
      c.addEventListener('pointerdown', (e) => { e.preventDefault(); startPlacing(b); });
      return c;
    }));
    if (!p.blocks.length) palette.append(h('div', { class: 'empty' }, '아직 블럭이 없어요. 🔧 블럭 만들기에서 만들어 주세요.'));
  }

  // ---------------- 선택 ----------------
  function select(s) {
    world.setSelected(s);
    refreshLeft();
    renderRight();
  }

  function fitAll() {
    if (world.robotGroup.children.length) world.v.fit(world.robotGroup, { pad: 1.3 });
  }

  // ---------------- 새 로봇 ----------------
  function chooseBase() {
    const p = app.project;
    modal({
      title: '🤖 바탕 모양 고르기',
      body: (c) => {
        c.append(h('p', {}, '로봇의 몸통(바탕)이 될 모양을 골라요. 블럭들이 이 모양에 붙어서 같이 움직여요.'));
        const grid = h('div', { class: 'choices' });
        for (const s of p.structures) grid.append(h('button', { class: 'choice', onclick: () => { newRobotWithBase(s.id); c.closest('.modal-back').remove(); } }, h('span', { class: 'ci' }, s.icon || '🧱'), h('b', {}, s.name)));
        grid.append(h('button', { class: 'choice', onclick: () => { const s = libStructure('plate', P.uniqueName(p, '바탕 판', p.structures)); s.shapes[0].size = [140, 8, 90]; s.shapes[0].pos = [0, 4, 0]; s.icon = '🟫'; p.structures.push(s); newRobotWithBase(s.id); c.closest('.modal-back').remove(); } },
          h('span', { class: 'ci' }, '🟫'), h('b', {}, '간단한 바탕 판'), h('small', {}, '바로 시작')));
        c.append(grid);
        c.append(h('button', { class: 'btn', onclick: () => { c.closest('.modal-back').remove(); app.go('maker'); } }, '🧱 새 바탕 모양 만들러 가기'));
      },
      buttons: [{ label: '닫기' }],
    });
  }

  function newRobotWithBase(structId) {
    const p = app.project;
    const s = P.struct(p, structId);
    const n = p.robots.length;
    const r = { id: uid('r'), name: P.uniqueName(p, s ? s.name : '로봇', p.robots), baseId: structId, pos: [n * 220, 0], rotY: 0, mode: 'auto' };
    p.robots.push(r);
    app.go('assemble');
    app.changed('robot');
    select({ type: 'robot', id: r.id });
    toast('🤖 로봇을 만들었어요. 왼쪽 블럭을 끌어서 붙여 보세요!');
  }

  // ---------------- 블럭 붙이기 ----------------
  function startPlacing(block) {
    if (world.running) app.runner.stop();
    if (!app.project.robots.length) { toast('먼저 바탕 모양을 골라 로봇을 만들어 주세요'); chooseBase(); return; }
    placing = { block, spin: 0, mount: null, scale: 1 };
    world.v.controls.enabled = false;
    viewBox.classList.add('placing');
    placeHint.textContent = `${block.icon} ${block.name}: 붙일 곳에 놓으세요 · R = 돌리기 · Esc = 취소`;
    placeHint.classList.add('show');
  }
  function stopPlacing() {
    placing = null;
    world.hideGhost();
    world.v.controls.enabled = true;
    viewBox.classList.remove('placing');
    placeHint.classList.remove('show');
  }

  function autoScale(block, mi) {
    // 바탕에 비해 너무 크거나 작으면 알맞게 맞춰요
    const robot = world.robots.get(mi.robotId);
    if (!robot || !world.ghost) return 1;
    const gb = new THREE.Box3().setFromObject(world.ghost);
    const bs = gb.getSize(new THREE.Vector3());
    const bmax = Math.max(bs.x, bs.y, bs.z) / (world.ghost.scale.x || 1);
    const rb = robot.localBox.getSize(new THREE.Vector3());
    const rmax = Math.max(rb.x, rb.y, rb.z);
    if (bmax > rmax * 1.3) return Math.max(0.3, Math.round((rmax * 0.6 / bmax) * 10) / 10);
    if (bmax < rmax * 0.06) return Math.min(3, Math.round((rmax * 0.15 / bmax) * 10) / 10);
    return 1;
  }

  function updateGhost(e) {
    const hit = world.attachHits(e);
    if (!hit || hit.blocked) {
      world.hideGhost();
      placing.mount = null;
      placeHint.textContent = hit && hit.blocked ? '🙅 이 부분에는 붙일 수 없어요 (블럭 설정에서 "다른 블럭을 붙일 수 있어요"를 켜세요)' : `${placing.block.icon} ${placing.block.name}: 바탕 모양 위에 놓으세요 · R = 돌리기 · Esc = 취소`;
      return;
    }
    const mi = world.hitToMount(hit);
    placing.mount = mi;
    world.showGhost(placing.block, mi, placing.scale, placing.spin);
    if (placing.scale === 1 && !placing.scaled) {
      const s = autoScale(placing.block, mi);
      if (s !== 1) { placing.scale = s; placing.scaled = true; world.showGhost(placing.block, mi, s, placing.spin); }
    }
    const tgt = mi.parentId ? P.inst(app.project, mi.parentId).name : P.robot(app.project, mi.robotId).name;
    placeHint.textContent = `${placing.block.icon} ${placing.block.name} → "${tgt}"에 붙여요 · R = 돌리기 · Esc = 취소`;
  }

  function placeNow() {
    const mi = placing.mount;
    if (!mi) { toast('바탕 모양 위에 놓아 주세요'); return; }
    const p = app.project;
    const b = placing.block;
    const base = b.name.replace(/\s*블럭\s*\d*$/, '').trim() || COMPONENTS[b.component].name;
    const inst = {
      id: uid('i'), name: P.nextInstName(p, base.replace(/\s/g, '')), blockId: b.id, robotId: mi.robotId, parentId: mi.parentId,
      pos: mi.pos, normal: mi.normal, spin: placing.spin, scale: placing.scale, reverse: false,
    };
    p.instances.push(inst);
    if (placing.scale !== 1) toast(`📏 크기를 ${placing.scale}배로 자동으로 맞췄어요`);
    stopPlacing();
    app.changed('inst');
    select({ type: 'inst', id: inst.id });
  }

  // ---------------- 마우스 ----------------
  const dom = world.dom;
  function onDown(e) {
    if (app.current !== 'assemble' || e.button !== 0) return;
    if (placing) { e.preventDefault(); return; }
    if (world.running) return;
    const hit = world.pick(e);
    downInfo = { x: e.clientX, y: e.clientY, hit };
    if (hit) {
      const o = hit.object.userData.owner;
      world.v.controls.enabled = false;
      if (o.instId) {
        select({ type: 'inst', id: o.instId });
        drag = { type: 'inst', id: o.instId, started: false };
      } else {
        select({ type: 'robot', id: o.robotId });
        const r = world.robots.get(o.robotId);
        const g = world.groundPoint(e);
        drag = { type: 'robot', id: o.robotId, started: false, off: g ? g.clone().sub(r.root.position) : new THREE.Vector3() };
      }
      dom.setPointerCapture(e.pointerId);
    }
  }
  function onMove(e) {
    if (app.current !== 'assemble') return;
    if (placing) { updateGhost(e); return; }
    if (!drag) return;
    if (!drag.started && downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 5) return;
    drag.started = true;
    if (drag.type === 'robot') {
      const r = world.robots.get(drag.id);
      const g = world.groundPoint(e);
      if (!g || !r) return;
      r.root.position.x = Math.round((g.x - drag.off.x) / 5) * 5;
      r.root.position.z = Math.round((g.z - drag.off.z) / 5) * 5;
    } else {
      const io = world.insts.get(drag.id);
      const hit = world.attachHits(e, drag.id);
      if (!io || !hit || hit.blocked) return;
      const mi = world.hitToMount(hit);
      if (io.mount.parent !== mi.attachObj) mi.attachObj.add(io.mount);
      world.applyMount(io.mount, { ...io.data, pos: mi.pos, normal: mi.normal });
      drag.mi = mi;
    }
  }
  function onUp(e) {
    world.v.controls.enabled = true;
    if (drag && drag.started) {
      const p = app.project;
      if (drag.type === 'robot') {
        const r = P.robot(p, drag.id);
        const ro = world.robots.get(drag.id);
        r.pos = [ro.root.position.x, ro.root.position.z];
        app.changed('robot');
      } else if (drag.mi) {
        const inst = P.inst(p, drag.id);
        const mi = drag.mi;
        inst.parentId = mi.parentId;
        inst.pos = mi.pos; inst.normal = mi.normal;
        if (inst.robotId !== mi.robotId) {
          const walk = (id) => { const x = P.inst(p, id); x.robotId = mi.robotId; P.children(p, id).forEach((c) => walk(c.id)); };
          walk(inst.id);
        }
        app.changed('inst');
      }
      renderRight();
    } else if (!drag && downInfo && !downInfo.hit && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 5) {
      select(null);
    }
    drag = null;
    downInfo = null;
  }
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', (e) => {
    if (app.current !== 'assemble') return;
    if (placing) { if (e.target === dom && e.button === 0) placeNow(); return; }
    onUp(e);
  });
  window.addEventListener('keydown', (e) => {
    if (app.current !== 'assemble' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'Escape') { stopPlacing(); select(null); }
    if (placing && (e.key === 'r' || e.key === 'R')) { placing.spin = (placing.spin + 90) % 360; if (placing.mount) world.showGhost(placing.block, placing.mount, placing.scale, placing.spin); }
    if (!placing && (e.key === 'Delete' || e.key === 'Backspace')) removeSelected();
    if (!placing && (e.key === 'r' || e.key === 'R')) rotateSelected(90);
  });

  // ---------------- 오른쪽 설정 ----------------
  function rotateSelected(deg) {
    const s = world.selected;
    if (!s) return;
    const p = app.project;
    if (s.type === 'inst') { const i = P.inst(p, s.id); i.spin = ((i.spin || 0) + deg + 360) % 360; }
    else { const r = P.robot(p, s.id); r.rotY = ((r.rotY || 0) + deg + 360) % 360; }
    app.changed('inst');
  }
  async function removeSelected() {
    const s = world.selected;
    if (!s) return;
    const p = app.project;
    if (s.type === 'inst') {
      const i = P.inst(p, s.id);
      const n = P.children(p, s.id).length;
      if (n && !await ask('떼어내기', `"${i.name}"에 붙은 블럭도 같이 떼어져요. 괜찮나요?`, '떼어내기', '취소')) return;
      P.removeInst(p, s.id);
    } else {
      const r = P.robot(p, s.id);
      if (!await ask('로봇 지우기', `"${r.name}" 로봇과 붙은 블럭을 모두 지울까요? (모양은 남아 있어요)`, '지우기', '취소')) return;
      P.removeRobot(p, s.id);
    }
    world.setSelected(null);
    app.changed('inst');
  }

  function renderRight() {
    const s = world.selected;
    const p = app.project;
    if (!s || (s.type === 'inst' && !P.inst(p, s.id)) || (s.type === 'robot' && !P.robot(p, s.id))) {
      right.replaceChildren(
        h('div', { class: 'tip' }, h('b', {}, '💡 조립하는 방법'),
          h('ol', {},
            h('li', {}, '➕ 새 로봇 만들기로 바탕 모양을 골라요'),
            h('li', {}, '왼쪽 블럭을 끌어서 바탕 위에 놓아요'),
            h('li', {}, '놓기 전에 R 키를 누르면 방향이 돌아가요'),
            h('li', {}, '붙인 블럭을 누르면 이름·방향·크기를 바꿀 수 있어요'),
            h('li', {}, '다 붙였으면 💻 코딩하러 가요'))),
        boardBox());
      return;
    }
    if (s.type === 'robot') return renderRobot(P.robot(p, s.id));
    return renderInst(P.inst(p, s.id));
  }

  function boardBox() {
    const p = app.project;
    const n = p.instances.filter((i) => { const c = P.compOf(p, i); return c && c !== 'none'; }).length;
    return h('div', { class: 'info-box' }, h('b', {}, '🔌 연결된 부품'), h('p', {}, `부품 ${n}개 · 보드는 💻 코딩·실행에서 골라요`));
  }

  function renderRobot(r) {
    const p = app.project;
    const ro = world.robots.get(r.id);
    const name = h('input', { class: 'input', value: r.name });
    name.addEventListener('change', () => { r.name = name.value.trim() || r.name; app.changed('robot', { rebuild: false }); refreshLeft(); });
    const wheels = ro ? ro.wheels.length : 0;
    const modeBtn = (m, label) => h('button', { class: 'btn small' + ((r.mode || 'auto') === m ? ' on' : ''), onclick: () => { r.mode = m; app.changed('robot'); renderRight(); } }, label);
    right.replaceChildren(
      h('h3', {}, '🤖 로봇 설정'),
      h('div', { class: 'label' }, '이름'), name,
      h('div', { class: 'label' }, '바탕 모양'),
      h('select', { class: 'input', onchange: (e) => { r.baseId = e.target.value; app.changed('robot'); } },
        p.structures.map((s) => h('option', { value: s.id, selected: s.id === r.baseId }, (s.icon || '🧱') + ' ' + s.name))),
      h('button', { class: 'btn small', onclick: () => app.screens.maker.openStruct(r.baseId) }, '🧱 바탕 모양 고치기'),
      h('div', { class: 'label' }, '움직이는 방법'),
      h('div', { class: 'row' }, modeBtn('auto', '🪄 자동'), modeBtn('fixed', '📌 바닥에 고정'), modeBtn('wheels', '🛞 바퀴로 달리기')),
      h('p', { class: 'hint' }, wheels ? `바닥에 닿은 바퀴 ${wheels}개를 찾았어요. 모터가 돌면 로봇이 굴러가요.` : '바닥에 닿은 바퀴가 없어서 제자리에 서 있어요.'),
      h('div', { class: 'label' }, '방향 돌리기'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => rotateSelected(90) }, '↺ 90°'),
        h('button', { class: 'btn small', onclick: () => rotateSelected(-90) }, '↻ 90°'),
        h('button', { class: 'btn small', onclick: () => rotateSelected(15) }, '↺ 15°'),
        h('button', { class: 'btn small', onclick: () => rotateSelected(-15) }, '↻ 15°')),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => { r.pos = [0, 0]; app.changed('robot'); } }, '⊙ 가운데로'),
        h('button', { class: 'btn small danger', onclick: removeSelected }, '🗑️ 로봇 지우기')),
      boardBox(),
    );
  }

  function renderInst(inst) {
    const p = app.project;
    const b = P.block(p, inst.blockId);
    if (!b) return;
    const c = COMPONENTS[b.component];
    const io = world.insts.get(inst.id);
    const name = h('input', { class: 'input', value: inst.name });
    name.addEventListener('change', () => {
      const nv = name.value.trim().replace(/\s+/g, '');
      if (!nv) { name.value = inst.name; return; }
      if (p.instances.some((x) => x !== inst && x.name === nv)) { toast('같은 이름이 이미 있어요'); name.value = inst.name; return; }
      inst.name = nv; app.changed('inst', { rebuild: false }); refreshLeft();
    });
    const scale = h('input', { type: 'range', min: 0.3, max: 3, step: 0.1, value: inst.scale || 1, class: 'range' });
    const scaleLbl = h('span', { class: 'pill' }, (inst.scale || 1) + '배');
    scale.addEventListener('input', () => { scaleLbl.textContent = scale.value + '배'; if (io) io.mount.scale.setScalar(Number(scale.value)); });
    scale.addEventListener('change', () => { inst.scale = Number(scale.value); app.changed('inst'); });
    const pin = boardPinText(p, inst);
    const parts = [
      h('h3', {}, `${b.icon} ${inst.name}`),
      h('div', { class: 'label' }, '코딩에서 부를 이름'), name,
      h('div', { class: 'kv' }, h('span', {}, '블럭'), h('b', {}, b.name), h('button', { class: 'link', onclick: () => app.screens.blocks.select(b.id) }, '고치기')),
      h('div', { class: 'kv' }, h('span', {}, '부품'), h('b', {}, c.icon + ' ' + c.name + (b.motion !== 'none' ? ' · ' + MOTIONS[b.motion].name : ''))),
      pin ? h('div', { class: 'kv' }, h('span', {}, '보드 핀'), h('b', {}, pin)) : null,
      h('div', { class: 'label' }, '방향'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => rotateSelected(90) }, '↻ 90° 돌리기'),
        h('button', { class: 'btn small', onclick: () => rotateSelected(15) }, '↻ 15°')),
      h('div', { class: 'label' }, '크기'), h('div', { class: 'row' }, scale, scaleLbl),
    ];
    if (b.component === 'dc' || b.component === 'servo') {
      parts.push(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!inst.reverse, onchange: (e) => { inst.reverse = e.target.checked; app.changed('inst'); } }), ' 반대 방향으로 움직이기'));
      if (b.component === 'dc' && io && io.robot.wheels.some((w) => w.io === io)) parts.push(h('p', { class: 'hint' }, '🛞 바닥에 닿은 바퀴예요. 속도를 + 로 주면 로봇이 앞(주황 화살표)으로 가도록 자동으로 맞췄어요.'));
    }
    parts.push(h('div', { class: 'label' }, '🧪 움직여 보기'), testBox(b, io));
    parts.push(h('div', { class: 'row' }, h('button', { class: 'btn small danger', onclick: removeSelected }, '🗑️ 떼어내기')));
    right.replaceChildren(...parts.filter(Boolean));
  }

  function testBox(b, io) {
    if (!io) return h('div');
    const st = io.state;
    const comp = b.component;
    if (comp === 'dc') {
      const btn = (sp, label) => h('button', { class: 'btn small', onclick: () => { st.speed = sp; } }, label);
      return h('div', { class: 'row' }, btn(-100, '◀ 뒤로'), btn(0, '■ 멈춤'), btn(100, '앞으로 ▶'));
    }
    if (comp === 'servo' || comp === 'linear') {
      const max = comp === 'servo' ? 180 : 100;
      const r = h('input', { type: 'range', min: 0, max, value: st.target, class: 'range' });
      const lbl = h('span', { class: 'pill' }, Math.round(st.target) + (comp === 'servo' ? '도' : '%'));
      r.addEventListener('input', () => { st.target = Number(r.value); lbl.textContent = r.value + (comp === 'servo' ? '도' : '%'); });
      return h('div', { class: 'row' }, r, lbl);
    }
    if (comp === 'led') {
      return h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => world.cmd('led', io.data.id, !st.on) }, '💡 켜기/끄기'),
        h('select', { class: 'input small', onchange: (e) => world.cmd('ledColor', io.data.id, e.target.value) }, Object.keys(LED_COLORS).map((k) => h('option', { value: k }, k))));
    }
    if (comp === 'lcd') {
      const i1 = h('input', { class: 'input', placeholder: '1번째 줄 (영어/숫자)', maxlength: 16 });
      const i2 = h('input', { class: 'input', placeholder: '2번째 줄', maxlength: 16 });
      const upd = () => { world.cmd('lcd', io.data.id, 1, i1.value); world.cmd('lcd', io.data.id, 2, i2.value); };
      i1.addEventListener('input', upd); i2.addEventListener('input', upd);
      return h('div', {}, i1, i2);
    }
    if (comp === 'buzzer') return h('div', { class: 'row' }, Object.entries(NOTES).slice(0, 8).map(([k, f]) => h('button', { class: 'btn tiny', onclick: () => world.tone(f, 0.3) }, k)));
    if (comp === 'distance') {
      const out = h('b', {}, '-');
      const upd = () => { out.textContent = world.measure(io) + ' cm'; };
      upd();
      return h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: upd }, '📏 재기'), out);
    }
    if (comp === 'line') return h('div', { class: 'row' }, h('span', {}, world.lineSee(io) ? '⚫ 검은 선 위' : '⚪ 흰 바닥'));
    if (comp === 'button') return h('p', { class: 'hint' }, '실행 중에 화면의 버튼을 마우스로 누르면 눌려요.');
    return h('p', { class: 'hint' }, '움직이지 않는 블럭이에요.');
  }

  world.on('rebuilt', () => { if (app.current === 'assemble') { refreshLeft(); } });
  app.on('project', () => { stopPlacing(); world.setSelected(null); });

  return {
    el,
    onShow() {
      world.mount(viewBox);
      world.showArrows = true;
      if (world.running) app.runner.stop();
      world.resetSim();
      if (world.needsRebuild) world.rebuild();
      stageSel.value = app.project.stage || 'grid';
      refreshLeft();
      renderRight();
      if (world.fittedFor !== app.project) { world.fittedFor = app.project; setTimeout(fitAll, 60); }
    },
    onHide() { stopPlacing(); },
    newRobotWithBase,
    fitAll,
    select,
  };
}

void clamp;
