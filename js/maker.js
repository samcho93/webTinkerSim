// 🧱 모양 만들기 (팅커캐드처럼 상자·원기둥을 합치고 구멍을 뚫어요)
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { h, uid, clone, toast, ask, prompt, downloadFile, pickFile } from './util.js';
import { Viewer, makeGrid } from './viewer.js';
import { SHAPES, COLORS, shapeMesh, placeShapeMesh, buildStructure, holeMaterial, material } from './shapes.js';
import { importStl, exportStl } from './stl.js';
import { LIB, libStructure } from './library.js';
import { P } from './project.js';

const r1 = (v) => Math.round(v * 10) / 10;

export function createMaker(app) {
  const el = h('section', { class: 'maker three-col' });
  const v = new Viewer({ grid: 300, background: '#eef5ff' });
  v.scene.add(makeGrid(400, 10));
  const work = new THREE.Group();
  v.scene.add(work);
  const preview = new THREE.Group();
  v.scene.add(preview);

  const tc = new TransformControls(v.camera, v.dom);
  tc.setTranslationSnap(5);
  tc.setRotationSnap(THREE.MathUtils.degToRad(15));
  tc.setScaleSnap(1);
  tc.setSize(0.9);
  v.scene.add(tc);

  let struct = null;
  let sel = null; // 선택된 모양 id
  const meshes = new Map();
  let undo = [], redo = [];
  let showFinal = false;

  // ---------- 화면 구성 ----------
  const left = h('aside', { class: 'side left' });
  const center = h('div', { class: 'center' });
  const right = h('aside', { class: 'side right' });
  el.append(left, center, right);

  left.append(
    h('h3', {}, '모양 넣기'),
    h('div', { class: 'shape-grid' }, Object.entries(SHAPES).map(([type, s]) =>
      h('button', { class: 'shape-btn', title: s.name + ' 넣기', onclick: () => addShape(type) }, h('span', {}, s.icon), s.name))),
    h('h3', {}, '파일에서 가져오기'),
    h('button', { class: 'btn wide', onclick: loadStl }, '📥 STL 파일 불러오기'),
    h('p', { class: 'hint' }, '팅커캐드에서 만든 모양을 "내보내기 → .STL" 로 저장한 뒤 불러오세요.'),
    h('h3', {}, '만들어진 모양 넣기'),
    h('div', { class: 'lib-grid' }, LIB.map((l) => h('button', { class: 'lib-btn', title: l.name + ' 넣기', onclick: () => addLib(l.id) }, h('span', {}, l.icon), l.name))),
  );

  const viewBox = h('div', { class: 'view' });
  const toolbar = h('div', { class: 'toolbar floating' });
  const modeBtns = {};
  const modes = [['translate', '✋ 옮기기'], ['rotate', '🔄 돌리기'], ['scale', '↔️ 크기']];
  for (const [m, label] of modes) {
    modeBtns[m] = h('button', { class: 'tbtn', onclick: () => setMode(m) }, label);
    toolbar.append(modeBtns[m]);
  }
  toolbar.append(
    h('span', { class: 'sep' }),
    h('button', { class: 'tbtn', title: '되돌리기 (Ctrl+Z)', onclick: doUndo }, '↶'),
    h('button', { class: 'tbtn', title: '다시하기 (Ctrl+Y)', onclick: doRedo }, '↷'),
    h('span', { class: 'sep' }),
    h('button', { class: 'tbtn', title: '복사 (Ctrl+D)', onclick: duplicate }, '📄 복사'),
    h('button', { class: 'tbtn', title: '지우기 (Delete)', onclick: removeSel }, '🗑️ 지우기'),
    h('span', { class: 'sep' }),
    h('button', { class: 'tbtn toggle', id: 'finalBtn', onclick: toggleFinal }, '✨ 완성 모습'),
    h('button', { class: 'tbtn', onclick: () => fitView() }, '🎯 전체 보기'),
  );
  center.append(viewBox, toolbar, h('div', { class: 'view-hint' }, '마우스: 왼쪽 끌기 = 돌려보기 · 오른쪽 끌기 = 옮겨보기 · 휠 = 크게/작게 · 모양을 끌면 바닥 위에서 움직여요'));
  v.mount(viewBox);

  const structSel = h('select', { class: 'input', onchange: () => openStruct(structSel.value) });
  const propBox = h('div', { class: 'props' });
  right.append(
    h('h3', {}, '만들고 있는 모양'),
    h('div', { class: 'row' }, structSel),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: newStruct }, '➕ 새 모양'),
      h('button', { class: 'btn small', onclick: renameStruct }, '✏️ 이름'),
      h('button', { class: 'btn small', onclick: copyStruct }, '📄 복제'),
      h('button', { class: 'btn small danger', onclick: deleteStruct }, '🗑️')),
    propBox,
    h('div', { class: 'next-box' },
      h('button', { class: 'btn wide primary', onclick: () => goBlock() }, '🔧 이 모양으로 블럭 만들기 →'),
      h('button', { class: 'btn wide', onclick: () => goBase() }, '🚗 바탕 모양으로 조립하기 →'),
      h('button', { class: 'btn wide', onclick: saveStl }, '📤 STL 파일로 내보내기')),
  );

  // ---------- 모양 목록 ----------
  function refreshList() {
    const p = app.project;
    structSel.replaceChildren(...p.structures.map((s) => h('option', { value: s.id, selected: struct && s.id === struct.id }, (s.icon || '🧱') + ' ' + s.name)));
    if (!p.structures.length) structSel.append(h('option', { value: '' }, '(모양이 없어요)'));
  }

  function ensureStruct() {
    const p = app.project;
    if (struct && p.structures.includes(struct)) return struct;
    struct = p.structures[0] || null;
    if (!struct) {
      struct = { id: uid('st'), name: P.uniqueName(p, '내 모양', p.structures), icon: '🧱', shapes: [] };
      p.structures.push(struct);
    }
    return struct;
  }

  function openStruct(id) {
    const s = P.struct(app.project, id);
    if (!s) return;
    struct = s;
    sel = null;
    undo = []; redo = [];
    rebuild();
    refreshList();
    fitView();
  }

  async function newStruct() {
    const n = await prompt('새 모양', '모양 이름을 지어 주세요', P.uniqueName(app.project, '내 모양', app.project.structures));
    if (!n) return;
    struct = { id: uid('st'), name: n, icon: '🧱', shapes: [] };
    app.project.structures.push(struct);
    sel = null; undo = []; redo = [];
    rebuild(); refreshList(); app.changed('struct', { rebuild: false });
  }
  async function renameStruct() {
    if (!struct) return;
    const n = await prompt('이름 바꾸기', '새 이름', struct.name);
    if (n) { struct.name = n; refreshList(); app.changed('struct'); }
  }
  function copyStruct() {
    if (!struct) return;
    const c = clone(struct);
    c.id = uid('st'); c.name = P.uniqueName(app.project, struct.name + ' 복사', app.project.structures);
    c.shapes.forEach((s) => { s.id = uid('s'); });
    app.project.structures.push(c);
    struct = c; rebuild(); refreshList(); app.changed('struct', { rebuild: false });
  }
  async function deleteStruct() {
    if (!struct) return;
    const used = P.structUsage(app.project, struct.id);
    const msg = used.length ? `이 모양은 ${used.join(', ')} 에서 쓰고 있어요. 그래도 지울까요?` : `"${struct.name}" 모양을 지울까요?`;
    if (!await ask('모양 지우기', msg, '지우기', '취소')) return;
    const id = struct.id;
    app.project.structures = app.project.structures.filter((s) => s.id !== id);
    for (const b of app.project.blocks) if (b.partId === id) b.partId = null;
    for (const r of app.project.robots.filter((x) => x.baseId === id)) P.removeRobot(app.project, r.id);
    struct = null;
    ensureStruct(); rebuild(); refreshList(); app.changed('struct');
  }

  // ---------- 3D ----------
  function rebuild() {
    tc.detach();
    work.clear();
    meshes.clear();
    preview.clear();
    if (!struct) return;
    for (const s of struct.shapes) {
      const m = shapeMesh(s, app.project);
      m.userData.shapeId = s.id;
      if (s.id === sel) highlight(m, true);
      meshes.set(s.id, m);
      work.add(m);
    }
    if (showFinal) {
      work.visible = false;
      preview.add(buildStructure(struct, app.project));
    } else work.visible = true;
    const m = sel && meshes.get(sel);
    if (m && !showFinal) tc.attach(m);
    renderProps();
  }

  function highlight(m, on) {
    const s = struct.shapes.find((x) => x.id === m.userData.shapeId);
    if (!s) return;
    if (s.hole) { m.material = holeMaterial; return; }
    m.material = on ? material(s.color, { emissive: new THREE.Color(s.color).multiplyScalar(0.25) }) : material(s.color);
  }

  function select(id) {
    if (sel && meshes.get(sel)) highlight(meshes.get(sel), false);
    sel = id;
    const m = id && meshes.get(id);
    if (m) { highlight(m, true); if (!showFinal) tc.attach(m); } else tc.detach();
    renderProps();
  }

  function setMode(m) {
    tc.setMode(m);
    for (const k in modeBtns) modeBtns[k].classList.toggle('on', k === m);
  }
  setMode('translate');

  function pushUndo() {
    undo.push(JSON.stringify(struct.shapes));
    if (undo.length > 60) undo.shift();
    redo = [];
  }
  function commit(kind = 'shape') {
    app.changed(kind);
  }
  function doUndo() {
    if (!undo.length) return;
    redo.push(JSON.stringify(struct.shapes));
    struct.shapes = JSON.parse(undo.pop());
    if (!struct.shapes.find((s) => s.id === sel)) sel = null;
    rebuild(); commit();
  }
  function doRedo() {
    if (!redo.length) return;
    undo.push(JSON.stringify(struct.shapes));
    struct.shapes = JSON.parse(redo.pop());
    rebuild(); commit();
  }

  function addShape(type, extra = {}) {
    ensureStruct();
    pushUndo();
    const def = SHAPES[type];
    const n = struct.shapes.length;
    const off = n ? ((n % 5) - 2) * 10 : 0;
    const s = { id: uid('s'), type, pos: [off, def.size[1] / 2, off ? 20 : 0], size: [...def.size], rot: [0, 0, 0], color: COLORS[(n + 5) % COLORS.length], hole: false, ...extra };
    struct.shapes.push(s);
    if (showFinal) toggleFinal();
    sel = s.id;
    rebuild(); refreshList(); commit();
    if (struct.shapes.length === 1) v.fit(work, { pad: 4 });
  }

  function addLib(id) {
    ensureStruct();
    pushUndo();
    const l = LIB.find((x) => x.id === id);
    for (const s of l.make()) struct.shapes.push(s);
    if (!struct.shapes.length) return;
    sel = null;
    rebuild(); refreshList(); commit(); fitView();
    toast(`${l.icon} ${l.name} 모양을 넣었어요`);
  }

  function duplicate() {
    const s = struct && struct.shapes.find((x) => x.id === sel);
    if (!s) return;
    pushUndo();
    const c = clone(s);
    c.id = uid('s');
    c.pos[0] += 10; c.pos[2] += 10;
    struct.shapes.push(c);
    sel = c.id;
    rebuild(); commit();
  }
  function removeSel() {
    if (!struct || !sel) return;
    pushUndo();
    struct.shapes = struct.shapes.filter((x) => x.id !== sel);
    sel = null;
    rebuild(); commit();
  }
  function dropToFloor(s) {
    const m = meshes.get(s.id);
    if (!m) return;
    m.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(m);
    s.pos[1] = r1(s.pos[1] - b.min.y);
  }

  function toggleFinal() {
    showFinal = !showFinal;
    el.querySelector('#finalBtn').classList.toggle('on', showFinal);
    rebuild();
  }

  function fitView() {
    const target = showFinal ? preview : work;
    if (!struct || !struct.shapes.length) { v.camera.position.set(160, 140, 200); v.controls.target.set(0, 10, 0); return; }
    v.fit(target, { pad: 1.6 });
  }

  // TransformControls → 모양 정보
  function syncFromMesh(m) {
    const s = struct.shapes.find((x) => x.id === m.userData.shapeId);
    if (!s) return;
    s.pos = [m.position.x, m.position.y, m.position.z].map(r1);
    s.rot = [m.rotation.x, m.rotation.y, m.rotation.z].map((a) => Math.round(THREE.MathUtils.radToDeg(a)));
    s.size = [m.scale.x, m.scale.y, m.scale.z].map((x) => Math.max(1, Math.round(x)));
    placeShapeMesh(m, s);
  }
  tc.addEventListener('dragging-changed', (e) => {
    v.controls.enabled = !e.value;
    if (e.value) pushUndo();
    else if (tc.object) { syncFromMesh(tc.object); renderProps(); commit(); }
  });
  tc.addEventListener('objectChange', () => { if (tc.object) { syncFromMesh(tc.object); updatePropInputs(); } });

  // 모양을 직접 끌어서 바닥 위에서 옮기기
  let drag = null;
  v.dom.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || showFinal) return;
    if (tc.axis) return; // 손잡이를 잡았어요
    const hit = v.hits(e, [...meshes.values()], false)[0];
    if (!hit) { downAt = [e.clientX, e.clientY]; return; }
    const id = hit.object.userData.shapeId;
    select(id);
    const s = struct.shapes.find((x) => x.id === id);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y);
    const start = new THREE.Vector3();
    v.raycaster.ray.intersectPlane(plane, start);
    drag = { s, plane, start, pos0: [...s.pos], moved: false };
    v.controls.enabled = false;
    v.dom.setPointerCapture(e.pointerId);
  });
  let downAt = null;
  v.dom.addEventListener('pointermove', (e) => {
    if (!drag) return;
    v.setPointer(e);
    const pt = new THREE.Vector3();
    if (!v.raycaster.ray.intersectPlane(drag.plane, pt)) return;
    const dx = Math.round((pt.x - drag.start.x) / 5) * 5;
    const dz = Math.round((pt.z - drag.start.z) / 5) * 5;
    if (!drag.moved && (dx || dz)) { drag.moved = true; pushUndo(); }
    drag.s.pos[0] = r1(drag.pos0[0] + dx);
    drag.s.pos[2] = r1(drag.pos0[2] + dz);
    placeShapeMesh(meshes.get(drag.s.id), drag.s);
    updatePropInputs();
  });
  v.dom.addEventListener('pointerup', (e) => {
    if (drag) {
      if (drag.moved) commit();
      drag = null;
      v.controls.enabled = true;
      return;
    }
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4 && !tc.dragging) select(null);
    downAt = null;
  });

  window.addEventListener('keydown', (e) => {
    if (app.current !== 'maker' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { removeSel(); e.preventDefault(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'z') { doUndo(); e.preventDefault(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'y') { doRedo(); e.preventDefault(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'd') { duplicate(); e.preventDefault(); }
    else if (e.key === 'Escape') select(null);
  });

  // ---------- 오른쪽 속성 ----------
  const inputs = {};
  function numInput(key, idx, label, onSet) {
    const inp = h('input', { type: 'number', class: 'num', step: key === 'rot' ? 15 : 1 });
    inp.addEventListener('change', () => {
      const s = struct.shapes.find((x) => x.id === sel);
      if (!s) return;
      pushUndo();
      let val = Number(inp.value) || 0;
      if (key === 'size') val = Math.max(1, val);
      s[key][idx] = val;
      onSet && onSet(s);
      placeShapeMesh(meshes.get(s.id), s);
      commit();
      updatePropInputs();
    });
    inputs[key + idx] = inp;
    return h('label', { class: 'numl' }, h('span', {}, label), inp);
  }
  function updatePropInputs() {
    const s = struct && struct.shapes.find((x) => x.id === sel);
    if (!s) return;
    for (const k of ['size', 'pos', 'rot']) for (let i = 0; i < 3; i++) if (inputs[k + i] && document.activeElement !== inputs[k + i]) inputs[k + i].value = s[k][i];
  }
  function renderProps() {
    const s = struct && struct.shapes.find((x) => x.id === sel);
    if (!s) {
      propBox.replaceChildren(
        h('div', { class: 'tip' },
          h('b', {}, '💡 이렇게 해 보세요'),
          h('ol', {},
            h('li', {}, '왼쪽에서 모양을 눌러 넣어요'),
            h('li', {}, '모양을 눌러 고르고, 끌어서 옮겨요'),
            h('li', {}, '위쪽 버튼으로 돌리기·크기 바꾸기를 골라요'),
            h('li', {}, '🕳️ 구멍으로 바꾸면 다른 모양에 구멍이 뚫려요'),
            h('li', {}, '다 만들면 아래 버튼으로 블럭을 만들어요'))),
        h('p', { class: 'hint' }, `모양 조각: ${struct ? struct.shapes.length : 0}개`));
      return;
    }
    const sh = SHAPES[s.type] || { name: 'STL 모양', icon: '📦' };
    propBox.replaceChildren(
      h('div', { class: 'prop-title' }, sh.icon + ' ' + sh.name),
      h('div', { class: 'label' }, '색깔'),
      h('div', { class: 'colors' }, COLORS.map((c) => h('button', {
        class: 'color' + (c === s.color && !s.hole ? ' on' : ''), style: { background: c }, title: c,
        onclick: () => { pushUndo(); s.color = c; s.hole = false; rebuild(); commit(); },
      }))),
      h('button', { class: 'btn wide' + (s.hole ? ' on' : ''), onclick: () => { pushUndo(); s.hole = !s.hole; rebuild(); commit(); if (s.hole) toast('🕳️ 구멍이 되었어요. ✨ 완성 모습을 누르면 뚫린 모습을 볼 수 있어요'); } },
        s.hole ? '🕳️ 구멍 (눌러서 원래대로)' : '🕳️ 구멍으로 바꾸기'),
      h('div', { class: 'label' }, '크기 (mm)'),
      h('div', { class: 'nums' }, numInput('size', 0, '가로'), numInput('size', 2, '세로'), numInput('size', 1, '높이')),
      h('div', { class: 'label' }, '위치 (mm)'),
      h('div', { class: 'nums' }, numInput('pos', 0, '←→'), numInput('pos', 2, '앞뒤'), numInput('pos', 1, '위아래')),
      h('div', { class: 'label' }, '돌리기 (도)'),
      h('div', { class: 'nums' }, numInput('rot', 0, '앞으로'), numInput('rot', 1, '빙글'), numInput('rot', 2, '옆으로')),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => { pushUndo(); dropToFloor(s); placeShapeMesh(meshes.get(s.id), s); commit(); updatePropInputs(); } }, '⬇ 바닥에 내리기'),
        h('button', { class: 'btn small', onclick: duplicate }, '📄 복사'),
        h('button', { class: 'btn small danger', onclick: removeSel }, '🗑️')),
    );
    updatePropInputs();
  }

  // ---------- 파일 ----------
  async function loadStl() {
    const f = await pickFile('.stl');
    if (!f) return;
    try {
      ensureStruct();
      const { shape, note, tris } = importStl(app.project, await f.arrayBuffer(), f.name);
      if (tris > 300000) toast('모양이 아주 복잡해서 느릴 수 있어요');
      if (struct.shapes.length) {
        // 새 모양으로 따로 만들어요
        struct = { id: uid('st'), name: P.uniqueName(app.project, f.name.replace(/\.stl$/i, ''), app.project.structures), icon: '📦', shapes: [] };
        app.project.structures.push(struct);
      } else if (struct.name.startsWith('내 모양')) { struct.name = f.name.replace(/\.stl$/i, ''); struct.icon = '📦'; }
      pushUndo();
      struct.shapes.push(shape);
      sel = shape.id;
      rebuild(); refreshList(); commit(); fitView();
      toast('📥 STL 모양을 불러왔어요. ' + note);
    } catch (e) { console.error(e); toast('STL 파일을 읽을 수 없어요'); }
  }
  async function saveStl() {
    if (!struct || !struct.shapes.length) return toast('먼저 모양을 만들어 주세요');
    const data = await exportStl(struct, app.project);
    downloadFile(struct.name + '.stl', data, 'model/stl');
  }

  function goBlock() {
    if (!struct || !struct.shapes.length) return toast('먼저 모양을 만들어 주세요');
    app.screens.blocks.newBlockWithPart(struct.id);
  }
  function goBase() {
    if (!struct || !struct.shapes.length) return toast('먼저 모양을 만들어 주세요');
    app.screens.assemble.newRobotWithBase(struct.id);
  }

  app.on('project', () => { struct = null; sel = null; undo = []; redo = []; });

  return {
    el,
    onShow() {
      ensureStruct();
      refreshList();
      rebuild();
      if (!this._fitted) { fitView(); this._fitted = true; }
    },
    openStruct(id) { app.go('maker'); openStruct(id); },
    addLibAsNew(id) {
      const s = libStructure(id);
      app.project.structures.push(s);
      app.changed('struct', { rebuild: false });
      return s;
    },
  };
}
