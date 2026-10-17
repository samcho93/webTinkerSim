// 기본 모양(상자, 원기둥 …)과 구조물(모양 묶음)을 3D로 만드는 곳
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b64ToF32 } from './util.js';

export const SHAPES = {
  box: { name: '상자', icon: '🟥', size: [20, 20, 20] },
  cylinder: { name: '원기둥', icon: '🥫', size: [20, 20, 20] },
  sphere: { name: '공', icon: '⚽', size: [20, 20, 20] },
  halfsphere: { name: '반구', icon: '🥣', size: [20, 10, 20] },
  cone: { name: '원뿔', icon: '🍦', size: [20, 20, 20] },
  pyramid: { name: '피라미드', icon: '🔺', size: [20, 20, 20] },
  wedge: { name: '지붕', icon: '📐', size: [20, 20, 20] },
  torus: { name: '고리', icon: '🍩', size: [30, 8, 30] },
  tube: { name: '파이프', icon: '⭕', size: [20, 20, 20] },
  star: { name: '별', icon: '⭐', size: [30, 6, 30] },
  heart: { name: '하트', icon: '❤️', size: [30, 6, 30] },
};

export const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#9ca3af', '#4b5563', '#1f2937', '#a16207'];

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

function extrudeFlat(shape) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function makeUnit(type) {
  let g;
  switch (type) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 48); break;
    case 'sphere': g = new THREE.SphereGeometry(0.5, 40, 24); break;
    case 'halfsphere': {
      const top = new THREE.SphereGeometry(0.5, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.CircleGeometry(0.5, 40);
      cap.rotateX(Math.PI / 2);
      g = mergeGeometries([top, cap]);
      break;
    }
    case 'cone': g = new THREE.CylinderGeometry(0, 0.5, 1, 48); break;
    case 'pyramid': g = new THREE.CylinderGeometry(0, 0.7071, 1, 4, 1); g.rotateY(Math.PI / 4); break;
    case 'wedge': {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
      g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      break;
    }
    case 'torus': g = new THREE.TorusGeometry(0.35, 0.15, 20, 56); g.rotateX(Math.PI / 2); break;
    case 'tube': {
      const s = new THREE.Shape();
      s.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true);
      s.holes.push(hole);
      g = extrudeFlat(s);
      break;
    }
    case 'star': {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.22 : 0.5;
        const a = Math.PI / 2 + (i * Math.PI) / 5;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.closePath();
      g = extrudeFlat(s);
      break;
    }
    case 'heart': {
      const s = new THREE.Shape();
      s.moveTo(0, -0.5);
      s.bezierCurveTo(-0.15, -0.35, -0.5, -0.15, -0.5, 0.12);
      s.bezierCurveTo(-0.5, 0.38, -0.25, 0.5, -0.12, 0.5);
      s.bezierCurveTo(-0.04, 0.5, 0, 0.42, 0, 0.36);
      s.bezierCurveTo(0, 0.42, 0.04, 0.5, 0.12, 0.5);
      s.bezierCurveTo(0.25, 0.5, 0.5, 0.38, 0.5, 0.12);
      s.bezierCurveTo(0.5, -0.15, 0.15, -0.35, 0, -0.5);
      g = extrudeFlat(s);
      break;
    }
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  return normalize(g);
}

// STL 삼각형 좌표(Float32) → 크기 1짜리 형태
function makeStlUnit(project, meshId) {
  const data = project.meshes && project.meshes[meshId];
  if (!data) return makeUnit('box');
  const pos = b64ToF32(data.pos);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return normalize(g);
}

export function unitGeometry(shape, project) {
  const key = shape.type === 'stl' ? 'stl:' + shape.mesh : shape.type;
  let g = unitCache.get(key);
  if (!g) {
    g = shape.type === 'stl' ? makeStlUnit(project, shape.mesh) : makeUnit(shape.type);
    unitCache.set(key, g);
  }
  return g;
}

export function forgetMesh(meshId) { unitCache.delete('stl:' + meshId); }

const matCache = new Map();
export function material(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });
    matCache.set(key, m);
  }
  return m;
}
export const holeMaterial = new THREE.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 });

export function placeShapeMesh(mesh, s) {
  mesh.position.set(...s.pos);
  mesh.rotation.set(...s.rot.map((d) => THREE.MathUtils.degToRad(d)));
  mesh.scale.set(...s.size.map((v) => Math.max(0.1, v)));
}

export function shapeMesh(s, project) {
  const mesh = new THREE.Mesh(unitGeometry(s, project), s.hole ? holeMaterial : material(s.color || '#3b82f6'));
  placeShapeMesh(mesh, s);
  mesh.castShadow = !s.hole;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------- 구멍 뚫기(CSG) ----------------
let CSG = null;
const csgReady = import('three-bvh-csg').then((m) => { CSG = m; }).catch((e) => console.warn('구멍 기능을 불러오지 못했어요', e));
export const whenCsgReady = () => csgReady;
const csgCache = new Map();

function csgBuild(struct, project) {
  const key = JSON.stringify(struct.shapes);
  if (csgCache.has(key)) return csgCache.get(key);
  const { Brush, Evaluator, ADDITION, SUBTRACTION } = CSG;
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useGroups = true;
  const firstColor = (struct.shapes.find((x) => !x.hole) || {}).color || '#3b82f6';
  const mk = (s) => {
    const src = unitGeometry(s, project);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.attributes.position);
    g.setAttribute('normal', src.attributes.normal);
    if (src.index) g.setIndex(src.index);
    const b = new Brush(g, material(s.hole ? firstColor : s.color || '#3b82f6'));
    placeShapeMesh(b, s);
    b.updateMatrixWorld(true);
    return b;
  };
  const solids = struct.shapes.filter((s) => !s.hole);
  const holes = struct.shapes.filter((s) => s.hole);
  let result = mk(solids[0]);
  for (let i = 1; i < solids.length; i++) result = ev.evaluate(result, mk(solids[i]), ADDITION);
  for (const ho of holes) result = ev.evaluate(result, mk(ho), SUBTRACTION);
  const out = { geometry: result.geometry, material: result.material };
  csgCache.set(key, out);
  return out;
}

// 구조물(모양 묶음) → 3D 그룹. 구멍 모양이 있으면 실제로 뚫어줍니다.
export function buildStructure(struct, project, { showHoles = false } = {}) {
  const g = new THREE.Group();
  g.name = struct.name;
  if (!struct || !struct.shapes.length) return g;
  const hasHole = struct.shapes.some((s) => s.hole);
  const solids = struct.shapes.filter((s) => !s.hole);
  if (hasHole && CSG && solids.length && !showHoles) {
    try {
      const r = csgBuild(struct, project);
      const mesh = new THREE.Mesh(r.geometry, r.material);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      return g;
    } catch (e) { console.warn('구멍 뚫기 실패', e); }
  }
  for (const s of struct.shapes) {
    if (s.hole && !showHoles) continue;
    g.add(shapeMesh(s, project));
  }
  return g;
}

export function structBox(struct, project) {
  const g = buildStructure(struct, project, { showHoles: false });
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  if (b.isEmpty()) b.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 10, 5));
  return b;
}
