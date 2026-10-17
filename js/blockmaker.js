// 🔧 블럭 만들기: 모양 + 부품(모터, LED …) + 움직임 = 블럭
import * as THREE from 'three';
import { h, uid, toast, ask, clone } from './util.js';
import { Viewer, makeGrid } from './viewer.js';
import { COMPONENTS, MOTIONS, buildBlockModel } from './components.js';
import { LIB, libStructure } from './library.js';
import { P } from './project.js';

const ICONS = { dc: '🛞', servo: '🦾', linear: '↕️', led: '💡', buzzer: '🎵', lcd: '📟', button: '🔘', distance: '📏', line: '⚫', none: '🧱' };

export function newBlock(project, component = 'dc', partId = null) {
  const c = COMPONENTS[component];
  return {
    id: uid('b'), name: P.uniqueName(project, c.name.replace(' ', '') + ' 블럭', project.blocks),
    icon: ICONS[component], component, motion: c.motions[0], partId: c.part ? partId : null,
    partRot: [0, 0, 0], pivot: 'auto', allowChildren: c.part,
  };
}

export function createBlockMaker(app) {
  const el = h('section', { class: 'blockmaker three-col' });
  const v = new Viewer({ grid: 200, background: '#f2f7ff' });
  v.scene.add(makeGrid(300, 10));
  const holder = new THREE.Group();
  v.scene.add(holder);
  let cur = null;
  let model = null;
  let t = 0;
  let manual = null;

  const left = h('aside', { class: 'side left' });
  const center = h('div', { class: 'center' });
  const right = h('aside', { class: 'side right wizard' });
  el.append(left, center, right);

  const list = h('div', { class: 'block-list' });
  left.append(
    h('h3', {}, '내 블럭들'),
    h('button', { class: 'btn wide primary', onclick: () => create() }, '➕ 새 블럭 만들기'),
    list,
    h('p', { class: 'hint' }, '블럭은 조립할 때 여러 번 쓸 수 있어요. 바퀴 블럭 1개로 바퀴 4개를 붙일 수 있어요!'));

  const viewBox = h('div', { class: 'view' });
  const slider = h('input', { type: 'range', min: 0, max: 180, value: 90, class: 'range' });
  const sliderLabel = h('span', { class: 'pill' }, '');
  const testBar = h('div', { class: 'toolbar floating bottom' }, h('span', {}, '움직여 보기'), slider, sliderLabel,
    h('button', { class: 'tbtn', onclick: () => { manual = null; } }, '▶ 자동'));
  center.append(viewBox, testBar, h('div', { class: 'view-hint' }, '노란색 = 부품, 위쪽 = 붙이는 면의 바깥쪽이에요. 블럭의 바닥이 다른 모양에 붙어요.'));
  v.mount(viewBox);
  slider.addEventListener('input', () => { manual = Number(slider.value); });

  v.onFrame((dt) => {
    if (!model) return;
    t += dt;
    const m = model.motion;
    if (m === 'spin') { model.setSpin(model.spinAngle + dt * (manual === null ? 4 : (manual - 90) / 15)); sliderLabel.textContent = manual === null ? '빙글빙글' : '속도 ' + Math.round((manual - 90) * 1.11); }
    else if (m === 'turn' || m === 'swing') { const a = manual === null ? 90 + Math.sin(t * 1.5) * 80 : manual; model.setValue(a); sliderLabel.textContent = Math.round(a) + '도'; }
    else if (m === 'slide') { const a = manual === null ? 50 + Math.sin(t * 1.5) * 50 : manual / 1.8; model.setValue(a); sliderLabel.textContent = Math.round(a) + '%'; }
    else sliderLabel.textContent = '움직이지 않아요';
    if (model.ref.led) { const on = Math.sin(t * 4) > 0; model.ref.led.mat.emissive.set(on ? '#ff3030' : '#000'); model.ref.led.mat.color.set(on ? '#ff3030' : '#7f1d1d'); model.ref.led.glow.material.opacity = on ? 0.35 : 0; }
  });

  function refreshList() {
    const p = app.project;
    list.replaceChildren(...p.blocks.map((b) => h('button', {
      class: 'block-item' + (cur && cur.id === b.id ? ' on' : ''), onclick: () => select(b.id),
    }, h('span', { class: 'bi' }, b.icon || ICONS[b.component]), h('span', {}, h('b', {}, b.name), h('small', {}, COMPONENTS[b.component].name + ' · ' + MOTIONS[b.motion].name)),
    h('span', { class: 'count' }, p.instances.filter((i) => i.blockId === b.id).length || ''))));
    if (!p.blocks.length) list.append(h('div', { class: 'empty' }, '아직 블럭이 없어요'));
  }

  function rebuildModel() {
    holder.clear();
    model = null;
    if (!cur) return;
    model = buildBlockModel(cur, app.project);
    holder.add(model.root);
    // 붙이는 면 표시
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 1, 32), new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.35 }));
    pad.position.y = 0.5;
    holder.add(pad);
    const m = model.motion;
    slider.min = 0; slider.max = 180;
    slider.disabled = m === 'none';
  }

  function fit() { if (holder.children.length) v.fit(holder, { pad: 1.5 }); }

  function save(rebuild = true) {
    if (rebuild) rebuildModel();
    refreshList();
    app.changed('block');
  }

  function create(partId = null, component = 'dc') {
    const b = newBlock(app.project, component, partId);
    app.project.blocks.push(b);
    cur = b;
    manual = null;
    save();
    renderWizard();
    fit();
    return b;
  }

  function select(id) {
    cur = P.block(app.project, id) || null;
    manual = null;
    rebuildModel();
    refreshList();
    renderWizard();
    fit();
  }

  function card(sel, icon, title, desc, onClick) {
    return h('button', { class: 'choice' + (sel ? ' on' : ''), onclick: onClick }, h('span', { class: 'ci' }, icon), h('b', {}, title), desc ? h('small', {}, desc) : null);
  }

  function renderWizard() {
    if (!cur) {
      right.replaceChildren(h('div', { class: 'tip' }, h('b', {}, '🔧 블럭이란?'),
        h('p', {}, '모양(바퀴, 팔 …)에 부품(모터, 서보 …)을 붙인 것이에요. 블럭을 조립하면 코딩으로 움직일 수 있어요.'),
        h('button', { class: 'btn wide primary', onclick: () => create() }, '➕ 새 블럭 만들기')));
      return;
    }
    const b = cur;
    const comp = COMPONENTS[b.component];
    const p = app.project;
    const name = h('input', { class: 'input', value: b.name });
    name.addEventListener('change', () => { b.name = name.value.trim() || b.name; save(false); });

    const steps = [];
    steps.push(h('div', { class: 'wstep' }, h('div', { class: 'wnum' }, '1'), h('div', { class: 'wbody' }, h('b', {}, '블럭 이름'), name)));
    steps.push(h('div', { class: 'wstep' }, h('div', { class: 'wnum' }, '2'), h('div', { class: 'wbody' }, h('b', {}, '어떤 부품을 붙일까요?'),
      h('div', { class: 'choices' }, Object.entries(COMPONENTS).map(([k, c]) => card(b.component === k, c.icon, c.name, null, () => {
        b.component = k;
        b.icon = ICONS[k];
        b.motion = c.motions[0];
        if (!c.part) b.partId = null;
        else if (!b.partId) b.partId = (p.structures[0] || {}).id || null;
        b.allowChildren = c.part;
        if (/블럭\d*$/.test(b.name)) b.name = P.uniqueName(p, c.name.replace(' ', '') + ' 블럭', p.blocks.filter((x) => x !== b));
        save(); renderWizard(); fit();
      }))),
      h('small', { class: 'hint' }, comp.desc))));
    if (comp.motions.length > 1 || comp.motions[0] !== 'none') {
      steps.push(h('div', { class: 'wstep' }, h('div', { class: 'wnum' }, '3'), h('div', { class: 'wbody' }, h('b', {}, '어떻게 움직일까요?'),
        h('div', { class: 'choices two' }, comp.motions.map((m) => card(b.motion === m, MOTIONS[m].icon, MOTIONS[m].name, MOTIONS[m].desc, () => { b.motion = m; save(); renderWizard(); fit(); }))))));
    }
    if (comp.part) {
      const partChoices = [
        ...p.structures.map((s) => card(b.partId === s.id, s.icon || '🧱', s.name, '내 모양', () => { b.partId = s.id; b.partRot = [0, 0, 0]; save(); renderWizard(); fit(); })),
        ...LIB.map((l) => card(false, l.icon, l.name, '만들어진 모양', () => {
          const s = libStructure(l.id);
          s.name = P.uniqueName(p, l.name, p.structures);
          p.structures.push(s);
          b.partId = s.id; b.partRot = [0, 0, 0];
          if (/블럭\d*$/.test(b.name)) b.name = P.uniqueName(p, l.name + ' 블럭', p.blocks.filter((x) => x !== b));
          save(); renderWizard(); fit();
        })),
      ];
      steps.push(h('div', { class: 'wstep' }, h('div', { class: 'wnum' }, '4'), h('div', { class: 'wbody' }, h('b', {}, '어떤 모양에 붙일까요?'),
        h('div', { class: 'choices scroll' }, partChoices),
        h('button', { class: 'btn small', onclick: () => app.go('maker') }, '🧱 새 모양 만들러 가기'))));
      const rot = (i) => () => { b.partRot = [...(b.partRot || [0, 0, 0])]; b.partRot[i] = (b.partRot[i] + 90) % 360; save(); fit(); };
      steps.push(h('div', { class: 'wstep' }, h('div', { class: 'wnum' }, '5'), h('div', { class: 'wbody' }, h('b', {}, '모양 방향 맞추기'),
        h('small', { class: 'hint' }, '모양은 부품의 축에 자동으로 맞춰져요. 방향이 이상하면 눌러 보세요.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: rot(0) }, '↻ 앞으로 눕히기'),
          h('button', { class: 'btn small', onclick: rot(2) }, '↻ 옆으로 눕히기'),
          h('button', { class: 'btn small', onclick: rot(1) }, '↻ 빙글 돌리기'),
          h('button', { class: 'btn small', onclick: () => { b.partRot = [0, 0, 0]; save(); fit(); } }, '↺ 처음대로')),
        b.motion !== 'none' ? h('div', { class: 'row' }, h('span', { class: 'label' }, '도는 중심:'),
          h('button', { class: 'btn small' + (b.pivot !== 'center' ? ' on' : ''), onclick: () => { b.pivot = 'auto'; save(); renderWizard(); } }, b.motion === 'swing' ? '모양의 끝' : '모양의 바닥'),
          h('button', { class: 'btn small' + (b.pivot === 'center' ? ' on' : ''), onclick: () => { b.pivot = 'center'; save(); renderWizard(); } }, '모양의 가운데')) : null,
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!b.allowChildren, onchange: (e) => { b.allowChildren = e.target.checked; save(false); } }),
          ' 다른 블럭을 이 블럭 모양 위에 붙일 수 있어요'),
        h('small', { class: 'hint' }, '로봇팔처럼 이어 붙이려면 켜 두세요.'))));
    }
    steps.push(h('div', { class: 'wstep done' }, h('div', { class: 'wnum' }, '✔'), h('div', { class: 'wbody' },
      h('b', {}, '완성! 이제 조립해요'),
      h('button', { class: 'btn wide primary', onclick: () => app.go('assemble') }, '🚗 조립하러 가기 →'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => { const c = clone(b); c.id = uid('b'); c.name = P.uniqueName(p, b.name, p.blocks); p.blocks.push(c); cur = c; save(); renderWizard(); } }, '📄 블럭 복제'),
        h('button', { class: 'btn small danger', onclick: async () => {
          const n = p.instances.filter((i) => i.blockId === b.id).length;
          if (!await ask('블럭 지우기', n ? `조립에 ${n}개 붙어 있어요. 같이 지워져요. 지울까요?` : `"${b.name}" 블럭을 지울까요?`, '지우기', '취소')) return;
          P.removeBlock(p, b.id); cur = p.blocks[0] || null; rebuildModel(); save(false); renderWizard();
        } }, '🗑️ 지우기')))));
    right.replaceChildren(h('h3', {}, (b.icon || '') + ' 블럭 꾸미기'), ...steps);
  }

  app.on('project', () => { cur = null; });

  return {
    el,
    onShow() {
      if (cur && !app.project.blocks.includes(cur)) cur = null;
      if (!cur && app.project.blocks.length) cur = app.project.blocks[0];
      rebuildModel(); refreshList(); renderWizard(); fit();
    },
    newBlockWithPart(partId) {
      app.go('blocks');
      create(partId, 'dc');
      toast('🔧 모양에 붙일 부품을 골라 주세요');
    },
    select(id) { app.go('blocks'); select(id); },
  };
}
