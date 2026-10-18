// 🧱 모양 만들기 (팅커캐드처럼: 여러 개 고르기, 복사·붙여넣기, 합치기(그룹), 붙이기, 정렬, 뒤집기)
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { h, uid, clone, toast, ask, prompt, downloadFile, pickFile } from './util.js';
import { Viewer, makeGrid } from './viewer.js';
import {
  SHAPES, COLORS, nodeObject, buildStructure, holeMaterial, isContainer, walkNodes,
  localMatrix, setFromMatrix, fontReady, whenCsgReady,
} from './shapes.js';
import { importStl, exportStl } from './stl.js';
import { LIB, libStructure } from './library.js';
import { P } from './project.js';
import { Resizer } from './resizer.js';

const r1 = (v) => Math.round(v * 10) / 10;
const CLIP_KEY = 'tsim.clipboard';

export function createMaker(app) {
  const el = h('section', { class: 'maker three-col' });
  const v = new Viewer({ grid: 300, background: '#eef5ff' });
  v.scene.add(makeGrid(400, 10));
  const work = new THREE.Group();
  v.scene.add(work);
  const preview = new THREE.Group();
  v.scene.add(preview);
  const pivot = new THREE.Group();
  v.scene.add(pivot);
  const selHelper = new THREE.Box3Helper(new THREE.Box3(), '#f59e0b');
  selHelper.visible = false;
  v.scene.add(selHelper);

  const tc = new TransformControls(v.camera, v.dom);
  tc.setRotationSnap(THREE.MathUtils.degToRad(15));
  tc.setSize(0.9);
  v.scene.add(tc);

  let struct = null;
  let ctxPath = []; // 붙인 묶음 안으로 들어가 고칠 때
  let sel = []; // 고른 노드 id
  const objMap = new Map();
  let undo = [], redo = [];
  let showFinal = false;
  let snap = 1;
  let magnet = true;

  // ---------------- 화면 ----------------
  const left = h('aside', { class: 'side left' });
  const center = h('div', { class: 'center' });
  const right = h('aside', { class: 'side right' });
  el.append(left, center, right);

  left.append(
    h('h3', {}, '기본 모양'),
    h('div', { class: 'shape-grid' }, Object.entries(SHAPES).map(([type, s]) =>
      h('button', { class: 'shape-btn' + (s.hole ? ' hole' : ''), title: s.name + ' 넣기', onclick: () => addShape(type) }, h('span', {}, s.icon), s.name))),
    h('h3', {}, '파일에서 가져오기'),
    h('button', { class: 'btn wide', onclick: loadStl }, '📥 STL 파일 불러오기'),
    h('p', { class: 'hint' }, '팅커캐드에서 "내보내기 → .STL" 로 저장한 모양을 불러와요.'),
    h('h3', {}, '만들어진 모양'),
    h('div', { class: 'lib-grid' }, LIB.map((l) => h('button', { class: 'lib-btn', title: l.name + ' 넣기', onclick: () => addLib(l.id) }, h('span', {}, l.icon), l.name))),
  );

  const viewBox = h('div', { class: 'view' });
  const tb = (label, title, fn, cls = '') => h('button', { class: 'tbtn ' + cls, title, onclick: fn }, label);
  const modeBtns = {};
  const bar1 = h('div', { class: 'toolbar floating maker-bar' });
  for (const [m, label, key] of [['size', '✋ 옮기기·크기', 'W'], ['rotate', '🔄 돌리기', 'E'], ['translate', '↕️ 화살표', 'R']]) {
    modeBtns[m] = tb(label, `${label} (${key})`, () => setMode(m));
    bar1.append(modeBtns[m]);
  }
  const snapSel = h('select', { class: 'input small', title: '격자에 맞추기', onchange: () => { snap = Number(snapSel.value); applySnap(); } },
    [['0', '자유롭게'], ['0.5', '0.5mm'], ['1', '1mm'], ['5', '5mm'], ['10', '10mm']].map(([vv, t]) => h('option', { value: vv, selected: vv === '1' }, '격자 ' + t)));
  const magnetBtn = tb('🧲 표면에 놓기', '끌 때 다른 모양 위에 자동으로 올려놓아요', () => { magnet = !magnet; magnetBtn.classList.toggle('on', magnet); }, 'on');
  bar1.append(h('span', { class: 'sep' }), snapSel, magnetBtn, h('span', { class: 'sep' }),
    tb('↶', '되돌리기 (Ctrl+Z)', doUndo), tb('↷', '다시하기 (Ctrl+Y)', doRedo), h('span', { class: 'sep' }),
    h('button', { class: 'tbtn toggle', id: 'finalBtn', onclick: toggleFinal, title: '구멍이 뚫린 완성 모습 보기' }, '✨ 완성 모습'),
    tb('🎯', '전체 보기', () => fitView()));
  const bar2 = h('div', { class: 'toolbar floating maker-bar2' });
  bar2.append(
    tb('📋 복사', '복사 (Ctrl+C)', copySel), tb('📥 붙여넣기', '붙여넣기 (Ctrl+V)', paste), tb('✂️ 잘라내기', '잘라내기 (Ctrl+X)', cutSel),
    tb('📄 복제', '바로 옆에 하나 더 (Ctrl+D)', duplicate), tb('🗑️', '지우기 (Delete)', removeSel), h('span', { class: 'sep' }),
    tb('🧩 합치기', '고른 모양을 하나로 녹여 합쳐요. 구멍도 뚫려요 (Ctrl+G)', groupSel, 'accent'),
    tb('🔓 풀기', '합친 모양을 다시 나눠요 (Ctrl+Shift+G)', ungroupSel),
    tb('📎 붙이기', '고른 모양들을 모양 그대로 붙여서 함께 움직여요 (Ctrl+B)', linkSel, 'accent2'),
    tb('✂ 떼기', '붙인 묶음을 다시 떼어요 (Ctrl+Shift+B)', ungroupSel));
  const crumb = h('div', { class: 'crumb' });
  const rectDiv = h('div', { class: 'select-rect' });
  center.append(viewBox, bar1, bar2, crumb, rectDiv,
    h('div', { class: 'view-hint' }, '흰 손잡이 끌기 = 크기 바꾸기 · 숫자 두 번 클릭 = 직접 고치기 · 검은 뿔 = 띄우기 · Shift+클릭 = 여러 개 고르기 · Shift+빈 곳 끌기 = 네모로 고르기 · 모양 끌기 = 옮기기 · 붙인 묶음 두 번 클릭 = 안쪽 고치기'));
  v.mount(viewBox);
  let mode = 'size';
  const resizer = new Resizer({
    v, pivot, container: center, getSnap: () => snap,
    onStart: () => pushUndo(),
    onEnd: () => { bake(); rebuild(); commit(); },
  });

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

  // ---------------- 노드 찾기 ----------------
  const ctxNode = () => ctxPath[ctxPath.length - 1] || null;
  const ctxList = () => (ctxNode() ? ctxNode().children : struct ? struct.shapes : []);
  const ctxObject = () => (ctxNode() ? objMap.get(ctxNode().id) : work);
  const nodeById = (id) => ctxList().find((n) => n.id === id);
  const selNodes = () => sel.map(nodeById).filter(Boolean);
  const selObjs = () => sel.map((id) => objMap.get(id)).filter(Boolean);

  // ---------------- 구조물 목록 ----------------
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
    ctxPath = []; sel = [];
    return struct;
  }
  function openStruct(id) {
    const s = P.struct(app.project, id);
    if (!s) return;
    struct = s; ctxPath = []; sel = []; undo = []; redo = [];
    rebuild(); refreshList(); fitView();
  }
  async function newStruct() {
    const n = await prompt('새 모양', '모양 이름을 지어 주세요', P.uniqueName(app.project, '내 모양', app.project.structures));
    if (!n) return;
    struct = { id: uid('st'), name: n, icon: '🧱', shapes: [] };
    app.project.structures.push(struct);
    ctxPath = []; sel = []; undo = []; redo = [];
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
    walkNodes(c.shapes, (s) => { s.id = uid('s'); });
    app.project.structures.push(c);
    struct = c; ctxPath = []; sel = [];
    rebuild(); refreshList(); app.changed('struct', { rebuild: false });
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

  // ---------------- 3D 다시 그리기 ----------------
  function rebuild() {
    tc.detach();
    pivot.clear();
    pivot.position.set(0, 0, 0); pivot.quaternion.identity(); pivot.scale.set(1, 1, 1);
    work.clear(); preview.clear(); objMap.clear();
    if (!struct) return;
    const add = (n, parent, depth) => {
      const o = nodeObject(n, app.project, { editor: true });
      o.userData.nodeId = n.id;
      objMap.set(n.id, o);
      if (n.type === 'link') {
        // 안쪽 조각도 고를 수 있게 기억해요
        o.clear();
        for (const c of n.children) add(c, o, depth + 1);
      }
      parent.add(o);
    };
    for (const n of struct.shapes) add(n, work, 0);
    // 들어간 묶음 바깥은 흐리게
    if (ctxNode()) {
      const inside = new Set();
      walkNodes(ctxNode().children, (n) => inside.add(n.id));
      work.traverse((o) => {
        if (!o.isMesh) return;
        let p = o, isIn = false;
        while (p) { if (p.userData.nodeId && inside.has(p.userData.nodeId)) { isIn = true; break; } p = p.parent; }
        if (!isIn) {
          const ms = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.2; c.depthWrite = false; return c; });
          o.material = Array.isArray(o.material) ? ms : ms[0];
          o.raycast = () => {};
        }
      });
    }
    if (showFinal) {
      work.visible = false;
      preview.add(buildStructure(struct, app.project));
    } else work.visible = true;
    sel = sel.filter((id) => nodeById(id));
    setupPivot();
    renderProps();
    renderCrumb();
  }

  // 고른 모양들을 손잡이 하나로 함께 움직여요
  function setupPivot() {
    tc.detach();
    selHelper.visible = false;
    resizer.setActive(false);
    const objs = selObjs();
    if (!objs.length || showFinal) return;
    work.updateMatrixWorld(true);
    const box = new THREE.Box3();
    objs.forEach((o) => box.expandByObject(o));
    pivot.scale.set(1, 1, 1);
    if (objs.length === 1) {
      objs[0].getWorldPosition(pivot.position);
      objs[0].getWorldQuaternion(pivot.quaternion);
    } else {
      box.getCenter(pivot.position);
      pivot.quaternion.identity();
    }
    pivot.updateMatrixWorld(true);
    for (const o of objs) pivot.attach(o);
    if (mode === 'size') resizer.setActive(true);
    else tc.attach(pivot);
    tc.setSpace(objs.length === 1 ? 'local' : 'world');
    highlight(objs);
  }
  function highlight(objs) {
    for (const o of objs) {
      o.traverse((m) => {
        if (!m.isMesh || m.material === holeMaterial) return;
        const ms = Array.isArray(m.material) ? m.material : [m.material];
        const nm = ms.map((x) => { const c = x.clone(); c.emissive = new THREE.Color(x.color).multiplyScalar(0.28); return c; });
        m.material = Array.isArray(m.material) ? nm : nm[0];
      });
    }
  }
  // 손잡이로 움직인 결과를 저장
  function bake() {
    const parent = ctxObject();
    parent.updateMatrixWorld(true);
    pivot.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    for (const n of selNodes()) {
      const o = objMap.get(n.id);
      if (!o) continue;
      o.updateMatrixWorld(true);
      setFromMatrix(n, inv.clone().multiply(o.matrixWorld));
    }
  }
  function applySnap() {
    tc.setTranslationSnap(snap || null);
    tc.setScaleSnap(snap ? 0.05 : null);
  }
  applySnap();

  function select(ids, add = false) {
    if (add) {
      for (const id of ids) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    } else sel = [...ids];
    rebuild();
  }

  function setMode(m) {
    mode = m;
    if (m !== 'size') tc.setMode(m);
    for (const k in modeBtns) modeBtns[k].classList.toggle('on', k === m);
    if (struct) { bake(); rebuild(); }
  }
  setMode('size');

  // ---------------- 되돌리기 ----------------
  const snapshot = () => JSON.stringify({ shapes: struct.shapes, ctx: ctxPath.map((n) => n.id), sel });
  function pushUndo() {
    if (!struct) return;
    undo.push(snapshot());
    if (undo.length > 80) undo.shift();
    redo = [];
  }
  function restore(snap0) {
    const s = JSON.parse(snap0);
    struct.shapes = s.shapes;
    ctxPath = [];
    for (const id of s.ctx) { const list = ctxList(); const n = list.find((x) => x.id === id); if (n) ctxPath.push(n); else break; }
    sel = s.sel;
  }
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); rebuild(); commit(); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); rebuild(); commit(); }
  function commit() { app.changed('shape'); }

  // ---------------- 넣기 ----------------
  function placeNew(nodes) {
    // 서로 겹치지 않게 조금씩 비켜 놓아요
    const list = ctxList();
    const k = list.length;
    const off = k ? ((k % 6) - 2.5) * 12 : 0;
    for (const n of nodes) { n.pos[0] += off; n.pos[2] += k ? 15 : 0; }
  }
  function addShape(type) {
    ensureStruct();
    if (showFinal) toggleFinal();
    pushUndo();
    const def = SHAPES[type];
    const realType = def.as || type;
    const n = ctxList().length;
    const s = {
      id: uid('s'), type: realType, pos: [0, def.size[1] / 2, 0], size: [...def.size], rot: [0, 0, 0],
      color: COLORS[(n + 5) % COLORS.length], hole: !!def.hole,
    };
    if (def.params && !def.as) s.params = Object.fromEntries(def.params.map((p) => [p.key, p.def]));
    placeNew([s]);
    ctxList().push(s);
    sel = [s.id];
    rebuild(); refreshList(); commit();
    if (struct.shapes.length === 1) v.fit(work, { pad: 2.6 });
  }
  function addLib(id) {
    ensureStruct();
    if (showFinal) toggleFinal();
    pushUndo();
    const l = LIB.find((x) => x.id === id);
    // 만들어진 모양은 "붙인 묶음"으로 넣어서 한 번에 움직여요
    const link = { id: uid('s'), type: 'link', pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1], children: l.make() };
    placeNew([link]);
    ctxList().push(link);
    sel = [link.id];
    rebuild(); refreshList(); commit(); fitView();
    toast(`${l.icon} ${l.name} 모양을 붙인 묶음으로 넣었어요`);
  }

  // ---------------- 편집 ----------------
  function freshIds(nodes) { walkNodes(nodes, (n) => { n.id = uid('s'); }); return nodes; }
  function copySel() {
    const nodes = selNodes();
    if (!nodes.length) return;
    const data = JSON.stringify({ nodes, meshes: Object.fromEntries(collectMeshIds(nodes).map((id) => [id, app.project.meshes[id]])) });
    try { localStorage.setItem(CLIP_KEY, data); } catch (e) { app._clip = data; }
    app._clip = data;
    toast(`📋 ${nodes.length}개를 복사했어요`);
  }
  function collectMeshIds(nodes) { const ids = []; walkNodes(nodes, (n) => { if (n.type === 'stl') ids.push(n.mesh); }); return ids; }
  function paste() {
    ensureStruct();
    let data = null;
    try { data = localStorage.getItem(CLIP_KEY); } catch (e) { /**/ }
    data = data || app._clip;
    if (!data) return toast('먼저 복사할 모양을 골라 📋 복사를 눌러 주세요');
    const { nodes, meshes } = JSON.parse(data);
    for (const [id, m] of Object.entries(meshes || {})) if (m && !app.project.meshes[id]) app.project.meshes[id] = m;
    pushUndo();
    freshIds(nodes);
    for (const n of nodes) { n.pos[0] += 10; n.pos[2] += 10; }
    ctxList().push(...nodes);
    sel = nodes.map((n) => n.id);
    rebuild(); commit();
  }
  function cutSel() { if (!sel.length) return; copySel(); removeSel(); }
  function duplicate() {
    const nodes = selNodes();
    if (!nodes.length) return;
    pushUndo();
    const copies = freshIds(clone(nodes));
    for (const n of copies) { n.pos[0] += 10; n.pos[2] += 10; }
    ctxList().push(...copies);
    sel = copies.map((n) => n.id);
    rebuild(); commit();
  }
  function removeSel() {
    if (!sel.length) return;
    pushUndo();
    const list = ctxList();
    const keep = list.filter((n) => !sel.includes(n.id));
    list.length = 0; list.push(...keep);
    sel = [];
    rebuild(); commit();
  }

  // 고른 것들의 가운데 (지금 고치는 곳의 좌표)
  function selCenterLocal() {
    const box = new THREE.Box3();
    work.updateMatrixWorld(true);
    selObjs().forEach((o) => box.expandByObject(o));
    const c = box.getCenter(new THREE.Vector3());
    ctxObject().worldToLocal(c);
    return c;
  }

  function makeContainer(type) {
    const nodes = selNodes();
    if (nodes.length < 2) return toast(type === 'group' ? '🧩 합칠 모양을 2개 이상 골라 주세요 (Shift+클릭)' : '📎 붙일 모양을 2개 이상 골라 주세요 (Shift+클릭)');
    bake();
    pushUndo();
    const c = selCenterLocal();
    c.set(r1(c.x), r1(c.y), r1(c.z));
    const list = ctxList();
    const idx = Math.min(...nodes.map((n) => list.indexOf(n)));
    const children = nodes.map((n) => { n.pos = [n.pos[0] - c.x, n.pos[1] - c.y, n.pos[2] - c.z].map(r1); return n; });
    const node = { id: uid('s'), type, pos: [c.x, c.y, c.z], rot: [0, 0, 0], scale: [1, 1, 1], children };
    if (type === 'group') {
      const firstSolid = nodes.find((n) => !n.hole);
      node.color = (firstSolid && (firstSolid.color || firstSolid.color)) || '#3b82f6';
      node.multicolor = false;
      node.hole = nodes.every((n) => n.hole);
    }
    const keep = list.filter((n) => !nodes.includes(n));
    keep.splice(idx, 0, node);
    list.length = 0; list.push(...keep);
    sel = [node.id];
    rebuild(); commit();
    toast(type === 'group' ? '🧩 하나의 모양으로 합쳤어요' : '📎 붙였어요. 조각 모양은 그대로이고 함께 움직여요');
  }
  function groupSel() { if (selNodes().length === 1 && selNodes()[0].type === 'link') return convert('group'); makeContainer('group'); }
  function linkSel() { if (selNodes().length === 1 && selNodes()[0].type === 'group') return convert('link'); makeContainer('link'); }
  // 붙인 묶음 ↔ 합친 모양 바꾸기
  function convert(type) {
    const n = selNodes()[0];
    bake(); pushUndo();
    n.type = type;
    if (type === 'group') { const fs = n.children.find((c) => !c.hole); n.color = (fs && fs.color) || '#3b82f6'; n.multicolor = true; n.hole = false; }
    else { delete n.color; delete n.multicolor; delete n.hole; }
    rebuild(); commit();
  }
  function ungroupSel() {
    const nodes = selNodes().filter(isContainer);
    if (!nodes.length) return toast('합친 모양이나 붙인 묶음을 골라 주세요');
    bake();
    pushUndo();
    const list = ctxList();
    const out = [];
    for (const n of list) {
      if (!nodes.includes(n)) { out.push(n); continue; }
      const m = localMatrix(n);
      for (const c of n.children) {
        setFromMatrix(c, m.clone().multiply(localMatrix(c)));
        out.push(c);
      }
    }
    list.length = 0; list.push(...out);
    sel = nodes.flatMap((n) => n.children.map((c) => c.id));
    rebuild(); commit();
    toast('🔓 다시 나눴어요');
  }

  // 세상 좌표에서의 변환 m 을 고른 것들에 적용
  function applyWorld(m) {
    bake();
    const parent = ctxObject();
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    for (const n of selNodes()) {
      const o = objMap.get(n.id);
      o.updateMatrixWorld(true);
      setFromMatrix(n, inv.clone().multiply(m).multiply(o.matrixWorld));
    }
  }
  function selBoxWorld() {
    const box = new THREE.Box3();
    work.updateMatrixWorld(true); pivot.updateMatrixWorld(true);
    selObjs().forEach((o) => box.expandByObject(o));
    return box;
  }
  function align(axis, mode) {
    const objs = selObjs();
    if (objs.length < 2) return toast('정렬할 모양을 2개 이상 골라 주세요');
    bake(); pushUndo();
    const ai = 'xyz'.indexOf(axis);
    const all = selBoxWorld();
    const tgt = mode === 'min' ? all.min.getComponent(ai) : mode === 'max' ? all.max.getComponent(ai) : (all.min.getComponent(ai) + all.max.getComponent(ai)) / 2;
    const parent = ctxObject();
    for (const n of selNodes()) {
      const o = objMap.get(n.id);
      const b = new THREE.Box3().setFromObject(o);
      const cur = mode === 'min' ? b.min.getComponent(ai) : mode === 'max' ? b.max.getComponent(ai) : (b.min.getComponent(ai) + b.max.getComponent(ai)) / 2;
      const wp = o.getWorldPosition(new THREE.Vector3());
      wp.setComponent(ai, wp.getComponent(ai) + tgt - cur);
      parent.worldToLocal(wp);
      n.pos = [wp.x, wp.y, wp.z].map((x) => Math.round(x * 100) / 100);
    }
    rebuild(); commit();
  }
  function mirror(axis) {
    if (!sel.length) return;
    pushUndo();
    const c = selBoxWorld().getCenter(new THREE.Vector3());
    const s = new THREE.Vector3(1, 1, 1).setComponent('xyz'.indexOf(axis), -1);
    const m = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(s.x, s.y, s.z)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    applyWorld(m);
    rebuild(); commit();
  }
  function turn(axis, deg) {
    if (!sel.length) return;
    pushUndo();
    const c = selBoxWorld().getCenter(new THREE.Vector3());
    const ax = new THREE.Vector3().setComponent('xyz'.indexOf(axis), 1);
    const m = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeRotationAxis(ax, THREE.MathUtils.degToRad(deg))).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    applyWorld(m);
    rebuild(); commit();
  }
  function dropToFloor() {
    if (!sel.length) return;
    pushUndo();
    const b = selBoxWorld();
    applyWorld(new THREE.Matrix4().makeTranslation(0, -b.min.y, 0));
    rebuild(); commit();
  }
  // 고른 것 전체의 크기·위치를 숫자로 바꾸기 (바닥 가운데 기준)
  function setBox(newSize, newPos) {
    const b = selBoxWorld();
    const sz = b.getSize(new THREE.Vector3());
    const anchor = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
    const k = new THREE.Vector3(newSize.x / (sz.x || 1), newSize.y / (sz.y || 1), newSize.z / (sz.z || 1));
    const target = newPos || anchor;
    const m = new THREE.Matrix4().makeTranslation(target.x, target.y, target.z)
      .multiply(new THREE.Matrix4().makeScale(k.x, k.y, k.z))
      .multiply(new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z));
    pushUndo();
    applyWorld(m);
    rebuild(); commit();
  }
  function setHole(on) {
    const nodes = selNodes();
    if (!nodes.length) return;
    bake(); pushUndo();
    for (const n of nodes) {
      if (n.type === 'link') walkNodes(n.children, (c) => { if (!isContainer(c)) c.hole = on; });
      else n.hole = on;
    }
    rebuild(); commit();
    if (on) toast('🕳️ 구멍이 되었어요. 다른 모양과 🧩 합치면 구멍이 뚫려요 (✨ 완성 모습에서도 보여요)');
  }
  function setColor(c) {
    const nodes = selNodes();
    bake(); pushUndo();
    for (const n of nodes) {
      if (n.type === 'group') { n.color = c; n.multicolor = false; n.hole = false; }
      else if (n.type === 'link') walkNodes(n.children, (x) => { if (x.type === 'group') { x.color = c; x.multicolor = false; } else if (!isContainer(x)) { x.color = c; x.hole = false; } });
      else { n.color = c; n.hole = false; }
    }
    rebuild(); commit();
  }
  function setType(type) {
    const def = SHAPES[type];
    bake(); pushUndo();
    for (const n of selNodes()) {
      if (isContainer(n) || n.type === 'stl') continue;
      n.type = def.as || type;
      if (def.hole) n.hole = true;
      n.params = def.params && !def.as ? Object.fromEntries(def.params.map((p) => [p.key, p.def])) : undefined;
    }
    rebuild(); commit();
  }

  function toggleFinal() {
    showFinal = !showFinal;
    el.querySelector('#finalBtn').classList.toggle('on', showFinal);
    if (showFinal) whenCsgReady().then(rebuild); else rebuild();
  }
  function fitView() {
    const target = showFinal ? preview : work;
    if (!struct || !struct.shapes.length) { v.camera.position.set(160, 140, 200); v.controls.target.set(0, 10, 0); return; }
    v.fit(target, { pad: 1.6 });
  }

  // 붙인 묶음 안으로 들어가기 / 나오기
  function enter(n) { if (n.type !== 'link') return; bake(); ctxPath.push(n); sel = []; rebuild(); }
  function exitCtx() { if (!ctxPath.length) return; bake(); const n = ctxPath.pop(); sel = [n.id]; rebuild(); }
  function renderCrumb() {
    crumb.replaceChildren();
    crumb.classList.toggle('show', ctxPath.length > 0);
    if (!ctxPath.length) return;
    crumb.append(h('span', {}, '📎 붙인 묶음 안을 고치는 중이에요'), h('button', { class: 'btn tiny', onclick: exitCtx }, '⬅ 밖으로 나가기 (Esc)'));
  }

  // ---------------- 손잡이 ----------------
  tc.addEventListener('dragging-changed', (e) => {
    v.controls.enabled = !e.value;
    if (e.value) pushUndo();
    else { bake(); rebuild(); commit(); }
  });
  tc.addEventListener('objectChange', () => { updateBoxInputs(); });

  // ---------------- 마우스 ----------------
  function pickNode(e) {
    const hits = v.hits(e, [work, pivot]);
    const ids = new Set(ctxList().map((n) => n.id));
    for (const hit of hits) {
      let o = hit.object;
      while (o && !(o.userData.nodeId && ids.has(o.userData.nodeId))) o = o.parent;
      if (o) return { id: o.userData.nodeId, hit };
    }
    return null;
  }
  let drag = null;
  let rect = null;
  let down = null;
  v.dom.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || showFinal || !struct) return;
    if (resizer.pointerDown(e)) { down = null; return; } // 크기 손잡이
    if (tc.axis) return; // 손잡이 잡음
    const pk = pickNode(e);
    down = { x: e.clientX, y: e.clientY, pk };
    if (!pk) {
      if (e.shiftKey) {
        v.controls.enabled = false;
        const r = v.dom.getBoundingClientRect();
        rect = { x0: e.clientX - r.left, y0: e.clientY - r.top, r };
        Object.assign(rectDiv.style, { display: 'block', left: rect.x0 + 'px', top: rect.y0 + 'px', width: '0px', height: '0px' });
        v.dom.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) { select([pk.id], true); down = null; return; }
    if (!sel.includes(pk.id)) select([pk.id]);
    // 고른 것들 끌기 시작
    const start = pk.hit.point.clone();
    const box = selBoxWorld();
    drag = { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -start.y), start, pos0: pivot.position.clone(), bottomOff: box.min.y - pivot.position.y, moved: false };
    v.controls.enabled = false;
    v.dom.setPointerCapture(e.pointerId);
  });
  v.dom.addEventListener('pointermove', (e) => {
    if (rect) {
      const x = e.clientX - rect.r.left, y = e.clientY - rect.r.top;
      Object.assign(rectDiv.style, { left: Math.min(x, rect.x0) + 'px', top: Math.min(y, rect.y0) + 'px', width: Math.abs(x - rect.x0) + 'px', height: Math.abs(y - rect.y0) + 'px' });
      rect.x1 = x; rect.y1 = y;
      return;
    }
    if (!drag) return;
    v.setPointer(e);
    const pt = new THREE.Vector3();
    if (!v.raycaster.ray.intersectPlane(drag.plane, pt)) return;
    let dx = pt.x - drag.start.x, dz = pt.z - drag.start.z;
    if (snap) { dx = Math.round(dx / snap) * snap; dz = Math.round(dz / snap) * snap; }
    if (!drag.moved && Math.hypot(dx, dz) < 0.5) return;
    if (!drag.moved) { drag.moved = true; pushUndo(); }
    pivot.position.x = drag.pos0.x + dx;
    pivot.position.z = drag.pos0.z + dz;
    if (magnet) {
      // 아래에 있는 다른 모양 위에 올려놓기
      pivot.updateMatrixWorld(true);
      const box = selBoxWorld();
      const others = [];
      work.traverse((o) => { if (o.isMesh && o.visible && o.material !== holeMaterial && !o.material.transparent) others.push(o); });
      let top = 0;
      const rc = new THREE.Raycaster();
      const pts = [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.max.z], [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2]];
      for (const [x, z] of pts) {
        rc.set(new THREE.Vector3(x, 5000, z), new THREE.Vector3(0, -1, 0));
        const hit = rc.intersectObjects(others, false)[0];
        if (hit) top = Math.max(top, hit.point.y);
      }
      pivot.position.y = top - drag.bottomOff;
    }
    updateBoxInputs();
  });
  v.dom.addEventListener('pointerup', (e) => {
    if (rect) {
      rectDiv.style.display = 'none';
      v.controls.enabled = true;
      if (rect.x1 !== undefined) {
        const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1), y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
        const ids = [];
        for (const n of ctxList()) {
          const o = objMap.get(n.id);
          const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(v.camera);
          const sx = (c.x + 1) / 2 * rect.r.width, sy = (1 - c.y) / 2 * rect.r.height;
          if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) ids.push(n.id);
        }
        select(ids, e.ctrlKey);
      }
      rect = null; down = null;
      return;
    }
    if (drag) {
      v.controls.enabled = true;
      if (drag.moved) { bake(); rebuild(); commit(); }
      drag = null; down = null;
      return;
    }
    if (down && !down.pk && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4 && !tc.dragging) select([]);
    down = null;
  });
  v.dom.addEventListener('dblclick', (e) => {
    const pk = pickNode(e);
    if (pk) { const n = nodeById(pk.id); if (n && n.type === 'link') { enter(n); const inner = pickNode(e); if (inner) select([inner.id]); } }
    else exitCtx();
  });

  window.addEventListener('keydown', (e) => {
    if (app.current !== 'maker' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || document.querySelector('.modal-back')) return;
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    let done = true;
    if (k === 'delete' || k === 'backspace') removeSel();
    else if (ctrl && k === 'z') doUndo();
    else if (ctrl && k === 'y') doRedo();
    else if (ctrl && k === 'c') copySel();
    else if (ctrl && k === 'v') paste();
    else if (ctrl && k === 'x') cutSel();
    else if (ctrl && k === 'd') duplicate();
    else if (ctrl && k === 'a') select(ctxList().map((n) => n.id));
    else if (ctrl && k === 'g') (e.shiftKey ? ungroupSel() : groupSel());
    else if (ctrl && k === 'b') (e.shiftKey ? ungroupSel() : linkSel());
    else if (k === 'escape') { if (sel.length) select([]); else exitCtx(); }
    else if (!ctrl && k === 'w') setMode('size');
    else if (!ctrl && k === 'e') setMode('rotate');
    else if (!ctrl && k === 'r') setMode('translate');
    else if (!ctrl && k === 'd') dropToFloor();
    else if (!ctrl && k === 'h') setHole(true);
    else if (!ctrl && k === 's') setHole(false);
    else if (k.startsWith('arrow') && sel.length) {
      const step = e.shiftKey ? 10 : (snap || 1);
      const d = { arrowleft: [-step, 0, 0], arrowright: [step, 0, 0], arrowup: ctrl ? [0, step, 0] : [0, 0, -step], arrowdown: ctrl ? [0, -step, 0] : [0, 0, step] }[k];
      pushUndo(); applyWorld(new THREE.Matrix4().makeTranslation(...d)); rebuild(); commit();
    } else done = false;
    if (done) e.preventDefault();
  });

  // ---------------- 오른쪽 설정 ----------------
  const boxInputs = {};
  function updateBoxInputs() {
    if (!boxInputs.sx) return;
    const b = selBoxWorld();
    if (b.isEmpty()) return;
    const sz = b.getSize(new THREE.Vector3());
    const vals = { sx: sz.x, sz: sz.z, sy: sz.y, px: (b.min.x + b.max.x) / 2, pz: (b.min.z + b.max.z) / 2, py: b.min.y };
    for (const [k, inp] of Object.entries(boxInputs)) if (document.activeElement !== inp) inp.value = r1(vals[k]);
  }
  function boxFields() {
    const mk = (key, label) => {
      const inp = h('input', { type: 'number', class: 'num', step: 1 });
      boxInputs[key] = inp;
      inp.addEventListener('change', () => {
        const g = (k) => Number(boxInputs[k].value) || 0;
        setBox({ x: Math.max(0.5, g('sx')), y: Math.max(0.5, g('sy')), z: Math.max(0.5, g('sz')) }, new THREE.Vector3(g('px'), g('py'), g('pz')));
      });
      return h('label', { class: 'numl' }, h('span', {}, label), inp);
    };
    for (const k in boxInputs) delete boxInputs[k];
    return [
      h('div', { class: 'label' }, '크기 (mm) — 전체'),
      h('div', { class: 'nums' }, mk('sx', '가로'), mk('sz', '세로'), mk('sy', '높이')),
      h('div', { class: 'label' }, '위치 (mm) — 바닥 가운데'),
      h('div', { class: 'nums' }, mk('px', '←→'), mk('pz', '앞뒤'), mk('py', '위아래')),
    ];
  }
  function numInput(n, key, idx, label) {
    const inp = h('input', { type: 'number', class: 'num', step: key === 'rot' ? 15 : 1, value: r1(key === 'size' ? Math.abs(n[key][idx]) : n[key][idx]) });
    inp.addEventListener('change', () => {
      bake(); pushUndo();
      let val = Number(inp.value) || 0;
      if (key === 'size') val = Math.max(0.5, val) * Math.sign(n.size[idx] || 1);
      n[key][idx] = val;
      rebuild(); commit();
    });
    return h('label', { class: 'numl' }, h('span', {}, label), inp);
  }
  function colorRow(cur) {
    return h('div', { class: 'colors' }, COLORS.map((c) => h('button', { class: 'color' + (c === cur ? ' on' : ''), style: { background: c }, title: c, onclick: () => setColor(c) })));
  }
  function holeRow(isHole) {
    return h('div', { class: 'row two' },
      h('button', { class: 'btn small' + (!isHole ? ' on' : ''), onclick: () => setHole(false), title: 'S' }, '🧱 단단한 모양'),
      h('button', { class: 'btn small' + (isHole ? ' on' : ''), onclick: () => setHole(true), title: 'H' }, '🕳️ 구멍'));
  }
  function typeSelect(cur) {
    return h('select', { class: 'input', onchange: (e) => setType(e.target.value) },
      h('option', { value: '' }, '🔁 다른 모양으로 바꾸기…'),
      Object.entries(SHAPES).filter(([, d]) => !d.as).map(([k, d]) => h('option', { value: k, selected: k === cur }, d.icon + ' ' + d.name)));
  }
  function arrangeBox(multi) {
    const ab = (axis, mode, label, title) => h('button', { class: 'btn tiny', title, onclick: () => align(axis, mode) }, label);
    return h('details', { class: 'arrange', open: multi },
      h('summary', {}, '📐 정렬 · 뒤집기 · 돌리기'),
      multi ? h('div', { class: 'align-grid' },
        h('span', {}, '←→'), ab('x', 'min', '왼쪽', '왼쪽 끝 맞추기'), ab('x', 'center', '가운데', '가운데 맞추기'), ab('x', 'max', '오른쪽', '오른쪽 끝 맞추기'),
        h('span', {}, '앞뒤'), ab('z', 'min', '뒤', '뒤쪽 끝 맞추기'), ab('z', 'center', '가운데', '가운데 맞추기'), ab('z', 'max', '앞', '앞쪽 끝 맞추기'),
        h('span', {}, '위아래'), ab('y', 'min', '아래', '바닥 맞추기'), ab('y', 'center', '가운데', '가운데 맞추기'), ab('y', 'max', '위', '윗면 맞추기')) : h('p', { class: 'hint' }, '정렬은 2개 이상 고르면 쓸 수 있어요.'),
      h('div', { class: 'row' }, h('span', { class: 'label inline' }, '뒤집기'),
        h('button', { class: 'btn tiny', onclick: () => mirror('x') }, '↔ 좌우'), h('button', { class: 'btn tiny', onclick: () => mirror('z') }, '⇅ 앞뒤'), h('button', { class: 'btn tiny', onclick: () => mirror('y') }, '↕ 위아래')),
      h('div', { class: 'row' }, h('span', { class: 'label inline' }, '90° 돌리기'),
        h('button', { class: 'btn tiny', onclick: () => turn('y', 90) }, '빙글'), h('button', { class: 'btn tiny', onclick: () => turn('x', 90) }, '앞으로'), h('button', { class: 'btn tiny', onclick: () => turn('z', 90) }, '옆으로')));
  }
  function actionsRow() {
    return h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: dropToFloor, title: 'D' }, '⬇ 바닥에 내리기'),
      h('button', { class: 'btn small', onclick: duplicate }, '📄 복제'),
      h('button', { class: 'btn small danger', onclick: removeSel }, '🗑️'));
  }

  function renderProps() {
    const nodes = selNodes();
    if (!struct) { propBox.replaceChildren(); return; }
    if (!nodes.length) {
      propBox.replaceChildren(
        h('div', { class: 'tip' },
          h('b', {}, '💡 이렇게 해 보세요'),
          h('ol', {},
            h('li', {}, '왼쪽에서 모양을 눌러 넣어요'),
            h('li', {}, 'Shift+클릭으로 여러 개를 함께 골라요'),
            h('li', {}, '🧩 합치기: 하나의 모양으로 녹여 합쳐요. 구멍 모양을 함께 합치면 구멍이 뚫려요'),
            h('li', {}, '📎 붙이기: 조각들의 색과 모양은 그대로 두고 함께 움직이게 붙여요. 두 번 클릭하면 안의 조각을 고칠 수 있어요'),
            h('li', {}, 'Ctrl+C / Ctrl+V 로 복사·붙여넣기 (다른 모양에도 붙여넣을 수 있어요)'))),
        h('p', { class: 'hint' }, `모양 조각: ${countAll()}개`));
      return;
    }
    const parts = [];
    if (nodes.length === 1 && !isContainer(nodes[0])) {
      const n = nodes[0];
      const d = SHAPES[n.type] || { name: 'STL 모양', icon: '📦' };
      parts.push(h('div', { class: 'prop-title' }, d.icon + ' ' + d.name + (n.hole ? ' (구멍)' : '')));
      if (n.type !== 'stl') parts.push(typeSelect(n.type));
      for (const pdef of d.params || []) {
        const inp = pdef.type === 'text'
          ? h('input', { class: 'input', value: (n.params || {})[pdef.key] ?? pdef.def, maxlength: 24 })
          : h('input', { type: 'number', class: 'num', min: pdef.min, max: pdef.max, step: pdef.step, value: (n.params || {})[pdef.key] ?? pdef.def });
        inp.addEventListener('change', () => {
          bake(); pushUndo();
          n.params = { ...(n.params || {}) };
          n.params[pdef.key] = pdef.type === 'text' ? inp.value : Math.min(pdef.max, Math.max(pdef.min, Number(inp.value) || pdef.def));
          rebuild(); commit();
        });
        parts.push(h('label', { class: 'numl wide' }, h('span', {}, pdef.label), inp));
      }
      parts.push(h('div', { class: 'label' }, '색깔'), colorRow(n.hole ? null : n.color), holeRow(n.hole));
      parts.push(h('div', { class: 'label' }, '크기 (mm)'), h('div', { class: 'nums' }, numInput(n, 'size', 0, '가로'), numInput(n, 'size', 2, '세로'), numInput(n, 'size', 1, '높이')));
      parts.push(h('div', { class: 'label' }, '위치 (mm, 가운데)'), h('div', { class: 'nums' }, numInput(n, 'pos', 0, '←→'), numInput(n, 'pos', 2, '앞뒤'), numInput(n, 'pos', 1, '위아래')));
      parts.push(h('div', { class: 'label' }, '돌리기 (도)'), h('div', { class: 'nums' }, numInput(n, 'rot', 0, '앞으로'), numInput(n, 'rot', 1, '빙글'), numInput(n, 'rot', 2, '옆으로')));
      parts.push(actionsRow(), arrangeBox(false));
    } else if (nodes.length === 1 && nodes[0].type === 'group') {
      const n = nodes[0];
      parts.push(h('div', { class: 'prop-title' }, '🧩 합친 모양 ' + (n.hole ? '(구멍)' : '')), h('p', { class: 'hint' }, `조각 ${n.children.length}개가 하나로 합쳐졌어요. 🔓 합치기 풀기로 다시 나눌 수 있어요.`));
      parts.push(h('div', { class: 'label' }, '색깔'), colorRow(n.multicolor || n.hole ? null : n.color),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!n.multicolor, onchange: (e) => { bake(); pushUndo(); n.multicolor = e.target.checked; rebuild(); commit(); } }), ' 🎨 조각마다 원래 색 쓰기'),
        holeRow(n.hole));
      parts.push(...boxFields(), actionsRow(),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: ungroupSel }, '🔓 합치기 풀기'), h('button', { class: 'btn small', onclick: () => convert('link') }, '📎 붙인 묶음으로 바꾸기')),
        arrangeBox(false));
    } else if (nodes.length === 1 && nodes[0].type === 'link') {
      const n = nodes[0];
      parts.push(h('div', { class: 'prop-title' }, '📎 붙인 묶음'), h('p', { class: 'hint' }, `조각 ${n.children.length}개가 붙어 있어요. 조각 모양과 색은 그대로예요. 두 번 클릭하면 안쪽 조각을 하나씩 고칠 수 있어요.`));
      parts.push(h('div', { class: 'label' }, '모든 조각 색 바꾸기'), colorRow(null), holeRow(false));
      parts.push(...boxFields(), actionsRow(),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => enter(n) }, '✏️ 안쪽 고치기'), h('button', { class: 'btn small', onclick: ungroupSel }, '✂ 떼어내기'), h('button', { class: 'btn small', onclick: () => convert('group') }, '🧩 하나로 합치기')),
        arrangeBox(false));
    } else {
      const prims = nodes.filter((n) => !isContainer(n));
      parts.push(h('div', { class: 'prop-title' }, `✅ ${nodes.length}개 골랐어요`),
        h('div', { class: 'row two' }, h('button', { class: 'btn small accent', onclick: groupSel }, '🧩 합치기'), h('button', { class: 'btn small accent2', onclick: linkSel }, '📎 붙이기')),
        h('div', { class: 'label' }, '색깔 (모두)'), colorRow(null), holeRow(nodes.every((n) => n.hole)));
      if (prims.length) parts.push(h('div', { class: 'label' }, `모양 바꾸기 (기본 모양 ${prims.length}개)`), typeSelect(''));
      parts.push(...boxFields(), actionsRow(), arrangeBox(true));
    }
    propBox.replaceChildren(...parts);
    updateBoxInputs();
  }
  function countAll() { let c = 0; walkNodes(struct ? struct.shapes : [], (n) => { if (!isContainer(n)) c++; }); return c; }

  // ---------------- 파일 ----------------
  async function loadStl() {
    const f = await pickFile('.stl');
    if (!f) return;
    try {
      ensureStruct();
      const { shape, note, tris } = importStl(app.project, await f.arrayBuffer(), f.name);
      if (tris > 300000) toast('모양이 아주 복잡해서 느릴 수 있어요');
      if (struct.shapes.length) {
        struct = { id: uid('st'), name: P.uniqueName(app.project, f.name.replace(/\.stl$/i, ''), app.project.structures), icon: '📦', shapes: [] };
        app.project.structures.push(struct);
        ctxPath = [];
      } else if (struct.name.startsWith('내 모양')) { struct.name = f.name.replace(/\.stl$/i, ''); struct.icon = '📦'; }
      pushUndo();
      struct.shapes.push(shape);
      sel = [shape.id];
      rebuild(); refreshList(); commit(); fitView();
      toast('📥 STL 모양을 불러왔어요. ' + note);
    } catch (e) { console.error(e); toast('STL 파일을 읽을 수 없어요'); }
  }
  async function saveStl() {
    if (!struct || !struct.shapes.length) return toast('먼저 모양을 만들어 주세요');
    bake();
    const data = await exportStl(struct, app.project);
    downloadFile(struct.name + '.stl', data, 'model/stl');
  }
  function goBlock() {
    if (!struct || !struct.shapes.length) return toast('먼저 모양을 만들어 주세요');
    bake();
    app.screens.blocks.newBlockWithPart(struct.id);
  }
  function goBase() {
    if (!struct || !struct.shapes.length) return toast('먼저 모양을 만들어 주세요');
    bake();
    app.screens.assemble.newRobotWithBase(struct.id);
  }

  app.on('project', () => { struct = null; ctxPath = []; sel = []; undo = []; redo = []; });
  fontReady.then(() => { if (app.current === 'maker') rebuild(); });
  whenCsgReady().then(() => { if (app.current === 'maker') rebuild(); });

  return {
    el,
    onShow() {
      ensureStruct();
      refreshList();
      rebuild();
      if (!this._fitted) { fitView(); this._fitted = true; }
    },
    onHide() { if (struct) bake(); },
    openStruct(id) { app.go('maker'); openStruct(id); },
    select(ids) { select(ids); },
    get struct() { return struct; },
    viewer: v,
    resizer,
    api: { groupSel, linkSel, ungroupSel, copySel, paste, duplicate, align, mirror, select, enter, exitCtx, toggleFinal, setType, setHole, setColor, setBox },
    addLibAsNew(id) {
      const s = libStructure(id);
      app.project.structures.push(s);
      app.changed('struct', { rebuild: false });
      return s;
    },
  };
}
