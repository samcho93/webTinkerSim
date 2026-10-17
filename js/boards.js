// 피지컬 컴퓨팅 보드 정보와 핀 자동 연결
import { P } from './project.js';
import { COMPONENTS } from './components.js';

export const BOARDS = {
  uno: {
    name: '아두이노 우노', icon: '🟦', lang: 'arduino', langName: '아두이노 (C/C++)',
    pwm: ['3', '5', '6', '9', '10', '11'], digital: ['2', '4', '7', '8', '12', '13', 'A0', 'A1', 'A2', 'A3'],
    i2c: 'SDA=A4, SCL=A5', serialHint: '아두이노 우노를 USB로 연결하세요',
  },
  esp32: {
    name: 'ESP32', icon: '🟩', lang: 'arduino', langName: '아두이노 (C/C++)',
    pwm: ['13', '12', '14', '27', '26', '25', '33', '32'], digital: ['15', '4', '16', '17', '18', '19', '23', '5', '34', '35'],
    i2c: 'SDA=21, SCL=22', serialHint: 'ESP32 보드를 USB로 연결하세요',
  },
  microbit: {
    name: '마이크로비트', icon: '🟨', lang: 'micropython', langName: '마이크로파이썬',
    pwm: ['pin0', 'pin1', 'pin2', 'pin8', 'pin12', 'pin13', 'pin14', 'pin15', 'pin16'], digital: [],
    i2c: 'SCL=P19, SDA=P20', serialHint: '마이크로비트를 USB로 연결하세요',
  },
  pico: {
    name: '라즈베리파이 피코', icon: '🟥', lang: 'micropython', langName: '마이크로파이썬',
    pwm: ['2', '3', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '26', '27', '28'], digital: [],
    i2c: 'SDA=GP4, SCL=GP5', serialHint: '피코를 USB로 연결하세요',
  },
};

// 부품마다 필요한 핀: p = PWM(세기 조절) 핀, d = 아무 핀
const NEED = {
  dc: ['p', 'd'], servo: ['d'], linear: ['d'], led: ['d'], buzzer: ['d'],
  button: ['d'], distance: ['d', 'd'], line: ['d'], lcd: [],
};
const PIN_NAMES = {
  dc: ['속도(PWM)', '방향'], servo: ['신호'], linear: ['신호'], led: ['+(긴 다리)'], buzzer: ['+'],
  button: ['신호'], distance: ['Trig', 'Echo'], line: ['OUT'], lcd: [],
};

export function pinLabel(boardId, pin) {
  if (boardId === 'microbit') return 'P' + pin.replace('pin', '');
  if (boardId === 'pico') return 'GP' + pin;
  return pin.startsWith('A') ? pin : 'D' + pin;
}

// 각 부품(인스턴스)에 핀을 자동으로 나눠 줍니다.
export function assignPins(project) {
  const b = BOARDS[project.board] || BOARDS.uno;
  const pwm = [...b.pwm];
  const dig = [...b.digital];
  const used = new Set();
  const result = {};
  const takeP = () => { const x = pwm.find((v) => !used.has(v)); if (x) used.add(x); return x; };
  const takeD = () => { let x = dig.find((v) => !used.has(v)); if (!x) x = pwm.slice().reverse().find((v) => !used.has(v)); if (x) used.add(x); return x; };
  let lcdIndex = 0;
  // PWM 이 꼭 필요한 DC 모터를 먼저 연결
  const order = [...project.instances].sort((a, c) => (P.compOf(project, a) === 'dc' ? -1 : 0) - (P.compOf(project, c) === 'dc' ? -1 : 0));
  for (const inst of order) {
    const comp = P.compOf(project, inst);
    if (!comp || comp === 'none') continue;
    const need = NEED[comp] || [];
    const pins = need.map((t) => (t === 'p' ? takeP() : takeD()));
    const r = { comp, pins, names: PIN_NAMES[comp], ok: pins.every(Boolean) };
    if (comp === 'lcd') { r.addr = 0x27 - lcdIndex++; r.ok = true; }
    result[inst.id] = r;
  }
  return result;
}

export function wiringRows(project) {
  const pins = assignPins(project);
  const b = BOARDS[project.board] || BOARDS.uno;
  return project.instances.filter((i) => pins[i.id]).map((i) => {
    const r = pins[i.id];
    const c = COMPONENTS[r.comp];
    let text;
    if (r.comp === 'lcd') text = `I2C (${b.i2c}), 주소 0x${r.addr.toString(16)}`;
    else text = r.pins.map((p, k) => `${r.names[k]} → ${p ? pinLabel(project.board, p) : '❌ 핀 부족'}`).join(',  ');
    return { icon: c.icon, name: i.name, comp: c.name, text, ok: r.ok };
  });
}
