// 전기전자 부품(모터, LED …)과 "블럭"(모양 + 부품) 3D 모델
import * as THREE from 'three';
import { buildStructure, material } from './shapes.js';
import { clamp } from './util.js';

export const COMPONENTS = {
  dc: { name: 'DC 모터', icon: '⚙️', desc: '바퀴나 프로펠러를 빙글빙글 계속 돌려요', motions: ['spin'], part: true, ref: 60, kind: 'out' },
  servo: { name: '서보 모터', icon: '🦾', desc: '0도~180도 사이 원하는 각도로 움직여요', motions: ['swing', 'turn'], part: true, ref: 70, kind: 'out' },
  linear: { name: '밀기 모터', icon: '↕️', desc: '쭉 밀었다가 당겨요 (0~100%)', motions: ['slide'], part: true, ref: 50, kind: 'out' },
  led: { name: 'LED', icon: '💡', desc: '불을 켜고 꺼요. 색도 바꿀 수 있어요', motions: ['none'], part: false, kind: 'out' },
  buzzer: { name: '버저', icon: '🎵', desc: '도레미 소리를 내요', motions: ['none'], part: false, kind: 'out' },
  lcd: { name: 'LCD 화면', icon: '📟', desc: '글자를 2줄 보여줘요', motions: ['none'], part: false, kind: 'out' },
  button: { name: '버튼', icon: '🔘', desc: '눌렀는지 알 수 있어요 (화면에서 클릭!)', motions: ['none'], part: false, kind: 'in' },
  distance: { name: '거리 센서', icon: '📏', desc: '앞에 있는 물건까지 거리를 재요', motions: ['none'], part: false, kind: 'in' },
  line: { name: '라인 센서', icon: '⚫', desc: '바닥의 검은 선을 찾아요', motions: ['none'], part: false, kind: 'in' },
  none: { name: '부품 없음', icon: '🧱', desc: '모양만 붙여요 (움직이지 않아요)', motions: ['none'], part: true, ref: 60, kind: 'none' },
};

export const MOTIONS = {
  spin: { name: '빙글빙글 돌기', icon: '🔄', desc: '멈추라고 할 때까지 계속 돌아요' },
  swing: { name: '팔처럼 꺾기', icon: '💪', desc: '팔꿈치처럼 0~180도로 접었다 폈다 해요' },
  turn: { name: '돌림판처럼 돌기', icon: '🧭', desc: '붙인 면 위에서 0~180도 빙 돌아요' },
  slide: { name: '밀고 당기기', icon: '↕️', desc: '0~100% 위치로 쭉 움직여요' },
  none: { name: '움직이지 않음', icon: '📌', desc: '' },
};

export const LED_COLORS = { 빨강: '#ff2a2a', 주황: '#ff8a00', 노랑: '#ffe600', 초록: '#22ff55', 파랑: '#2a7dff', 보라: '#b04dff', 흰색: '#ffffff' };

function box(w, hgt, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cyl(r, hgt, color, x = 0, y = 0, z = 0, axis = 'y', seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, seg), material(color));
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// LCD 글자 그리기
export function drawLcd(ref, lines) {
  const { ctx, tex } = ref;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = '#3f7fd8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 50px "Nanum Gothic Coding", monospace';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 2; i++) {
    const t = String(lines[i] ?? '').slice(0, 16);
    for (let c = 0; c < t.length; c++) ctx.fillText(t[c], 12 + c * 31, H * (i ? 0.73 : 0.27));
  }
  tex.needsUpdate = true;
}

// 부품 몸체를 만들어요. y 축 = 붙이는 면의 바깥쪽 방향
function buildHousing(type, motion, s) {
  const g = new THREE.Group();
  const ref = {};
  let H = 0;
  if (type === 'dc') {
    g.add(box(22 * s, 20 * s, 40 * s, '#facc15', 0, 10 * s, 0));
    g.add(box(18 * s, 6 * s, 14 * s, '#fde68a', 0, 20 * s, 12 * s));
    g.add(cyl(2.5 * s, 9 * s, '#f8fafc', 0, 24 * s, 0));
    H = 28 * s;
  } else if (type === 'servo') {
    if (motion === 'swing') {
      g.add(box(30 * s, 3 * s, 26 * s, '#64748b', 0, 1.5 * s, 0));
      g.add(box(18 * s, 20 * s, 23 * s, '#2563eb', 0, 13 * s, 0));
      H = 32 * s;
      for (const sx of [-1, 1]) {
        g.add(box(3 * s, H + 4 * s, 18 * s, '#94a3b8', sx * 14 * s, (H + 4 * s) / 2, 0));
        g.add(cyl(6 * s, 2 * s, '#f8fafc', sx * 16.5 * s, H, 0, 'x'));
      }
    } else {
      g.add(box(23 * s, 22 * s, 12 * s, '#2563eb', 0, 11 * s, 0));
      g.add(box(32 * s, 2.5 * s, 12 * s, '#1d4ed8', 0, 16 * s, 0));
      g.add(cyl(5 * s, 3 * s, '#f8fafc', 0, 23.5 * s, 0));
      H = 25 * s;
    }
  } else if (type === 'linear') {
    g.add(cyl(8 * s, 40 * s, '#6b7280', 0, 20 * s, 0));
    g.add(cyl(9 * s, 4 * s, '#374151', 0, 2 * s, 0));
    H = 42 * s;
  } else if (type === 'led') {
    g.add(cyl(4.5 * s, 2 * s, '#334155', 0, 1 * s, 0));
    const mat = new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#000000', roughness: 0.3, transparent: true, opacity: 0.92 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.4 * s, 3.4 * s, 5 * s, 24), mat);
    body.position.y = 4.5 * s;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.y = 7 * s;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(7 * s, 16, 10), new THREE.MeshBasicMaterial({ color: '#ff0000', transparent: true, opacity: 0, depthWrite: false }));
    glow.position.y = 6 * s;
    g.add(body, dome, glow);
    ref.led = { mat, glow };
    H = 10 * s;
  } else if (type === 'button') {
    g.add(box(14 * s, 6 * s, 14 * s, '#374151', 0, 3 * s, 0));
    const cap = cyl(4.5 * s, 4 * s, '#ef4444', 0, 8 * s, 0);
    cap.userData.capRest = 8 * s;
    cap.userData.capDown = 6.4 * s;
    g.add(cap);
    ref.cap = cap;
    H = 10 * s;
  } else if (type === 'lcd') {
    g.add(box(80 * s, 4 * s, 36 * s, '#15803d', 0, 2 * s, 0));
    g.add(box(72 * s, 2 * s, 26 * s, '#111827', 0, 5 * s, 0));
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(66 * s, 20.6 * s), new THREE.MeshBasicMaterial({ map: tex }));
    scr.rotation.x = -Math.PI / 2;
    scr.position.y = 6.1 * s;
    g.add(scr);
    ref.lcd = { ctx, tex };
    drawLcd(ref.lcd, ['', '']);
    H = 6 * s;
  } else if (type === 'buzzer') {
    g.add(cyl(6 * s, 8 * s, '#111827', 0, 4 * s, 0));
    g.add(cyl(1.5 * s, 0.6 * s, '#6b7280', 0, 8.2 * s, 0));
    H = 8 * s;
  } else if (type === 'distance') {
    g.add(box(45 * s, 3 * s, 20 * s, '#1d4ed8', 0, 1.5 * s, 0));
    for (const sx of [-1, 1]) {
      g.add(cyl(8 * s, 12 * s, '#cbd5e1', sx * 13 * s, 9 * s, 0));
      g.add(cyl(6 * s, 0.6 * s, '#334155', sx * 13 * s, 15.2 * s, 0));
    }
    ref.dir = true;
    H = 15 * s;
  } else if (type === 'line') {
    g.add(box(14 * s, 3 * s, 30 * s, '#1e3a8a', 0, 1.5 * s, 0));
    g.add(cyl(2.5 * s, 3 * s, '#111827', 0, 4.5 * s, -5 * s));
    g.add(cyl(2.5 * s, 3 * s, '#e5e7eb', 0, 4.5 * s, 5 * s));
    ref.dir = true;
    H = 6 * s;
  }
  return { g, H, ref };
}

// 블럭 = 모양(구조물) + 부품 + 움직임
export function buildBlockModel(block, project) {
  const comp = COMPONENTS[block.component] || COMPONENTS.none;
  const motion = block.motion || comp.motions[0];
  const root = new THREE.Group();
  root.name = block.name;
  const struct = block.partId ? project.structures.find((x) => x.id === block.partId) : null;

  // 모양 크기를 먼저 재요 (부품 크기를 자동으로 맞추기 위해)
  const partRot = new THREE.Group();
  partRot.rotation.set(...(block.partRot || [0, 0, 0]).map((d) => THREE.MathUtils.degToRad(d)));
  let partGroup = null;
  let pbox = null;
  if (comp.part && struct) {
    partGroup = buildStructure(struct, project);
    partRot.add(partGroup);
    partRot.updateMatrixWorld(true);
    pbox = new THREE.Box3().setFromObject(partRot);
    if (pbox.isEmpty()) pbox = null;
  }
  let s = 1;
  if (comp.part && pbox && block.component !== 'none') {
    const sz = pbox.getSize(new THREE.Vector3());
    s = clamp(Math.max(sz.x, sz.y, sz.z) / comp.ref, 0.5, 2.5);
    // 팔처럼 꺾는 서보는 팔 두께가 받침대 사이에 들어가도록 키워요
    if (motion === 'swing') s = clamp(Math.max(s, (sz.x + 4) / 25), 0.5, 3);
  }
  if (block.compScale) s *= block.compScale;
  const { g: housing, H, ref } = block.component === 'none' ? { g: new THREE.Group(), H: 0, ref: {} } : buildHousing(block.component, motion, s);
  root.add(housing);

  const pivot = new THREE.Group();
  pivot.position.y = H;
  root.add(pivot);
  const mover = new THREE.Group();
  pivot.add(mover);
  const holder = new THREE.Group();
  mover.add(holder);
  holder.add(partRot);

  let stroke = 0;
  if (block.component === 'linear') {
    stroke = 50 * s;
    const rod = cyl(3 * s, stroke + 4 * s, '#e5e7eb', 0, -(stroke + 4 * s) / 2 + 2 * s, 0);
    mover.add(rod);
  }

  // 모양을 축에 자동으로 맞춰요
  if (pbox) {
    const c = pbox.getCenter(new THREE.Vector3());
    const sz = pbox.getSize(new THREE.Vector3());
    const pv = block.pivot || 'auto';
    if (motion === 'swing') {
      if (pv === 'center') holder.position.set(-c.x, -c.y, -c.z);
      else {
        const inset = Math.min(sz.z / 2, sz.y * 0.25);
        holder.position.set(-c.x, -pbox.min.y - inset, -c.z);
      }
    } else if (pv === 'center' && motion !== 'none') {
      holder.position.set(-c.x, -c.y, -c.z);
    } else {
      holder.position.set(-c.x, -pbox.min.y, -c.z);
    }
  }

  // 사진 찍기/선택용 표시
  housing.traverse((o) => { if (o.isMesh) o.userData.part = 'housing'; });
  if (partGroup) partGroup.traverse((o) => { if (o.isMesh) o.userData.part = 'shape'; });

  const model = {
    root, housing, pivot, mover, attach: partRot, ref, H, s, stroke, motion, comp: block.component,
    value: motion === 'swing' || motion === 'turn' ? 90 : 0,
    spinAngle: 0,
    setValue(v) {
      this.value = v;
      if (motion === 'turn') mover.rotation.set(0, THREE.MathUtils.degToRad(v - 90), 0);
      else if (motion === 'swing') mover.rotation.set(THREE.MathUtils.degToRad(v - 90), 0, 0);
      else if (motion === 'slide') mover.position.y = (stroke * clamp(v, 0, 100)) / 100;
    },
    setSpin(a) { this.spinAngle = a; if (motion === 'spin') mover.rotation.set(0, a, 0); },
  };
  model.setValue(model.value);
  return model;
}

// 붙이는 면의 방향(normal)에 맞춰 회전을 정해요. 글자/팔이 자연스럽게 위를 향하도록 합니다.
export function mountQuaternion(normal, spinDeg = 0) {
  const y = new THREE.Vector3(...normal).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  let z = up.clone().negate().sub(y.clone().multiplyScalar(-y.y));
  if (z.lengthSq() < 1e-4) z = new THREE.Vector3(0, 0, 1).sub(y.clone().multiplyScalar(y.z));
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(spinDeg)));
  return q;
}
