// 기본 모양과 구조물(모양 묶음)을 3D로 만드는 곳
// 구조물의 모양 목록은 "나무" 구조예요:
//   - 기본 모양: { id, type:'box'…, pos, rot, size, color, hole, params }
//   - 그룹(합치기): { id, type:'group', pos, rot, scale, color, multicolor, hole, children:[…] }  → 하나의 모양으로 녹여 합쳐요(구멍도 뚫려요)
//   - 붙이기:      { id, type:'link',  pos, rot, scale, children:[…] }                           → 조각은 그대로, 함께 움직여요
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { b64ToF32 } from './util.js';

const P = (key, label, min, max, def, step = 1) => ({ key, label, min, max, def, step });
export const SHAPES = {
  box: { name: '상자', icon: '🟥', size: [20, 20, 20] },
  cylinder: { name: '원기둥', icon: '🥫', size: [20, 20, 20], params: [P('sides', '옆면 수', 3, 64, 48)] },
  sphere: { name: '공', icon: '⚽', size: [20, 20, 20] },
  roof: { name: '지붕', icon: '🏠', size: [20, 20, 20] },
  cone: { name: '원뿔', icon: '🍦', size: [20, 20, 20], params: [P('sides', '옆면 수', 3, 64, 48)] },
  roundroof: { name: '둥근 지붕', icon: '⛺', size: [20, 10, 20] },
  text: { name: '글자', icon: '🔤', size: [60, 6, 20], params: [{ key: 'text', label: '글자(영어·숫자)', type: 'text', def: 'TEXT' }] },
  torus: { name: '고리', icon: '🍩', size: [30, 8, 30], params: [P('thick', '두께', 5, 45, 30)] },
  tube: { name: '파이프', icon: '⭕', size: [20, 20, 20], params: [P('wall', '벽 두께(%)', 5, 45, 18)] },
  wedge: { name: '쐐기', icon: '📐', size: [20, 20, 20] },
  pyramid: { name: '피라미드', icon: '🔺', size: [20, 20, 20] },
  halfsphere: { name: '반구', icon: '🥣', size: [20, 10, 20] },
  polygon: { name: '다각형', icon: '⬢', size: [20, 20, 20], params: [P('sides', '변의 수', 3, 12, 6)] },
  paraboloid: { name: '포물면', icon: '🔔', size: [20, 20, 20] },
  star: { name: '별', icon: '⭐', size: [30, 6, 30], params: [P('points', '뾰족한 수', 3, 12, 5)] },
  heart: { name: '하트', icon: '❤️', size: [30, 6, 30] },
  ico: { name: '20면체', icon: '💎', size: [20, 20, 20] },
  boxhole: { name: '상자 구멍', icon: '⬜', size: [20, 20, 20], as: 'box', hole: true },
  cylhole: { name: '원기둥 구멍', icon: '⚪', size: [20, 20, 20], as: 'cylinder', hole: true },
};

export const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#9ca3af', '#4b5563', '#1f2937', '#a16207'];

export const isContainer = (n) => n && (n.type === 'group' || n.type === 'link');
export function walkNodes(list, fn) { for (const n of list || []) { fn(n); if (isContainer(n)) walkNodes(n.children, fn); } }

// ---------------- 글꼴 (글자 모양) ----------------
let FONT = null;
export const fontReady = new Promise((res) => {
  new FontLoader().load('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
    (f) => { FONT = f; unitCache.forEach((_, k) => { if (k.startsWith('text')) unitCache.delete(k); }); res(true); }, undefined, () => res(false));
});

// ---------------- 크기 1짜리 모양 ----------------
const unitCache = new Map();

function normalize(g) {
  g.computeBoundingBox();
  const b = g.boundingBox;
  const c = b.getCenter(new THREE.Vector3());
  const s = b.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  g.scale(1 / (s.x || 1), 1 / (s.y || 1), 1 / (s.z || 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
function extrudeFlat(shape, curve = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: curve });
  g.rotateX(-Math.PI / 2);
  return g;
}
const pv = (s, k) => {
  const p = (s.params || {})[k];
  if (p !== undefined && p !== null && p !== '') return p;
  const d = (SHAPES[s.type]?.params || []).find((x) => x.key === k);
  return d ? d.def : undefined;
};

function makeUnit(s) {
  const type = s.type;
  let g;
  switch (type) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, pv(s, 'sides')); break;
    case 'polygon': g = new THREE.CylinderGeometry(0.5, 0.5, 1, pv(s, 'sides')); break;
    case 'sphere': g = new THREE.SphereGeometry(0.5, 40, 24); break;
    case 'halfsphere': {
      const top = new THREE.SphereGeometry(0.5, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.CircleGeometry(0.5, 40);
      cap.rotateX(Math.PI / 2);
      g = mergeGeometries([top, cap]);
      break;
    }
    case 'paraboloid': {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const r = (i / 16) * 0.5; pts.push(new THREE.Vector2(r, 1 - (r / 0.5) ** 2)); }
      const side = new THREE.LatheGeometry(pts.reverse(), 40);
      const cap = new THREE.CircleGeometry(0.5, 40);
      cap.rotateX(Math.PI / 2);
      side.deleteAttribute('uv'); cap.deleteAttribute('uv');
      g = mergeGeometries([side, cap]);
      break;
    }
    case 'cone': g = new THREE.CylinderGeometry(0, 0.5, 1, pv(s, 'sides')); break;
    case 'pyramid': g = new THREE.CylinderGeometry(0, 0.7071, 1, 4, 1); g.rotateY(Math.PI / 4); break;
    case 'wedge': {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(1, 0); sh.lineTo(0, 1); sh.closePath();
      g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
      break;
    }
    case 'roof': {
      const sh = new THREE.Shape();
      sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath();
      g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
      break;
    }
    case 'roundroof': {
      const sh = new THREE.Shape();
      sh.moveTo(0.5, 0);
      sh.absarc(0, 0, 0.5, 0, Math.PI, false);
      sh.closePath();
      g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 32 });
      break;
    }
    case 'torus': { const t = pv(s, 'thick') / 100; g = new THREE.TorusGeometry(0.5 - t / 2, t / 2 + 0.0001, 20, 56); g.rotateX(Math.PI / 2); break; }
    case 'tube': {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.5 - pv(s, 'wall') / 100, 0, Math.PI * 2, true);
      sh.holes.push(hole);
      g = extrudeFlat(sh, 40);
      break;
    }
    case 'star': {
      const sh = new THREE.Shape();
      const n = pv(s, 'points');
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? 0.22 : 0.5;
        const a = Math.PI / 2 + (i * Math.PI) / n;
        if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      sh.closePath();
      g = extrudeFlat(sh);
      break;
    }
    case 'heart': {
      const sh = new THREE.Shape();
      sh.moveTo(0, -0.5);
      sh.bezierCurveTo(-0.15, -0.35, -0.5, -0.15, -0.5, 0.12);
      sh.bezierCurveTo(-0.5, 0.38, -0.25, 0.5, -0.12, 0.5);
      sh.bezierCurveTo(-0.04, 0.5, 0, 0.42, 0, 0.36);
      sh.bezierCurveTo(0, 0.42, 0.04, 0.5, 0.12, 0.5);
      sh.bezierCurveTo(0.25, 0.5, 0.5, 0.38, 0.5, 0.12);
      sh.bezierCurveTo(0.5, -0.15, 0.15, -0.35, 0, -0.5);
      g = extrudeFlat(sh);
      break;
    }
    case 'ico': g = new THREE.IcosahedronGeometry(0.5, 0); break;
    case 'text': {
      const t = String(pv(s, 'text') || 'A').replace(/[^\x20-\x7e]/g, '?').trim() || 'A';
      if (!FONT) { g = new THREE.BoxGeometry(1, 1, 1); break; }
      g = new TextGeometry(t, { font: FONT, size: 1, height: 0.3, curveSegments: 6, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      break;
    }
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  return normalize(g);
}

function makeStlUnit(project, meshId) {
  const data = project.meshes && project.meshes[meshId];
  if (!data) return makeUnit({ type: 'box' });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b64ToF32(data.pos), 3));
  g.computeVertexNormals();
  return normalize(g);
}

export function unitGeometry(s, project) {
  const key = s.type === 'stl' ? 'stl:' + s.mesh : s.type + JSON.stringify(s.params || {});
  let g = unitCache.get(key);
  if (!g) {
    g = s.type === 'stl' ? makeStlUnit(project, s.mesh) : makeUnit(s);
    unitCache.set(key, g);
  }
  return g;
}
export function forgetMesh(meshId) { unitCache.delete('stl:' + meshId); }

// ---------------- 재료(색) ----------------
const matCache = new Map();
export function material(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, side: THREE.FrontSide, ...opts });
    matCache.set(key, m);
  }
  return m;
}
export const holeMaterial = new THREE.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 });

// ---------------- 위치·회전·크기 ----------------
const D2R = THREE.MathUtils.degToRad;
export function localMatrix(n) {
  const s = isContainer(n) ? (n.scale || [1, 1, 1]) : n.size;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...n.pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...n.rot.map(D2R))),
    new THREE.Vector3(...s.map((v) => (Math.abs(v) < 0.01 ? 0.01 : v))),
  );
}
export function placeObject(o, n) {
  o.position.set(...n.pos);
  o.rotation.set(...n.rot.map(D2R));
  const s = isContainer(n) ? (n.scale || [1, 1, 1]) : n.size;
  o.scale.set(...s.map((v) => (Math.abs(v) < 0.01 ? 0.01 : v)));
}
// 행렬 → 노드 정보
const r2 = (v) => Math.round(v * 100) / 100;
export function setFromMatrix(n, m) {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  m.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q);
  n.pos = [p.x, p.y, p.z].map(r2);
  n.rot = [e.x, e.y, e.z].map((a) => r2(THREE.MathUtils.radToDeg(a)));
  if (isContainer(n)) n.scale = [s.x, s.y, s.z].map((v) => Math.round(v * 1000) / 1000);
  else n.size = [s.x, s.y, s.z].map(r2);
}

// ---------------- 구멍 뚫기 / 합치기 (CSG) ----------------
let CSG = null;
const csgReady = import('three-bvh-csg').then((m) => { CSG = m; }).catch((e) => console.warn('구멍 기능을 불러오지 못했어요', e));
export const whenCsgReady = () => csgReady;
export const hasCsg = () => !!CSG;
const groupCache = new Map();

// 모양 하나를 (행렬 m을 적용한) 붓으로
function bakedBrush(geo, m, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  g.setAttribute('normal', (geo.attributes.normal || geo.attributes.position).clone());
  if (geo.index) g.setIndex(geo.index.clone());
  else { const n = g.attributes.position.count; const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(idx); }
  g.applyMatrix4(m);
  if (m.determinant() < 0) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.index.needsUpdate = true;
  }
  g.clearGroups();
  if (Array.isArray(mat) && geo.groups && geo.groups.length) for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  const b = new CSG.Brush(g, mat);
  b.updateMatrixWorld(true);
  return b;
}

// 노드들을 모아서 (단단한 것, 구멍) 붓 목록 만들기. 붙이기(link)는 펼쳐요.
function collect(nodes, parentM, project, colorOverride, out) {
  for (const n of nodes) {
    const m = parentM.clone().multiply(localMatrix(n));
    if (n.type === 'link') { collect(n.children, m, project, colorOverride, out); continue; }
    if (n.type === 'group') {
      const r = groupResult(n, project);
      if (!r) continue;
      let mat = r.material;
      if (colorOverride && !n.hole) mat = material(colorOverride);
      out.push({ brush: bakedBrush(r.geometry, m, mat), hole: !!n.hole });
      continue;
    }
    out.push({ brush: bakedBrush(unitGeometry(n, project), m, material(colorOverride || n.color || '#3b82f6')), hole: !!n.hole });
  }
}

function evaluate(items) {
  const ev = new CSG.Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = true;
  const solids = items.filter((x) => !x.hole);
  const holes = items.filter((x) => x.hole);
  if (!solids.length) return null;
  let r = solids[0].brush;
  for (let i = 1; i < solids.length; i++) r = ev.evaluate(r, solids[i].brush, CSG.ADDITION);
  for (const ho of holes) r = ev.evaluate(r, ho.brush, CSG.SUBTRACTION);
  if (r === solids[0].brush && !Array.isArray(r.material)) {
    // 하나뿐이면 여러 색 형식으로 맞춰 줘요
    r.geometry.clearGroups();
    r.geometry.addGroup(0, r.geometry.index ? r.geometry.index.count : r.geometry.attributes.position.count, 0);
    return { geometry: r.geometry, material: [r.material] };
  }
  return { geometry: r.geometry, material: r.material };
}

// 그룹의 합쳐진 모양 (그룹 자신의 좌표에서)
export function groupResult(n, project) {
  if (!CSG) return null;
  const key = JSON.stringify([n.children, n.multicolor ? null : n.color]);
  if (groupCache.has(key)) return groupCache.get(key);
  let res = null;
  try {
    const items = [];
    collect(n.children, new THREE.Matrix4(), project, n.multicolor ? null : n.color, items);
    res = evaluate(items);
  } catch (e) { console.warn('합치기 실패', e); }
  groupCache.set(key, res);
  return res;
}

// ---------------- 3D 물체 만들기 ----------------
// editor: 편집 화면용(구멍은 반투명으로 보여요)
export function nodeObject(n, project, { editor = false, showHoles = false } = {}) {
  if (n.type === 'group') {
    const o = new THREE.Group();
    placeObject(o, n);
    const r = groupResult(n, project);
    if (r) {
      const mesh = new THREE.Mesh(r.geometry, n.hole ? holeMaterial : r.material);
      mesh.castShadow = !n.hole; mesh.receiveShadow = true;
      if (n.hole && !editor && !showHoles) mesh.visible = false;
      o.add(mesh);
    } else {
      for (const c of n.children) o.add(nodeObject(c, project, { editor, showHoles }));
    }
    return o;
  }
  if (n.type === 'link') {
    const o = new THREE.Group();
    placeObject(o, n);
    for (const c of n.children) {
      const co = nodeObject(c, project, { editor, showHoles });
      co.userData.childId = c.id;
      o.add(co);
    }
    return o;
  }
  const mesh = new THREE.Mesh(unitGeometry(n, project), n.hole ? holeMaterial : material(n.color || '#3b82f6'));
  placeObject(mesh, n);
  mesh.castShadow = !n.hole;
  mesh.receiveShadow = true;
  if (n.hole && !editor && !showHoles) mesh.visible = false;
  return mesh;
}
// 예전 이름도 그대로 쓸 수 있게
export const shapeMesh = (s, project) => nodeObject(s, project, { editor: true });
export const placeShapeMesh = placeObject;

const finalCache = new Map();
// 구조물 → 3D 그룹. 묶이지 않은 구멍이 있으면 전체에서 뚫어요.
export function buildStructure(struct, project, { showHoles = false } = {}) {
  const g = new THREE.Group();
  g.name = struct ? struct.name : '';
  if (!struct || !struct.shapes.length) return g;
  let loose = false;
  const look = (list) => { for (const n of list) { if (n.type === 'link') look(n.children); else if (n.hole) loose = true; } };
  look(struct.shapes);
  if (loose && CSG && !showHoles) {
    const key = JSON.stringify(struct.shapes);
    let r = finalCache.get(key);
    if (r === undefined) {
      try {
        const items = [];
        collect(struct.shapes, new THREE.Matrix4(), project, null, items);
        r = evaluate(items);
      } catch (e) { console.warn('구멍 뚫기 실패', e); r = null; }
      finalCache.set(key, r);
    }
    if (r) {
      const mesh = new THREE.Mesh(r.geometry, r.material);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      return g;
    }
  }
  for (const n of struct.shapes) g.add(nodeObject(n, project, { showHoles }));
  return g;
}

export function structBox(struct, project) {
  const g = buildStructure(struct, project);
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  if (b.isEmpty()) b.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 10, 5));
  return b;
}
