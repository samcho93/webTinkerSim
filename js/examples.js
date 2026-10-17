// 🌟 예제 프로젝트들 (열 때마다 새로 만들어요)
import { newProject } from './project.js';
import { S, libStructure } from './library.js';
import { uid } from './util.js';

// ---------- 만들기 도우미 ----------
function mk(name, icon, { board = 'uno', stage = 'grid' } = {}) {
  const p = newProject(name);
  p.icon = icon; p.board = board; p.stage = stage;
  return p;
}
function struct(p, name, icon, shapes) {
  const s = { id: uid('st'), name, icon, shapes };
  p.structures.push(s);
  return s.id;
}
function lib(p, id, name, tweak) {
  const s = libStructure(id, name);
  if (tweak) tweak(s.shapes);
  p.structures.push(s);
  return s.id;
}
function block(p, o) {
  const b = { id: uid('b'), partRot: [0, 0, 0], pivot: 'auto', motion: 'none', partId: null, allowChildren: false, ...o };
  p.blocks.push(b);
  return b.id;
}
function robot(p, o) {
  const r = { id: uid('r'), pos: [0, 0], rotY: 0, mode: 'auto', ...o };
  p.robots.push(r);
  return r.id;
}
function inst(p, o) {
  const i = { id: uid('i'), parentId: null, spin: 0, scale: 1, reverse: false, ...o };
  p.instances.push(i);
  return i.id;
}

// ---------- 블록 코드 도우미 ----------
const num = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const val = (x) => (typeof x === 'number' ? num(x) : typeof x === 'string' ? { shadow: { type: 'text', fields: { TEXT: x } } } : { block: x });
function seq(...bs) {
  bs = bs.flat().filter(Boolean);
  for (let i = 0; i < bs.length - 1; i++) {
    let last = bs[i];
    while (last.next) last = last.next.block;
    last.next = { block: bs[i + 1] };
  }
  return bs[0];
}
const body = (...bs) => (bs.flat().filter(Boolean).length ? { block: seq(...bs) } : undefined);
const B = {
  start: (x, y, ...bs) => ({ type: 'tsim_start', x, y, next: body(...bs) }),
  forever: (...bs) => ({ type: 'tsim_forever', inputs: { DO: body(...bs) } }),
  wait: (s) => ({ type: 'tsim_wait', inputs: { SEC: num(s) } }),
  motor: (d, s) => ({ type: 'tsim_motor', fields: { DEV: d }, inputs: { SPEED: val(s) } }),
  stop: (d) => ({ type: 'tsim_motor_stop', fields: { DEV: d } }),
  stopAll: () => ({ type: 'tsim_motor_all_stop' }),
  servo: (d, a) => ({ type: 'tsim_servo', fields: { DEV: d }, inputs: { ANGLE: val(a) } }),
  slide: (d, a) => ({ type: 'tsim_slide', fields: { DEV: d }, inputs: { POS: val(a) } }),
  led: (d, on) => ({ type: 'tsim_led', fields: { DEV: d, STATE: on ? 'ON' : 'OFF' } }),
  color: (d, c) => ({ type: 'tsim_led_color', fields: { DEV: d, COLOR: c } }),
  tone: (d, n, s) => ({ type: 'tsim_tone', fields: { DEV: d, NOTE: n }, inputs: { SEC: num(s) } }),
  lcd: (d, line, t) => ({ type: 'tsim_lcd', fields: { DEV: d, LINE: String(line) }, inputs: { TEXT: val(t) } }),
  lcdClear: (d) => ({ type: 'tsim_lcd_clear', fields: { DEV: d } }),
  button: (d) => ({ type: 'tsim_button', fields: { DEV: d } }),
  distance: (d) => ({ type: 'tsim_distance', fields: { DEV: d } }),
  line: (d) => ({ type: 'tsim_line', fields: { DEV: d } }),
  cmp: (a, op, b) => ({ type: 'logic_compare', fields: { OP: op }, inputs: { A: val(a), B: val(b) } }),
  not: (a) => ({ type: 'logic_negate', inputs: { BOOL: { block: a } } }),
  repeat: (n, ...bs) => ({ type: 'controls_repeat_ext', inputs: { TIMES: num(n), DO: body(...bs) } }),
  // ifs: [[조건, [블록들]], ...], els: [블록들]
  if: (ifs, els) => {
    const b = { type: 'controls_if', inputs: {} };
    ifs.forEach(([c, bs], i) => { b.inputs['IF' + i] = { block: c }; const d = body(...bs); if (d) b.inputs['DO' + i] = d; });
    const st = {};
    if (ifs.length > 1) st.elseIfCount = ifs.length - 1;
    if (els) { st.hasElse = true; const d = body(...els); if (d) b.inputs.ELSE = d; }
    if (Object.keys(st).length) b.extraState = st;
    return b;
  },
  set: (v, x) => ({ type: 'variables_set', fields: { VAR: { id: v } }, inputs: { VALUE: val(x) } }),
  get: (v) => ({ type: 'variables_get', fields: { VAR: { id: v } } }),
  change: (v, d) => ({ type: 'math_change', fields: { VAR: { id: v } }, inputs: { DELTA: num(d) } }),
  join: (a, b) => ({ type: 'text_join', extraState: { itemCount: 2 }, inputs: { ADD0: val(a), ADD1: val(b) } }),
};
function code(p, tops, vars = []) {
  p.code.blockly = { blocks: { languageVersion: 0, blocks: tops }, variables: vars.map(([id, name]) => ({ name, id })) };
}

// ---------- 공통 부품 ----------
function carBody(p, name = '자동차 몸통', color = '#3b82f6') {
  return struct(p, name, '🚙', [
    S('box', [0, 45, 0], [150, 30, 70], color),
    S('box', [-10, 72.5, 0], [70, 25, 60], '#e0f2fe'),
    S('box', [-10, 86, 0], [74, 3, 64], color),
    S('box', [74, 50, 22], [4, 8, 14], '#fde047'),
    S('box', [74, 50, -22], [4, 8, 14], '#fde047'),
  ]);
}
function wheelBlock(p) {
  const w = lib(p, 'wheel', '바퀴');
  return block(p, { name: '바퀴 블럭', icon: '🛞', component: 'dc', motion: 'spin', partId: w, allowChildren: false });
}
function fourWheels(p, rid, wb, { x = 45, y = 40, z = 35 } = {}) {
  return {
    lf: inst(p, { name: '왼앞바퀴', blockId: wb, robotId: rid, pos: [x, y, -z], normal: [0, 0, -1] }),
    rf: inst(p, { name: '오른앞바퀴', blockId: wb, robotId: rid, pos: [x, y, z], normal: [0, 0, 1] }),
    lb: inst(p, { name: '왼뒤바퀴', blockId: wb, robotId: rid, pos: [-x, y, -z], normal: [0, 0, -1] }),
    rb: inst(p, { name: '오른뒤바퀴', blockId: wb, robotId: rid, pos: [-x, y, z], normal: [0, 0, 1] }),
  };
}
const drive = (w, l, r) => [B.motor(w.lf, l), B.motor(w.lb, l), B.motor(w.rf, r), B.motor(w.rb, r)];

// ======================================================================
export const EXAMPLES = [
  {
    id: 'car', icon: '🚗', name: '네 바퀴 자동차', level: 1, parts: ['DC 모터 ×4'],
    desc: '바퀴 블럭 4개를 붙인 자동차가 앞으로 가고, 돌고, 뒤로 가요.',
    build() {
      const p = mk('네 바퀴 자동차', '🚗');
      const body = carBody(p);
      const wb = wheelBlock(p);
      const r = robot(p, { name: '자동차', baseId: body });
      const w = fourWheels(p, r, wb);
      code(p, [B.start(30, 30,
        drive(w, 100, 100), B.wait(2),
        drive(w, 80, -80), B.wait(1),
        drive(w, 100, 100), B.wait(2),
        drive(w, -60, -60), B.wait(1.5),
        B.stopAll())]);
      return p;
    },
  },
  {
    id: 'arm', icon: '🦾', name: '3관절 로봇팔', level: 2, parts: ['서보 ×3'],
    desc: '돌림판·어깨·팔꿈치 서보 블럭을 이어 붙여 물건을 집는 것처럼 움직여요.',
    build() {
      const p = mk('3관절 로봇팔', '🦾');
      const base = struct(p, '로봇팔 받침대', '⚪', [S('cylinder', [0, 10, 0], [130, 20, 130], '#64748b'), S('cylinder', [0, 21, 0], [90, 2, 90], '#facc15')]);
      const disc = struct(p, '돌림판', '💿', [S('cylinder', [0, 4, 0], [80, 8, 80], '#ec4899')]);
      const arm = lib(p, 'arm', '긴 팔');
      const sarm = lib(p, 'shortarm', '짧은 팔');
      const grip = lib(p, 'gripper', '집게 손');
      const bTurn = block(p, { name: '허리 블럭', icon: '🧭', component: 'servo', motion: 'turn', partId: disc, allowChildren: true });
      const bArm = block(p, { name: '어깨 블럭', icon: '💪', component: 'servo', motion: 'swing', partId: arm, allowChildren: true });
      const bElb = block(p, { name: '팔꿈치 블럭', icon: '💪', component: 'servo', motion: 'swing', partId: sarm, allowChildren: true });
      const bGrip = block(p, { name: '집게 블럭', icon: '🤏', component: 'none', partId: grip, allowChildren: false });
      const r = robot(p, { name: '로봇팔', baseId: base });
      const waist = inst(p, { name: '허리', blockId: bTurn, robotId: r, pos: [0, 22, 0], normal: [0, 1, 0] });
      const sh = inst(p, { name: '어깨', blockId: bArm, robotId: r, parentId: waist, pos: [0, 8, 0], normal: [0, 1, 0] });
      const el = inst(p, { name: '팔꿈치', blockId: bElb, robotId: r, parentId: sh, pos: [0, 80, 0], normal: [0, 1, 0], scale: 0.8 });
      inst(p, { name: '집게', blockId: bGrip, robotId: r, parentId: el, pos: [0, 50, 0], normal: [0, 1, 0] });
      code(p, [B.start(30, 30,
        B.servo(waist, 90), B.servo(sh, 90), B.servo(el, 90), B.wait(1),
        B.repeat(3,
          B.servo(waist, 40), B.wait(0.8),
          B.servo(sh, 40), B.servo(el, 50), B.wait(1),
          B.servo(sh, 90), B.servo(el, 90), B.wait(0.8),
          B.servo(waist, 140), B.wait(0.8),
          B.servo(sh, 50), B.servo(el, 40), B.wait(1),
          B.servo(sh, 90), B.servo(el, 90), B.wait(0.8)),
        B.servo(waist, 90))]);
      return p;
    },
  },
  {
    id: 'traffic', icon: '🚦', name: '신호등', level: 1, parts: ['LED ×3'],
    desc: '빨강 → 초록 → 노랑 순서로 불이 계속 바뀌어요.',
    build() {
      const p = mk('신호등', '🚦');
      const base = struct(p, '신호등 기둥', '🚦', [
        S('box', [0, 5, 0], [70, 10, 70], '#475569'),
        S('cylinder', [0, 75, 0], [14, 140, 14], '#94a3b8'),
        S('box', [0, 190, 0], [40, 110, 40], '#1f2937'),
        S('box', [22, 233, 0], [6, 3, 30], '#111827'),
        S('box', [22, 203, 0], [6, 3, 30], '#111827'),
        S('box', [22, 173, 0], [6, 3, 30], '#111827'),
      ]);
      const lb = block(p, { name: 'LED 블럭', icon: '💡', component: 'led' });
      const r = robot(p, { name: '신호등', baseId: base, rotY: -40 });
      const red = inst(p, { name: '빨간불', blockId: lb, robotId: r, pos: [20, 220, 0], normal: [1, 0, 0], scale: 2.6 });
      const yel = inst(p, { name: '노란불', blockId: lb, robotId: r, pos: [20, 190, 0], normal: [1, 0, 0], scale: 2.6 });
      const grn = inst(p, { name: '초록불', blockId: lb, robotId: r, pos: [20, 160, 0], normal: [1, 0, 0], scale: 2.6 });
      code(p, [B.start(30, 30, B.forever(
        B.color(red, '빨강'), B.wait(3), B.led(red, false),
        B.color(grn, '초록'), B.wait(3), B.led(grn, false),
        B.color(yel, '노랑'), B.wait(1), B.led(yel, false)))]);
      return p;
    },
  },
  {
    id: 'fan', icon: '🌀', name: '버튼 선풍기', level: 2, parts: ['DC 모터', '버튼', 'LED'],
    desc: '버튼을 누를 때마다 선풍기가 켜지고 꺼져요. (화면의 빨간 버튼을 클릭!)',
    build() {
      const p = mk('버튼 선풍기', '🌀');
      const base = struct(p, '선풍기 몸', '🌀', [
        S('cylinder', [0, 7.5, 0], [110, 15, 110], '#f8fafc'),
        S('cylinder', [0, 80, 0], [16, 130, 16], '#cbd5e1'),
        S('box', [0, 160, 0], [40, 34, 34], '#e2e8f0'),
      ]);
      const prop = lib(p, 'propeller', '날개');
      const fb = block(p, { name: '날개 블럭', icon: '🌀', component: 'dc', motion: 'spin', partId: prop });
      const bb = block(p, { name: '버튼 블럭', icon: '🔘', component: 'button' });
      const lb = block(p, { name: 'LED 블럭', icon: '💡', component: 'led' });
      const r = robot(p, { name: '선풍기', baseId: base, rotY: -35 });
      const fan = inst(p, { name: '날개', blockId: fb, robotId: r, pos: [20, 160, 0], normal: [1, 0, 0], scale: 1.3 });
      const btn = inst(p, { name: '버튼', blockId: bb, robotId: r, pos: [35, 15, 0], normal: [0, 1, 0], scale: 1.6 });
      const led = inst(p, { name: '불빛', blockId: lb, robotId: r, pos: [35, 15, 25], normal: [0, 1, 0], scale: 1.5 });
      const on = 'v_on';
      code(p, [B.start(30, 30, B.set(on, 0), B.forever(
        B.if([[B.button(btn), [
          B.if([[B.cmp(B.get(on), 'EQ', 0), [B.set(on, 1), B.motor(fan, 100), B.color(led, '초록')]]], [B.set(on, 0), B.stop(fan), B.led(led, false)]),
          B.wait(0.4)]]])))], [[on, '켜짐']]);
      return p;
    },
  },
  {
    id: 'gate', icon: '🚧', name: '주차 차단기', level: 3, parts: ['서보', '거리 센서', 'DC 모터 ×4'],
    desc: '자동차가 다가오면 거리 센서가 알아채고 차단봉이 올라가요. 로봇 2개가 함께 움직여요!',
    build() {
      const p = mk('주차 차단기', '🚧', { stage: 'road' });
      const post = struct(p, '차단기 기둥', '🟨', [S('box', [0, 20, 0], [40, 40, 40], '#facc15'), S('box', [0, 20, 0], [42, 8, 42], '#111827')]);
      const bar = lib(p, 'bar', '차단봉');
      const gb = block(p, { name: '차단봉 블럭', icon: '🚧', component: 'servo', motion: 'swing', partId: bar, compScale: 0.5 });
      const db = block(p, { name: '거리센서 블럭', icon: '📏', component: 'distance' });
      const gate = robot(p, { name: '차단기', baseId: post, pos: [150, -130] });
      const arm = inst(p, { name: '차단봉', blockId: gb, robotId: gate, pos: [0, 40, 0], normal: [0, 1, 0] });
      const sonar = inst(p, { name: '거리센서', blockId: db, robotId: gate, pos: [-10, 25, 20], normal: [0, 0, 1], scale: 0.7 });
      const body = carBody(p, '자동차 몸통', '#ef4444');
      const wb = wheelBlock(p);
      const car = robot(p, { name: '자동차', baseId: body, pos: [-380, 0] });
      const w = fourWheels(p, car, wb);
      code(p, [
        B.start(30, 30, B.servo(arm, 180), B.forever(
          B.if([[B.cmp(B.distance(sonar), 'LT', 20), [B.servo(arm, 90), B.wait(2)]]], [B.servo(arm, 180)]))),
        B.start(30, 330, B.wait(1), drive(w, 50, 50), B.wait(7), B.stopAll()),
      ]);
      return p;
    },
  },
  {
    id: 'avoid', icon: '🤖', name: '장애물 피하는 자동차', level: 3, parts: ['DC 모터 ×4', '거리 센서'],
    desc: '앞에 벽이 가까워지면 뒤로 갔다가 방향을 바꿔요. 방 안을 혼자 돌아다녀요.',
    build() {
      const p = mk('장애물 피하는 자동차', '🤖', { stage: 'room' });
      const body = carBody(p, '자동차 몸통', '#22c55e');
      const wb = wheelBlock(p);
      const db = block(p, { name: '거리센서 블럭', icon: '📏', component: 'distance' });
      const r = robot(p, { name: '자동차', baseId: body });
      const w = fourWheels(p, r, wb);
      const s = inst(p, { name: '거리센서', blockId: db, robotId: r, pos: [75, 45, 0], normal: [1, 0, 0] });
      code(p, [B.start(30, 30, B.forever(
        B.if([[B.cmp(B.distance(s), 'LT', 15), [drive(w, -60, -60), B.wait(0.6), drive(w, 70, -70), B.wait(0.7)]]],
          [drive(w, 70, 70)])))]);
      return p;
    },
  },
  {
    id: 'carousel', icon: '🎠', name: '회전목마', level: 2, parts: ['DC 모터', 'LED ×2', '버저'],
    desc: '돌아가는 판 위에 목마 블럭을 붙였어요. 붙인 블럭도 판과 함께 돌아요.',
    build() {
      const p = mk('회전목마', '🎠');
      const base = struct(p, '회전목마 바닥', '🎪', [S('cylinder', [0, 10, 0], [220, 20, 220], '#f9a8d4'), S('cylinder', [0, 21, 0], [60, 2, 60], '#facc15')]);
      const disc = struct(p, '회전판', '💿', [S('cylinder', [0, 4, 0], [180, 8, 180], '#a78bfa'), S('cylinder', [0, 40, 0], [10, 72, 10], '#facc15'), S('cone', [0, 96, 0], [120, 40, 120], '#ef4444')]);
      const horse = lib(p, 'horse', '목마');
      const tb = block(p, { name: '회전판 블럭', icon: '🎠', component: 'dc', motion: 'spin', partId: disc, allowChildren: true, compScale: 0.5 });
      const hb = block(p, { name: '목마 블럭', icon: '🐴', component: 'none', partId: horse });
      const lb = block(p, { name: 'LED 블럭', icon: '💡', component: 'led' });
      const zb = block(p, { name: '버저 블럭', icon: '🎵', component: 'buzzer' });
      const r = robot(p, { name: '회전목마', baseId: base });
      const t = inst(p, { name: '회전판', blockId: tb, robotId: r, pos: [0, 22, 0], normal: [0, 1, 0] });
      [[60, 0, 0], [-60, 0, 180], [0, 60, 90], [0, -60, 270]].forEach(([x, z, sp], k) => inst(p, { name: '목마' + (k + 1), blockId: hb, robotId: r, parentId: t, pos: [x, 8, z], normal: [0, 1, 0], spin: sp }));
      const l1 = inst(p, { name: '불빛1', blockId: lb, robotId: r, pos: [95, 20, 0], normal: [0, 1, 0], scale: 2 });
      const l2 = inst(p, { name: '불빛2', blockId: lb, robotId: r, pos: [-95, 20, 0], normal: [0, 1, 0], scale: 2 });
      const bz = inst(p, { name: '버저', blockId: zb, robotId: r, pos: [0, 20, 95], normal: [0, 1, 0], scale: 1.5 });
      code(p, [B.start(30, 30, B.motor(t, 35), B.forever(
        B.color(l1, '노랑'), B.led(l2, false), B.tone(bz, '도', 0.3), B.tone(bz, '미', 0.3),
        B.color(l2, '보라'), B.led(l1, false), B.tone(bz, '솔', 0.3), B.tone(bz, '미', 0.3)))]);
      return p;
    },
  },
  {
    id: 'elevator', icon: '🛗', name: '엘리베이터', level: 2, parts: ['밀기 모터', '버튼 ×2', 'LCD'],
    desc: '1층·2층 버튼을 누르면 엘리베이터 칸이 위아래로 움직이고 화면에 층이 보여요.',
    build() {
      const p = mk('엘리베이터', '🛗');
      const tower = struct(p, '엘리베이터 탑', '🏢', [
        S('box', [0, 5, 0], [160, 10, 110], '#94a3b8'),
        S('box', [0, 125, -50], [160, 230, 10], '#e2e8f0'),
        S('box', [-75, 125, -25], [10, 230, 40], '#cbd5e1'),
        S('box', [75, 125, -25], [10, 230, 40], '#cbd5e1'),
        S('box', [0, 245, -25], [160, 10, 60], '#94a3b8'),
        S('box', [0, 266, -28], [100, 32, 6], '#1e3a8a'),
      ]);
      const cabin = lib(p, 'cabin', '엘리베이터 칸');
      const eb = block(p, { name: '엘리베이터 블럭', icon: '🛗', component: 'linear', motion: 'slide', partId: cabin, compScale: 2 });
      const bb = block(p, { name: '버튼 블럭', icon: '🔘', component: 'button' });
      const cb = block(p, { name: 'LCD 블럭', icon: '📟', component: 'lcd' });
      const r = robot(p, { name: '엘리베이터', baseId: tower, rotY: -25 });
      const lift = inst(p, { name: '엘리베이터', blockId: eb, robotId: r, pos: [0, 10, 0], normal: [0, 1, 0] });
      const b1 = inst(p, { name: '1층버튼', blockId: bb, robotId: r, pos: [-55, 10, 40], normal: [0, 1, 0], scale: 1.5 });
      const b2 = inst(p, { name: '2층버튼', blockId: bb, robotId: r, pos: [-30, 10, 40], normal: [0, 1, 0], scale: 1.5 });
      const lcd = inst(p, { name: '층표시', blockId: cb, robotId: r, pos: [0, 266, -25], normal: [0, 0, 1], scale: 0.75 });
      code(p, [B.start(30, 30, B.slide(lift, 0), B.lcd(lcd, 1, 'Elevator'), B.lcd(lcd, 2, 'Floor 1'), B.forever(
        B.if([[B.button(b2), [B.lcd(lcd, 2, 'Going up...'), B.slide(lift, 100), B.wait(1.3), B.lcd(lcd, 2, 'Floor 2')]],
          [B.button(b1), [B.lcd(lcd, 2, 'Going down...'), B.slide(lift, 0), B.wait(1.3), B.lcd(lcd, 2, 'Floor 1')]]])))]);
      return p;
    },
  },
  {
    id: 'sign', icon: '📟', name: '숫자 세는 전광판', level: 2, parts: ['LCD', '버튼'],
    desc: '버튼을 누를 때마다 숫자가 1씩 올라가서 LCD 화면에 보여요. 변수를 배워요.',
    build() {
      const p = mk('숫자 세는 전광판', '📟', { board: 'microbit' });
      const st = struct(p, '전광판', '🪧', [
        S('box', [0, 3, 0], [150, 6, 60], '#334155'),
        S('box', [-50, 30, -10], [10, 50, 10], '#64748b'),
        S('box', [50, 30, -10], [10, 50, 10], '#64748b'),
        S('box', [0, 90, -10], [130, 70, 12], '#1e3a8a'),
      ]);
      const cb = block(p, { name: 'LCD 블럭', icon: '📟', component: 'lcd' });
      const bb = block(p, { name: '버튼 블럭', icon: '🔘', component: 'button' });
      const r = robot(p, { name: '전광판', baseId: st, rotY: -20 });
      const lcd = inst(p, { name: '화면', blockId: cb, robotId: r, pos: [0, 90, -4], normal: [0, 0, 1], scale: 1.4 });
      const btn = inst(p, { name: '버튼', blockId: bb, robotId: r, pos: [45, 6, 15], normal: [0, 1, 0], scale: 1.8 });
      const n = 'v_count';
      code(p, [B.start(30, 30, B.set(n, 0), B.lcd(lcd, 1, 'Hello TinkerSim'), B.lcd(lcd, 2, B.join('Count: ', B.get(n))), B.forever(
        B.if([[B.button(btn), [B.change(n, 1), B.lcd(lcd, 2, B.join('Count: ', B.get(n))), B.wait(0.3)]]])))], [[n, '숫자']]);
      return p;
    },
  },
  {
    id: 'hello', icon: '👋', name: '인사하는 로봇', level: 2, parts: ['서보 ×2', 'LED ×2', '버저'],
    desc: '눈에 불이 켜지고 "도미솔" 소리를 내며 팔을 흔들어 인사해요.',
    build() {
      const p = mk('인사하는 로봇', '👋');
      const st = struct(p, '로봇 몸', '🤖', [
        S('box', [-15, 10, 0], [18, 20, 30], '#475569'),
        S('box', [15, 10, 0], [18, 20, 30], '#475569'),
        S('box', [0, 55, 0], [60, 70, 40], '#cbd5e1'),
        S('box', [0, 108, 0], [44, 36, 36], '#e2e8f0'),
        S('cylinder', [0, 132, 0], [4, 14, 4], '#64748b'),
        S('sphere', [0, 141, 0], [9, 9, 9], '#ef4444'),
        S('box', [0, 98, 18.5], [20, 4, 2], '#334155'),
      ]);
      const arm = lib(p, 'arm', '로봇 팔', (sh) => sh.forEach((s) => { s.color = '#60a5fa'; }));
      const ab = block(p, { name: '팔 블럭', icon: '💪', component: 'servo', motion: 'swing', partId: arm, compScale: 0.7 });
      const lb = block(p, { name: 'LED 블럭', icon: '💡', component: 'led' });
      const zb = block(p, { name: '버저 블럭', icon: '🎵', component: 'buzzer' });
      const r = robot(p, { name: '로봇', baseId: st });
      const la = inst(p, { name: '왼팔', blockId: ab, robotId: r, pos: [30, 75, 0], normal: [1, 0, 0] });
      const ra = inst(p, { name: '오른팔', blockId: ab, robotId: r, pos: [-30, 75, 0], normal: [-1, 0, 0] });
      const le = inst(p, { name: '왼눈', blockId: lb, robotId: r, pos: [10, 112, 18], normal: [0, 0, 1], scale: 1.4 });
      const re = inst(p, { name: '오른눈', blockId: lb, robotId: r, pos: [-10, 112, 18], normal: [0, 0, 1], scale: 1.4 });
      const bz = inst(p, { name: '버저', blockId: zb, robotId: r, pos: [0, 40, 20], normal: [0, 0, 1] });
      code(p, [B.start(30, 30,
        B.servo(la, 180), B.servo(ra, 180), B.wait(0.5),
        B.color(le, '파랑'), B.color(re, '파랑'),
        B.tone(bz, '도', 0.25), B.tone(bz, '미', 0.25), B.tone(bz, '솔', 0.4),
        B.repeat(4, B.servo(ra, 10), B.wait(0.35), B.servo(ra, 50), B.wait(0.35)),
        B.servo(la, 0), B.servo(ra, 0), B.tone(bz, '높은도', 0.6), B.wait(0.6),
        B.servo(la, 180), B.servo(ra, 180), B.led(le, false), B.led(re, false))]);
      return p;
    },
  },
  {
    id: 'liner', icon: '〰️', name: '라인트레이서', level: 3, parts: ['DC 모터 ×4', '라인 센서 ×2'],
    desc: '바닥 아래를 보는 라인 센서 2개로 검은 선을 따라 트랙을 계속 달려요.',
    build() {
      const p = mk('라인트레이서', '〰️', { stage: 'line' });
      const body = carBody(p, '자동차 몸통', '#f97316');
      const wb = wheelBlock(p);
      const lsb = block(p, { name: '라인센서 블럭', icon: '⚫', component: 'line' });
      const r = robot(p, { name: '라인트레이서', baseId: body, pos: [0, 250] });
      const w = fourWheels(p, r, wb);
      const L = inst(p, { name: '왼쪽센서', blockId: lsb, robotId: r, pos: [65, 30, -15], normal: [0, -1, 0], scale: 0.8 });
      const R = inst(p, { name: '오른쪽센서', blockId: lsb, robotId: r, pos: [65, 30, 15], normal: [0, -1, 0], scale: 0.8 });
      code(p, [B.start(30, 30, B.forever(
        B.if([[B.line(L), [drive(w, 5, 55)]], [B.line(R), [drive(w, 55, 5)]]], [drive(w, 45, 45)])))]);
      return p;
    },
  },
  {
    id: 'piano', icon: '🎹', name: '멜로디 상자', level: 1, parts: ['버튼 ×4', '버저', 'LED'],
    desc: '버튼 4개를 누르면 도·레·미·파 소리가 나요. 나만의 노래를 연주해 보세요.',
    build() {
      const p = mk('멜로디 상자', '🎹', { board: 'pico' });
      const st = struct(p, '피아노 상자', '🎹', [
        S('box', [0, 15, 0], [200, 30, 90], '#fef3c7'),
        S('box', [0, 31, 15], [180, 2, 40], '#ffffff'),
        S('box', [0, 31, -28], [180, 2, 16], '#1f2937'),
      ]);
      const bb = block(p, { name: '버튼 블럭', icon: '🔘', component: 'button' });
      const zb = block(p, { name: '버저 블럭', icon: '🎵', component: 'buzzer' });
      const lb = block(p, { name: 'LED 블럭', icon: '💡', component: 'led' });
      const r = robot(p, { name: '멜로디 상자', baseId: st, rotY: 0 });
      const keys = ['도', '레', '미', '파'].map((k, i) => inst(p, { name: k + '버튼', blockId: bb, robotId: r, pos: [-60 + i * 40, 32, 15], normal: [0, 1, 0], scale: 2 }));
      const bz = inst(p, { name: '버저', blockId: zb, robotId: r, pos: [-40, 32, -28], normal: [0, 1, 0], scale: 1.5 });
      const led = inst(p, { name: '불빛', blockId: lb, robotId: r, pos: [40, 32, -28], normal: [0, 1, 0], scale: 2 });
      code(p, [B.start(30, 30, B.forever(
        B.if(['도', '레', '미', '파'].map((n, i) => [B.button(keys[i]), [B.color(led, ['빨강', '주황', '노랑', '초록'][i]), B.tone(bz, n, 0.25)]]), [B.led(led, false)])))]);
      return p;
    },
  },
  {
    id: 'heli', icon: '🚁', name: '헬리콥터', level: 1, parts: ['DC 모터 ×2', 'LED'],
    desc: '위쪽 큰 날개와 꼬리 날개가 빙글빙글 돌고 불빛이 깜빡여요.',
    build() {
      const p = mk('헬리콥터', '🚁', { board: 'esp32' });
      const st = struct(p, '헬리콥터 몸', '🚁', [
        S('sphere', [0, 50, 0], [90, 60, 60], '#f59e0b'),
        S('box', [-80, 55, 0], [90, 12, 12], '#f59e0b'),
        S('box', [-125, 65, 0], [14, 30, 6], '#f59e0b'),
        S('box', [0, 10, 25], [100, 6, 6], '#334155'),
        S('box', [0, 10, -25], [100, 6, 6], '#334155'),
        S('box', [20, 18, 25], [6, 14, 6], '#334155'),
        S('box', [20, 18, -25], [6, 14, 6], '#334155'),
        S('box', [-20, 18, 25], [6, 14, 6], '#334155'),
        S('box', [-20, 18, -25], [6, 14, 6], '#334155'),
        S('sphere', [25, 58, 0], [50, 36, 44], '#bae6fd'),
      ]);
      const big = lib(p, 'propeller', '큰 날개', (sh) => sh.forEach((s, i) => { if (i) s.size = [190, 3, 16]; }));
      const small = lib(p, 'propeller', '꼬리 날개');
      const b1 = block(p, { name: '큰 날개 블럭', icon: '🌀', component: 'dc', motion: 'spin', partId: big, compScale: 0.45 });
      const b2 = block(p, { name: '꼬리 날개 블럭', icon: '🌀', component: 'dc', motion: 'spin', partId: small, compScale: 0.6 });
      const lb = block(p, { name: 'LED 블럭', icon: '💡', component: 'led' });
      const r = robot(p, { name: '헬리콥터', baseId: st, rotY: 20 });
      const m1 = inst(p, { name: '큰날개', blockId: b1, robotId: r, pos: [0, 80, 0], normal: [0, 1, 0] });
      const m2 = inst(p, { name: '꼬리날개', blockId: b2, robotId: r, pos: [-125, 70, 3], normal: [0, 0, 1], scale: 0.6 });
      const led = inst(p, { name: '불빛', blockId: lb, robotId: r, pos: [-132, 75, 0], normal: [-1, 0, 0], scale: 1.5 });
      code(p, [B.start(30, 30, B.motor(m1, 30), B.motor(m2, 40), B.wait(1), B.motor(m1, 100), B.motor(m2, 100),
        B.forever(B.color(led, '빨강'), B.wait(0.3), B.led(led, false), B.wait(0.3)))]);
      return p;
    },
  },
];
