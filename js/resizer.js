// 팅커캐드처럼 고른 모양 둘레에 상자를 그리고, 모서리 손잡이를 끌어 크기를 바꿔요.
// 상자 옆에는 가로·세로·높이 숫자가 보이고, 숫자를 두 번 클릭하면 직접 고칠 수 있어요.
import * as THREE from 'three';
import { h } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const COL = { corner: '#ffffff', edge: '#ffffff', top: '#ffffff', lift: '#111827', hover: '#ef4444' };

export class Resizer {
  constructor({ v, pivot, container, getSnap, onStart, onEnd }) {
    this.v = v;
    this.pivot = pivot;
    this.getSnap = getSnap;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.active = false;
    this.drag = null;
    this.box = new THREE.Box3();

    this.group = new THREE.Group();
    this.group.visible = false;
    v.scene.add(this.group);
    // 상자 테두리
    this.frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: '#f59e0b', depthTest: false, transparent: true, opacity: 0.95 }));
    this.frame.renderOrder = 10;
    this.group.add(this.frame);

    // 손잡이들
    this.handles = [];
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(cube);
    const mk = (kind, sx, sz, title) => {
      const mat = new THREE.MeshBasicMaterial({ color: COL[kind], depthTest: false });
      const geo = kind === 'lift' ? new THREE.ConeGeometry(0.6, 1.4, 4) : cube;
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 12;
      if (kind !== 'lift') {
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#111827', depthTest: false }));
        line.renderOrder = 13;
        m.add(line);
      }
      m.userData = { kind, sx, sz, title };
      this.group.add(m);
      this.handles.push(m);
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk('corner', sx, sz, '모서리: 가로·세로 크기 (Shift = 같은 비율)');
    mk('edge', 1, 0, '가로 크기'); mk('edge', -1, 0, '가로 크기');
    mk('edge', 0, 1, '세로 크기'); mk('edge', 0, -1, '세로 크기');
    mk('top', 0, 0, '높이');
    mk('lift', 0, 0, '위아래로 띄우기');

    // 크기 숫자
    this.labels = {};
    for (const [axis, name] of [['x', '가로'], ['z', '세로'], ['y', '높이']]) {
      const d = h('div', { class: 'dim-label', title: `${name} — 두 번 클릭해서 고치기` });
      d.addEventListener('dblclick', (e) => { e.stopPropagation(); this.editLabel(axis, d); });
      d.addEventListener('pointerdown', (e) => e.stopPropagation());
      container.append(d);
      this.labels[axis] = d;
    }
    this.tip = h('div', { class: 'dim-tip' });
    container.append(this.tip);

    v.onFrame(() => this.update());
    v.dom.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
  }

  setActive(on) {
    this.active = on;
    if (!on) {
      this.group.visible = false;
      for (const d of Object.values(this.labels)) if (!d.querySelector('input')) d.style.display = 'none';
      this.tip.style.display = 'none';
    }
  }

  // 손잡이 상자의 좌표계(피벗의 위치·방향, 크기는 빼고)
  frameMatrix() {
    return new THREE.Matrix4().compose(this.pivot.position, this.pivot.quaternion, new THREE.Vector3(1, 1, 1));
  }

  measure() {
    const inv = this.frameMatrix().invert();
    const box = new THREE.Box3();
    this.pivot.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    this.pivot.traverse((o) => {
      if (!o.isMesh || o === this.pivot) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      m.multiplyMatrices(inv, o.matrixWorld);
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m));
    });
    return box;
  }

  update() {
    if (!this.active || !this.pivot.children.length) { if (this.group.visible) this.setActive(false); return; }
    const box = this.measure();
    if (box.isEmpty()) return;
    this.box.copy(box);
    this.group.visible = true;
    this.group.position.copy(this.pivot.position);
    this.group.quaternion.copy(this.pivot.quaternion);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    this.frame.position.copy(c);
    this.frame.scale.set(Math.max(s.x, 0.01) * 1.004, Math.max(s.y, 0.01) * 1.004, Math.max(s.z, 0.01) * 1.004);
    const cam = this.v.camera.position;
    const wp = new THREE.Vector3();
    for (const hd of this.handles) {
      const { kind, sx, sz } = hd.userData;
      if (kind === 'top') hd.position.set(c.x, box.max.y, c.z);
      else if (kind === 'lift') hd.position.set(c.x, box.max.y, c.z);
      else hd.position.set(sx ? (sx > 0 ? box.max.x : box.min.x) : c.x, box.min.y, sz ? (sz > 0 ? box.max.z : box.min.z) : c.z);
      hd.getWorldPosition(wp);
      const k = wp.distanceTo(cam) * 0.0075;
      hd.scale.setScalar(k * (kind === 'corner' ? 1 : 0.8));
      if (kind === 'lift') { hd.position.y += k * 3.2; hd.rotation.x = Math.PI; }
      if (kind === 'top') hd.position.y += 0;
      const hov = this.hover === hd || (this.drag && this.drag.handle === hd);
      hd.material.color.set(hov ? COL.hover : COL[kind]);
    }
    // 숫자 위치
    this.group.updateMatrixWorld(true);
    // 숫자는 모서리 바로 옆에 (화면에서 늘 같은 거리만큼)
    const cw = c.clone().applyMatrix4(this.group.matrixWorld);
    const off = cw.distanceTo(cam) * 0.022;
    const place = (axis, p, val) => {
      const d = this.labels[axis];
      if (d.querySelector('input')) return;
      const w = p.clone().applyMatrix4(this.group.matrixWorld);
      const sp = w.project(this.v.camera);
      if (sp.z > 1) { d.style.display = 'none'; return; }
      const r = this.v.dom.getBoundingClientRect();
      d.style.display = 'block';
      d.style.left = ((sp.x + 1) / 2) * r.width + 'px';
      d.style.top = ((1 - sp.y) / 2) * r.height + 'px';
      const t = fmt(val);
      if (d.textContent !== t) d.textContent = t;
    };
    this.group.updateMatrixWorld(true);
    place('x', new THREE.Vector3(c.x, box.min.y, box.max.z + off), s.x);
    place('z', new THREE.Vector3(box.max.x + off, box.min.y, c.z), s.z);
    place('y', new THREE.Vector3(box.min.x - off * 0.6, c.y, box.max.z + off * 0.6), s.y);
  }

  pickHandle(e) {
    if (!this.active || !this.group.visible) return null;
    const hit = this.v.hits(e, this.handles, false)[0];
    if (hit) return hit.object;
    // 손잡이가 작아도 잡기 쉽게: 화면에서 12픽셀 안이면 잡아요
    const r = this.v.dom.getBoundingClientRect();
    let best = null, bd = 12;
    const p = new THREE.Vector3();
    for (const hd of this.handles) {
      hd.getWorldPosition(p).project(this.v.camera);
      const d = Math.hypot(r.left + ((p.x + 1) / 2) * r.width - e.clientX, r.top + ((1 - p.y) / 2) * r.height - e.clientY);
      if (d < bd) { bd = d; best = hd; }
    }
    return best;
  }

  // 마우스를 누르면 손잡이인지 확인해요. 손잡이면 true
  pointerDown(e) {
    const hd = this.pickHandle(e);
    if (!hd) return false;
    const F = this.frameMatrix();
    const R = new THREE.Quaternion().copy(this.pivot.quaternion);
    const box = this.box.clone();
    const up = UP.clone().applyQuaternion(R);
    let plane;
    const { kind } = hd.userData;
    if (kind === 'corner' || kind === 'edge') {
      const p0 = new THREE.Vector3(0, box.min.y, 0).applyMatrix4(F);
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(up, p0);
    } else {
      // 위아래 손잡이: 위쪽 축을 품고 카메라를 바라보는 면
      const camDir = this.v.camera.getWorldDirection(new THREE.Vector3());
      const n = camDir.sub(up.clone().multiplyScalar(camDir.dot(up))).normalize();
      const p0 = hd.getWorldPosition(new THREE.Vector3());
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p0);
    }
    this.v.setPointer(e);
    const start = new THREE.Vector3();
    if (!this.v.raycaster.ray.intersectPlane(plane, start)) return false;
    const Finv = F.clone().invert();
    this.drag = { handle: hd, plane, F, Finv, R, P0: this.pivot.position.clone(), box, startLocal: start.applyMatrix4(Finv), moved: false };
    this.v.controls.enabled = false;
    this.v.dom.setPointerCapture(e.pointerId);
    return true;
  }

  snapSize(v) {
    const s = this.getSnap() || 0.1;
    return Math.max(s, Math.round(v / s) * s);
  }

  // 피벗을 (축 고정점 a 기준으로) k 배 키우기
  applyScale(k, a, P0, R) {
    const ka = new THREE.Vector3(a.x * k.x, a.y * k.y, a.z * k.z);
    this.pivot.position.copy(P0).add(a.clone().sub(ka).applyQuaternion(R));
    this.pivot.scale.copy(k);
    this.pivot.updateMatrixWorld(true);
  }

  onMove(e) {
    if (!this.drag) {
      const hd = this.active ? this.pickHandle(e) : null;
      if (hd !== this.hover) {
        this.hover = hd;
        this.v.dom.style.cursor = hd ? (hd.userData.kind === 'lift' || hd.userData.kind === 'top' ? 'ns-resize' : 'nwse-resize') : '';
        this.showTip(hd ? hd.userData.title : '', e);
      }
      return;
    }
    const d = this.drag;
    this.v.setPointer(e);
    const p = new THREE.Vector3();
    if (!this.v.raycaster.ray.intersectPlane(d.plane, p)) return;
    const L = p.applyMatrix4(d.Finv);
    const b = d.box;
    const size0 = b.getSize(new THREE.Vector3());
    const { kind, sx, sz } = d.handle.userData;
    if (!d.moved) { d.moved = true; this.onStart(); }
    if (kind === 'lift') {
      const s = this.getSnap() || 0.1;
      const dy = Math.round((L.y - d.startLocal.y) / s) * s;
      this.pivot.position.copy(d.P0).add(new THREE.Vector3(0, dy, 0).applyQuaternion(d.R));
      this.pivot.scale.set(1, 1, 1);
      this.pivot.updateMatrixWorld(true);
      this.showTip(`바닥에서 ${fmt(this.bottomWorld())} mm 위`, e);
      return;
    }
    const k = new THREE.Vector3(1, 1, 1);
    const a = new THREE.Vector3();
    if (kind === 'top') {
      k.y = this.snapSize(L.y - b.min.y) / (size0.y || 1);
      a.y = b.min.y;
    } else {
      if (sx) {
        const ns = this.snapSize(sx > 0 ? L.x - b.min.x : b.max.x - L.x);
        k.x = ns / (size0.x || 1);
        a.x = sx > 0 ? b.min.x : b.max.x;
      }
      if (sz) {
        const ns = this.snapSize(sz > 0 ? L.z - b.min.z : b.max.z - L.z);
        k.z = ns / (size0.z || 1);
        a.z = sz > 0 ? b.min.z : b.max.z;
      }
      if (kind === 'corner' && e.shiftKey) {
        const u = Math.max(k.x, k.z);
        k.set(u, u, u);
        a.y = b.min.y;
      }
    }
    this.applyScale(k, a, d.P0, d.R);
    this.showTip(null);
  }

  bottomWorld() {
    const box = new THREE.Box3();
    this.pivot.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
    return box.min.y;
  }

  onUp() {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = null;
    this.v.controls.enabled = true;
    this.showTip(null);
    if (moved) this.onEnd();
  }

  showTip(text, e) {
    if (!text) { this.tip.style.display = 'none'; return; }
    const r = this.v.dom.getBoundingClientRect();
    this.tip.textContent = text;
    this.tip.style.display = 'block';
    this.tip.style.left = e.clientX - r.left + 14 + 'px';
    this.tip.style.top = e.clientY - r.top + 14 + 'px';
  }

  // 숫자를 두 번 클릭하면 입력칸으로 바뀌어요
  editLabel(axis, d) {
    if (!this.active) return;
    const cur = this.box.getSize(new THREE.Vector3())[axis];
    const inp = h('input', { type: 'number', class: 'dim-input', value: fmt(cur), step: this.getSnap() || 0.1, min: 0.1 });
    d.replaceChildren(inp);
    d.classList.add('editing');
    inp.focus(); inp.select();
    let done = false;
    const finish = (apply) => {
      if (done) return;
      done = true;
      d.classList.remove('editing');
      d.textContent = fmt(cur);
      const val = Number(inp.value);
      if (!apply || !(val > 0) || Math.abs(val - cur) < 1e-6) return;
      this.onStart();
      const b = this.box;
      const k = new THREE.Vector3(1, 1, 1);
      k[axis] = val / (cur || 1);
      const c = b.getCenter(new THREE.Vector3());
      const a = new THREE.Vector3(c.x, b.min.y, c.z); // 가로·세로는 가운데, 높이는 바닥을 그대로
      this.applyScale(k, a, this.pivot.position.clone(), this.pivot.quaternion.clone());
      this.onEnd();
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    inp.addEventListener('blur', () => finish(true));
  }
}

function fmt(v) { return String(Math.round(v * 10) / 10); }
