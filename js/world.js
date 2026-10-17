// 조립·실행 무대: 로봇(바탕 구조물 + 블럭들)을 만들고 움직임을 계산해요
import * as THREE from 'three';
import { Viewer } from './viewer.js';
import { buildStructure, material } from './shapes.js';
import { buildBlockModel, mountQuaternion, drawLcd, LED_COLORS } from './components.js';
import { P } from './project.js';
import { clamp, Emitter } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const MAX_OMEGA = 1.2 * Math.PI * 2; // 속도 100 일 때 1초에 1.2바퀴
const SERVO_SPEED = 300; // 1초에 300도
const SLIDE_SPEED = 80; // 1초에 80%

export const STAGES = {
  grid: { name: '빈 바닥', icon: '⬜' },
  room: { name: '벽이 있는 방', icon: '🧱' },
  line: { name: '라인 트랙', icon: '〰️' },
  road: { name: '도로', icon: '🛣️' },
};
const TRACK = { L: 350, R: 250, W: 26 };

export class World extends Emitter {
  constructor() {
    super();
    this.v = new Viewer({ grid: 1200, background: '#dceeff' });
    this.v.camera.position.set(420, 360, 520);
    this.v.controls.target.set(0, 40, 0);
    this.scene = this.v.scene;
    this.stageGroup = new THREE.Group();
    this.robotGroup = new THREE.Group();
    this.scene.add(this.stageGroup, this.robotGroup);
    this.robots = new Map();
    this.insts = new Map();
    this.obstacles = [];
    this.running = false;
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), '#f59e0b');
    this.selBox.visible = false;
    this.scene.add(this.selBox);
    this.selected = null;
    this.follow = true;
    this.v.onFrame((dt) => this.update(dt));
    this.p = null;
    this.stageType = null;
  }

  get dom() { return this.v.dom; }
  mount(el) { this.v.mount(el); }

  setProject(p) {
    this.p = p;
    this.rebuild();
  }

  // ---------------- 무대 ----------------
  buildStage() {
    const type = this.p.stage || 'grid';
    if (this.stageType === type) return;
    this.stageType = type;
    this.stageGroup.clear();
    this.obstacles = [];
    const size = 3000;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2048;
    const ctx = cv.getContext('2d');
    const px = (v) => ((v + size / 2) / size) * 2048;
    ctx.fillStyle = type === 'road' ? '#b7d98b' : '#f7fbff';
    ctx.fillRect(0, 0, 2048, 2048);
    // 격자
    ctx.strokeStyle = type === 'road' ? 'rgba(0,0,0,0.05)' : '#d7e3f2';
    ctx.lineWidth = 1;
    for (let v = -size / 2; v <= size / 2; v += 50) {
      ctx.beginPath(); ctx.moveTo(px(v), 0); ctx.lineTo(px(v), 2048); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, px(v)); ctx.lineTo(2048, px(v)); ctx.stroke();
    }
    if (type === 'line') {
      const { L, R, W } = TRACK;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = (W / size) * 2048;
      ctx.beginPath();
      ctx.moveTo(px(-L), px(-R)); ctx.lineTo(px(L), px(-R));
      ctx.arc(px(L), px(0), (R / size) * 2048, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(px(-L), px(R));
      ctx.arc(px(-L), px(0), (R / size) * 2048, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
      ctx.stroke();
    }
    if (type === 'road') {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(0, px(-105), 2048, px(105) - px(-105));
      ctx.fillStyle = '#fde047';
      for (let x = -size / 2; x < size / 2; x += 120) ctx.fillRect(px(x), px(-3), (60 / size) * 2048, (6 / size) * 2048);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, px(-105), 2048, 4);
      ctx.fillRect(0, px(105) - 4, 2048, 4);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.ground = ground;
    this.stageGroup.add(ground);
    // 앞쪽 표시 화살표는 로봇마다 그려요
    if (type === 'room') {
      const wall = (x, z, w, d, hgt = 100, color = '#cbd5e1') => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), material(color));
        m.position.set(x, hgt / 2, z);
        m.castShadow = m.receiveShadow = true;
        this.stageGroup.add(m);
        this.obstacles.push({ mesh: m, obb: { cx: x, cz: z, hx: w / 2, hz: d / 2, ang: 0, y0: 0, y1: hgt } });
      };
      const R = 800;
      wall(0, -R, 2 * R + 20, 20); wall(0, R, 2 * R + 20, 20);
      wall(-R, 0, 20, 2 * R); wall(R, 0, 20, 2 * R);
      wall(400, -250, 120, 120, 80, '#fca5a5');
      wall(-350, 300, 160, 100, 80, '#93c5fd');
      wall(150, 420, 100, 100, 80, '#fde68a');
    }
  }

  isBlack(x, z) {
    if (this.p.stage !== 'line') return false;
    const { L, R, W } = TRACK;
    let d;
    if (Math.abs(x) <= L) d = Math.abs(Math.abs(z) - R);
    else d = Math.abs(Math.hypot(x - Math.sign(x) * L, z) - R);
    return d < W / 2;
  }

  // ---------------- 로봇 만들기 ----------------
  rebuild() {
    if (!this.p) return;
    this.needsRebuild = false;
    this.buildStage();
    this.robotGroup.clear();
    this.robots.clear();
    this.insts.clear();
    for (const r of this.p.robots) this.buildRobot(r);
    this.setSelected(this.selected);
    this.emit('rebuilt');
  }

  buildRobot(r) {
    const root = new THREE.Group();
    root.name = r.name;
    const base = this.p.structures.find((s) => s.id === r.baseId);
    const holder = new THREE.Group();
    root.add(holder);
    if (base) holder.add(buildStructure(base, this.p));
    holder.traverse((o) => { if (o.isMesh) o.userData.owner = { robotId: r.id, instId: null, role: 'base' }; });
    // 앞쪽 화살표
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(8, 20, 3), new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
    arrow.rotation.z = -Math.PI / 2;
    arrow.userData.isArrow = true;
    root.add(arrow);
    const robot = { data: r, root, holder, arrow, insts: [] };
    this.robots.set(r.id, robot);
    this.robotGroup.add(root);
    // 블럭 붙이기 (부모부터)
    const list = P.instsOf(this.p, r.id);
    const addTree = (parentId, parentObj) => {
      for (const inst of list.filter((i) => (i.parentId || null) === parentId)) {
        const io = this.buildInst(inst, robot, parentObj);
        if (io) addTree(inst.id, io.model.attach);
      }
    };
    addTree(null, holder);
    this.placeRobot(robot);
    return robot;
  }

  buildInst(inst, robot, parentObj) {
    const block = P.block(this.p, inst.blockId);
    if (!block) return null;
    const model = buildBlockModel(block, this.p);
    const mount = new THREE.Group();
    mount.add(model.root);
    this.applyMount(mount, inst);
    parentObj.add(mount);
    const owner = { robotId: robot.data.id, instId: inst.id };
    model.housing.traverse((o) => { if (o.isMesh) o.userData.owner = { ...owner, role: 'housing' }; });
    model.attach.traverse((o) => { if (o.isMesh) o.userData.owner = { ...owner, role: block.allowChildren ? 'shape' : 'shape-closed' }; });
    const io = { data: inst, block, model, mount, robot, state: this.freshState(block, model) };
    this.insts.set(inst.id, io);
    robot.insts.push(io);
    if (block.component === 'lcd' && model.ref.lcd) drawLcd(model.ref.lcd, io.state.lines);
    this.applyLed(io);
    return io;
  }

  freshState(block, model) {
    return {
      target: model.value, cur: model.value, speed: 0, curSpeed: 0,
      on: false, color: LED_COLORS.빨강, lines: ['', ''], pressed: false, hwPressed: false,
    };
  }

  applyMount(mount, inst) {
    mount.position.set(...inst.pos);
    mount.quaternion.copy(mountQuaternion(inst.normal, inst.spin || 0));
    const s = inst.scale || 1;
    mount.scale.set(s, s, s);
  }

  // 로봇을 바닥 위에 올려놓아요
  placeRobot(robot) {
    const r = robot.data;
    const root = robot.root;
    root.position.set(r.pos[0], 0, r.pos[1]);
    root.rotation.set(0, THREE.MathUtils.degToRad(r.rotY || 0), 0);
    root.updateMatrixWorld(true);
    root.remove(robot.arrow);
    const box = new THREE.Box3().setFromObject(root);
    root.add(robot.arrow);
    const minY = box.isEmpty() ? 0 : box.min.y;
    root.position.y = -minY + (r.lift || 0);
    root.updateMatrixWorld(true);
    // 로봇 자신의 크기(로봇 좌표계)
    robot.localBox = this.localBox(robot);
    const lb = robot.localBox;
    robot.arrow.position.set(lb.max.x + 18, lb.min.y + 2, (lb.min.z + lb.max.z) / 2);
    robot.arrow.scale.setScalar(clamp((lb.max.z - lb.min.z) / 120, 0.6, 1.6));
    robot.arrow.visible = this.showArrows !== false && !this.running;
    this.detectWheels(robot);
  }

  localBox(robot) {
    const inv = new THREE.Matrix4().copy(robot.root.matrixWorld).invert();
    const box = new THREE.Box3();
    robot.arrow.visible = false;
    robot.root.updateMatrixWorld(true);
    robot.root.traverse((o) => {
      if (!o.isMesh || o.userData.isArrow) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      box.union(b);
    });
    if (box.isEmpty()) box.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10));
    return box;
  }

  // 바닥에 닿는 DC 모터 바퀴를 찾아요 (자동차 움직임 자동 적용)
  detectWheels(robot) {
    const inv = new THREE.Matrix4().copy(robot.root.matrixWorld).invert();
    const rq = robot.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    robot.wheels = [];
    const minY = robot.localBox.min.y;
    for (const io of robot.insts) {
      if (io.block.component !== 'dc') { io.dirSign = 1; continue; }
      const axis = UP.clone().applyQuaternion(io.model.pivot.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rq);
      const box = new THREE.Box3();
      io.model.attach.updateMatrixWorld(true);
      io.model.attach.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
      });
      io.dirSign = 1;
      if (box.isEmpty() || Math.abs(axis.y) > 0.35 || box.min.y - minY > 4) continue;
      const f = new THREE.Vector3().crossVectors(axis, UP);
      const fl = f.length();
      f.normalize();
      io.dirSign = Math.abs(f.x) > 0.3 ? Math.sign(f.x) : 1;
      const c = box.getCenter(new THREE.Vector3());
      robot.wheels.push({ io, axis, f, fl, g: new THREE.Vector3(axis.x, 0, axis.z).normalize(), r: (box.max.y - box.min.y) / 2, p: c });
    }
    const mode = robot.data.mode || 'auto';
    robot.drives = mode === 'wheels' || (mode === 'auto' && robot.wheels.length > 0);
  }

  // ---------------- 선택 표시 ----------------
  setSelected(sel) {
    this.selected = sel;
    this.selBox.visible = false;
  }
  selectedObject() {
    const s = this.selected;
    if (!s) return null;
    if (s.type === 'robot') return this.robots.get(s.id)?.root;
    if (s.type === 'inst') return this.insts.get(s.id)?.mount;
    return null;
  }

  // ---------------- 마우스로 고르기 ----------------
  pickables() {
    return [this.robotGroup];
  }
  pick(e) {
    const hits = this.v.hits(e, [this.robotGroup]).filter((h) => h.object.userData.owner);
    return hits[0] || null;
  }
  attachHits(e, excludeInstId) {
    const excluded = new Set();
    if (excludeInstId) {
      const walk = (id) => { excluded.add(id); for (const c of P.children(this.p, id)) walk(c.id); };
      walk(excludeInstId);
    }
    const hits = this.v.hits(e, [this.robotGroup]).filter((h) => {
      const o = h.object.userData.owner;
      if (!o) return false;
      if (o.instId && excluded.has(o.instId)) return false;
      return true;
    });
    const h = hits[0];
    if (!h) return null;
    const o = h.object.userData.owner;
    if (o.role === 'housing' || o.role === 'shape-closed') return { blocked: true, owner: o };
    return h;
  }
  hitToMount(h, snap = true) {
    const o = h.object.userData.owner;
    const attachObj = o.instId ? this.insts.get(o.instId).model.attach : this.robots.get(o.robotId).holder;
    attachObj.updateMatrixWorld(true);
    const nW = h.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize();
    const q = attachObj.getWorldQuaternion(new THREE.Quaternion()).invert();
    const n = nW.applyQuaternion(q).normalize();
    const pnt = attachObj.worldToLocal(h.point.clone());
    const arr = [n.x, n.y, n.z];
    const ax = arr.findIndex((v) => Math.abs(v) > 0.985);
    if (ax >= 0) {
      for (let i = 0; i < 3; i++) arr[i] = i === ax ? Math.sign(arr[i]) : 0;
      if (snap) {
        const pp = [pnt.x, pnt.y, pnt.z];
        for (let i = 0; i < 3; i++) if (i !== ax) pp[i] = Math.round(pp[i] / 5) * 5;
        pnt.set(...pp);
      }
    }
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return { robotId: o.robotId, parentId: o.instId || null, pos: [pnt.x, pnt.y, pnt.z].map(r3), normal: arr.map(r3), attachObj };
  }
  groundPoint(e) {
    const ray = this.v.setPointer(e);
    const pt = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(UP, 0), pt) ? pt : null;
  }

  // 붙일 곳 미리보기(유령 블럭)
  showGhost(block, mountInfo, scale = 1, spin = 0) {
    this.hideGhost();
    if (!block || !mountInfo) return;
    const model = buildBlockModel(block, this.p);
    const g = new THREE.Group();
    g.add(model.root);
    model.root.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.55;
        o.material.emissive && o.material.emissive.set('#2563eb');
        o.raycast = () => {};
      }
    });
    this.applyMount(g, { pos: mountInfo.pos, normal: mountInfo.normal, spin, scale });
    mountInfo.attachObj.add(g);
    this.ghost = g;
  }
  hideGhost() {
    if (this.ghost) { this.ghost.removeFromParent(); this.ghost = null; }
  }

  // ---------------- 실행(시뮬레이션) ----------------
  resolve(key) {
    if (this.insts.has(key)) return this.insts.get(key);
    for (const io of this.insts.values()) if (io.data.name === key) return io;
    return null;
  }

  startSim() {
    this.resetSim();
    this.running = true;
    for (const r of this.robots.values()) { r.arrow.visible = false; this.detectWheels(r); }
    this.simT = 0;
  }
  stopSim() {
    this.running = false;
    for (const io of this.insts.values()) { io.state.speed = 0; }
    this.stopAllTones();
  }
  resetSim() {
    this.running = false;
    this.stopAllTones();
    for (const r of this.robots.values()) {
      for (const io of r.insts) {
        io.state = this.freshState(io.block, io.model);
        io.model.setValue(io.model.motion === 'swing' || io.model.motion === 'turn' ? 90 : 0);
        io.state.cur = io.state.target = io.model.value;
        io.model.setSpin(0);
        this.applyLed(io);
        if (io.model.ref.lcd) drawLcd(io.model.ref.lcd, io.state.lines);
        if (io.model.ref.cap) io.model.ref.cap.position.y = io.model.ref.cap.userData.capRest;
      }
      this.placeRobot(r);
    }
    this.emit('reset');
  }

  applyLed(io) {
    const led = io.model.ref.led;
    if (!led) return;
    const c = new THREE.Color(io.state.color);
    if (io.state.on) {
      led.mat.color.copy(c);
      led.mat.emissive.copy(c).multiplyScalar(1.2);
      led.glow.material.color.copy(c);
      led.glow.material.opacity = 0.35;
    } else {
      led.mat.color.copy(c).multiplyScalar(0.35);
      led.mat.emissive.set('#000');
      led.glow.material.opacity = 0;
    }
  }

  // 명령들 (코드에서 불러요)
  cmd(type, key, ...args) {
    const io = this.resolve(key);
    if (!io) return;
    const st = io.state;
    const comp = io.block.component;
    if (type === 'motor' && comp === 'dc') st.speed = clamp(Number(args[0]) || 0, -100, 100);
    else if (type === 'servo' && comp === 'servo') st.target = clamp(Number(args[0]) || 0, 0, 180);
    else if (type === 'slide' && comp === 'linear') st.target = clamp(Number(args[0]) || 0, 0, 100);
    else if (type === 'led' && comp === 'led') { st.on = !!args[0]; this.applyLed(io); }
    else if (type === 'ledColor' && comp === 'led') { st.color = LED_COLORS[args[0]] || args[0] || st.color; st.on = true; this.applyLed(io); }
    else if (type === 'lcd' && comp === 'lcd') {
      const line = clamp(Math.round(Number(args[0]) || 1), 1, 2) - 1;
      let t = args[1];
      if (typeof t === 'number') t = Math.round(t * 100) / 100;
      st.lines[line] = String(t ?? '');
      drawLcd(io.model.ref.lcd, st.lines);
    } else if (type === 'lcdClear' && comp === 'lcd') { st.lines = ['', '']; drawLcd(io.model.ref.lcd, st.lines); }
    else return;
    this.emit('output', type, io, args);
  }

  read(type, key) {
    const io = this.resolve(key);
    if (!io) return type === 'distance' ? 400 : false;
    if (type === 'button') return !!(io.state.pressed || io.state.hwPressed);
    if (type === 'distance') return this.measure(io);
    if (type === 'line') return this.lineSee(io);
    return 0;
  }

  sensorRay(io) {
    const o = io.model.root;
    o.updateMatrixWorld(true);
    const pos = new THREE.Vector3(0, io.model.H || 10, 0).applyMatrix4(o.matrixWorld);
    const dir = UP.clone().applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { pos, dir };
  }

  measure(io) {
    const now = performance.now();
    if (io._mt && now - io._mt < 40) return io._mv;
    const { pos, dir } = this.sensorRay(io);
    const targets = [...this.obstacles.map((o) => o.mesh)];
    for (const r of this.robots.values()) if (r !== io.robot) targets.push(r.root);
    const rc = new THREE.Raycaster(pos, dir, 0, 4000);
    const hit = rc.intersectObjects(targets, true).find((h) => !h.object.userData.isArrow);
    let cm = 400;
    if (hit) cm = Math.round(hit.distance) / 10;
    // 바닥을 보고 있으면 바닥까지 거리
    if (dir.y < -0.05) cm = Math.min(cm, Math.round(pos.y / -dir.y) / 10);
    io._mt = now; io._mv = cm;
    return cm;
  }

  lineSee(io) {
    const { pos } = this.sensorRay(io);
    if (pos.y > 50) return false;
    return this.isBlack(pos.x, pos.z);
  }

  // ---------------- 소리 ----------------
  tone(freq, sec) {
    try {
      this.ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const ac = this.ac;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.06;
      o.connect(g).connect(ac.destination);
      const t = ac.currentTime;
      g.gain.setValueAtTime(0.06, t + Math.max(0.01, sec - 0.03));
      g.gain.linearRampToValueAtTime(0, t + sec);
      o.start(t);
      o.stop(t + sec + 0.02);
      (this._tones ||= new Set()).add(o);
      o.onended = () => this._tones.delete(o);
    } catch (e) { /* 소리를 낼 수 없는 환경 */ }
  }
  stopAllTones() { if (this._tones) for (const o of this._tones) { try { o.stop(); } catch (e) { /**/ } } }

  // ---------------- 매 순간 계산 ----------------
  update(dt) {
    if (!this.p) return;
    for (const io of this.insts.values()) {
      const st = io.state;
      const m = io.model;
      const comp = io.block.component;
      if (comp === 'dc') {
        st.curSpeed += (st.speed - st.curSpeed) * Math.min(1, dt / 0.15);
        const w = (st.curSpeed / 100) * MAX_OMEGA * (io.dirSign || 1) * (io.data.reverse ? -1 : 1);
        st.omega = w;
        if (Math.abs(w) > 1e-4) m.setSpin(m.spinAngle + w * dt);
      } else if (comp === 'servo' || comp === 'linear') {
        const sp = (comp === 'servo' ? SERVO_SPEED : SLIDE_SPEED) * dt;
        const tgt = comp === 'servo' && io.data.reverse ? 180 - st.target : st.target;
        if (Math.abs(tgt - st.cur) > 0.01) {
          st.cur += clamp(tgt - st.cur, -sp, sp);
          m.setValue(st.cur);
        }
      } else if (comp === 'button' && m.ref.cap) {
        const c = m.ref.cap;
        const y = st.pressed || st.hwPressed ? c.userData.capDown : c.userData.capRest;
        c.position.y += (y - c.position.y) * Math.min(1, dt * 30);
      }
    }
    if (this.running) {
      for (const r of this.robots.values()) if (r.drives) this.drive(r, dt);
    }
    // 선택 상자
    const so = this.selectedObject();
    if (so && !this.running) {
      const ar = this.selected.type === 'robot' ? this.robots.get(this.selected.id).arrow : null;
      if (ar) so.remove(ar);
      this.selBox.box.setFromObject(so);
      if (ar) so.add(ar);
      this.selBox.box.expandByScalar(1.5);
      this.selBox.visible = true;
    } else this.selBox.visible = false;
    if (this.follow && this.running) {
      const r = [...this.robots.values()].find((x) => x.drives);
      if (r) {
        const c = r.root.position;
        const d = c.clone().sub(this.v.controls.target);
        this.v.controls.target.add(d.multiplyScalar(Math.min(1, dt * 3)));
        this.v.camera.position.add(d);
      }
    }
  }

  // 바퀴 속도로 로봇 전체가 움직여요
  drive(robot, dt) {
    if (!robot.wheels.length) return;
    // 최소제곱으로 (vx, vz, w) 찾기: 로봇 좌표계
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const B = [0, 0, 0];
    const addRow = (dx, dz, p, tgt, wt = 1) => {
      const row = [dx, dz, dx * p.z - dz * p.x];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j] * wt;
        B[i] += row[i] * tgt * wt;
      }
    };
    let moving = false;
    for (const wh of robot.wheels) {
      const w = wh.io.state.omega || 0;
      if (Math.abs(w) > 1e-3) moving = true;
      addRow(wh.f.x, wh.f.z, wh.p, w * wh.r * wh.fl);
      addRow(wh.g.x, wh.g.z, wh.p, 0);
    }
    if (!moving) return;
    for (let i = 0; i < 3; i++) A[i][i] += 1e-6;
    const u = solve3(A, B);
    if (!u) return;
    const [vx, vz, w] = u;
    const root = robot.root;
    const ang = root.rotation.y;
    const c = Math.cos(ang), s = Math.sin(ang);
    // 로봇 좌표 → 세상 좌표 (Y축 회전)
    const wx = vx * c + vz * s;
    const wz = -vx * s + vz * c;
    const nx = root.position.x + wx * dt;
    const nz = root.position.z + wz * dt;
    const na = ang + w * dt;
    if (this.blocked(robot, nx, nz, na)) { robot.bump = true; return; }
    robot.bump = false;
    root.position.x = nx;
    root.position.z = nz;
    root.rotation.y = na;
  }

  obbOf(robot, x, z, ang) {
    const b = robot.localBox;
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const c = Math.cos(ang), s = Math.sin(ang);
    return {
      cx: x + cx * c + cz * s, cz: z - cx * s + cz * c,
      hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, ang,
      y0: robot.root.position.y + b.min.y + 2, y1: robot.root.position.y + b.max.y,
    };
  }

  blocked(robot, x, z, ang) {
    const now = this.obbOf(robot, robot.root.position.x, robot.root.position.z, robot.root.rotation.y);
    const next = this.obbOf(robot, x, z, ang);
    const others = this.obstacles.map((o) => o.obb);
    for (const r of this.robots.values()) {
      if (r === robot) continue;
      if (r.drives) others.push(this.obbOf(r, r.root.position.x, r.root.position.z, r.root.rotation.y));
      else {
        // 고정된 로봇은 조각마다 상자로 봐요 (움직이는 팔도 정확하게)
        r.root.traverse((o) => {
          if (!o.isMesh || o.userData.isArrow || !o.visible) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
          others.push({ cx: (bb.min.x + bb.max.x) / 2, cz: (bb.min.z + bb.max.z) / 2, hx: (bb.max.x - bb.min.x) / 2, hz: (bb.max.z - bb.min.z) / 2, ang: 0, y0: bb.min.y, y1: bb.max.y });
        });
      }
    }
    for (const o of others) if (obbOverlap(next, o) && !obbOverlap(now, o)) return true;
    return false;
  }
}

function solve3(A, b) {
  const m = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k;
    if (Math.abs(m[p][i]) < 1e-12) return null;
    [m[i], m[p]] = [m[p], m[i]];
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = m[k][i] / m[i][i];
      for (let j = i; j < 4; j++) m[k][j] -= f * m[i][j];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

// 위에서 본 두 네모가 겹치는지 (기울어진 네모도 OK)
function obbOverlap(a, b) {
  if (a.y1 < b.y0 || b.y1 < a.y0) return false;
  const axes = [];
  for (const o of [a, b]) {
    const c = Math.cos(o.ang), s = Math.sin(o.ang);
    axes.push([c, -s], [s, c]);
  }
  const corners = (o) => {
    const c = Math.cos(o.ang), s = Math.sin(o.ang);
    const ex = [c * o.hx, -s * o.hx], ez = [s * o.hz, c * o.hz];
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [o.cx + i * ex[0] + j * ez[0], o.cz + i * ex[1] + j * ez[1]]);
  };
  const ca = corners(a), cb = corners(b);
  for (const [ax, az] of axes) {
    const pa = ca.map(([x, z]) => x * ax + z * az), pb = cb.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
