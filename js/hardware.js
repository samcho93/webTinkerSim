// 실제 보드와 실시간 연결 (웹 시리얼: 크롬/엣지 브라우저만 있으면 돼요)
import { assignPins } from './boards.js';
import { NOTES } from './codegen.js';
import { Emitter } from './util.js';

const pinNum = (p) => {
  if (p == null) return -1;
  if (/^A\d$/.test(p)) return 14 + Number(p[1]);
  if (/^pin\d+$/.test(p)) return Number(p.slice(3));
  return Number(p);
};

export class Hardware extends Emitter {
  constructor(world) {
    super();
    this.world = world;
    this.port = null;
    this.writer = null;
    this.connected = false;
    world.on('output', (type, io, args) => this.onOutput(type, io, args));
  }

  get supported() { return 'serial' in navigator; }

  async connect(project) {
    if (!this.supported) throw new Error('이 브라우저는 보드 연결을 지원하지 않아요. 크롬 또는 엣지를 사용해 주세요.');
    this.project = project;
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 115200 });
    this.writer = this.port.writable.getWriter();
    this.connected = true;
    this.readLoop();
    this.emit('status', true);
    await new Promise((r) => setTimeout(r, 1800)); // 보드가 다시 켜지는 시간
    this.setupInputs();
  }

  async disconnect() {
    this.connected = false;
    try { this.reader && await this.reader.cancel(); } catch (e) { /**/ }
    try { this.writer && this.writer.releaseLock(); } catch (e) { /**/ }
    try { this.port && await this.port.close(); } catch (e) { /**/ }
    this.port = null;
    this.emit('status', false);
  }

  pins() { return assignPins(this.project); }

  setupInputs() {
    const pins = this.pins();
    for (const [id, r] of Object.entries(pins)) if (r.comp === 'button') this.send(`I ${pinNum(r.pins[0])}`);
  }

  async send(line) {
    if (!this.connected || !this.writer) return;
    try { await this.writer.write(new TextEncoder().encode(line + '\n')); this.emit('log', '→ ' + line); } catch (e) { console.warn(e); }
  }

  onOutput(type, io, args) {
    if (!this.connected) return;
    const r = this.pins()[io.data.id];
    if (!r) return;
    const p = r.pins.map(pinNum);
    const sign = (io.dirSign || 1) * (io.data.reverse ? -1 : 1);
    if (type === 'motor') this.send(`M ${p[0]} ${p[1]} ${Math.round(Number(args[0]) * sign)}`);
    else if (type === 'servo') this.send(`S ${p[0]} ${Math.round(io.data.reverse ? 180 - args[0] : args[0])}`);
    else if (type === 'slide') this.send(`S ${p[0]} ${Math.round(Number(args[0]) * 1.8)}`);
    else if (type === 'led') this.send(`D ${p[0]} ${args[0] ? 1 : 0}`);
    else if (type === 'ledColor') this.send(`D ${p[0]} 1`);
    else if (type === 'lcd') this.send(`L ${r.addr} ${args[0]} ${String(args[1]).replace(/[^\x20-\x7e]/g, '?').slice(0, 16)}`);
    else if (type === 'lcdClear') this.send(`C ${r.addr}`);
  }

  tone(io, freq, sec) {
    if (!this.connected) return;
    const r = this.pins()[io.data.id];
    if (r) this.send(`T ${pinNum(r.pins[0])} ${Math.round(freq)} ${Math.round(sec * 1000)}`);
  }

  async readLoop() {
    const dec = new TextDecoderStream();
    this.port.readable.pipeTo(dec.writable).catch(() => {});
    this.reader = dec.readable.getReader();
    let buf = '';
    try {
      while (this.connected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buf += value;
        let k;
        while ((k = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, k).trim();
          buf = buf.slice(k + 1);
          if (line) this.onLine(line);
        }
      }
    } catch (e) { /* 연결 끊김 */ }
    if (this.connected) this.disconnect();
  }

  onLine(line) {
    this.emit('log', '← ' + line);
    const m = line.match(/^B (\d+) ([01])/);
    if (m) {
      const pin = Number(m[1]);
      const pins = this.pins();
      for (const [id, r] of Object.entries(pins)) {
        if (r.comp === 'button' && pinNum(r.pins[0]) === pin) {
          const io = this.world.insts.get(id);
          if (io) io.state.hwPressed = m[2] === '1';
        }
      }
    }
  }
}

export { NOTES };

export const FIRMWARE_ARDUINO = `// 팅커심 실시간 연결 프로그램 (아두이노 우노 / ESP32)
// 한 번만 보드에 올려두면, 팅커심 화면에서 실행할 때 실제 부품도 같이 움직여요.
// LCD를 쓰려면 아래 USE_LCD 를 1로 바꾸고 LiquidCrystal I2C 라이브러리를 설치하세요.
#define USE_LCD 0
#if defined(ESP32)
#include <ESP32Servo.h>
#else
#include <Servo.h>
#endif
#if USE_LCD
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
#endif

Servo servos[8];
int servoPins[8];
int servoCount = 0;
int inPins[10];
int inLast[10];
int inCount = 0;
String buf = "";

Servo* getServo(int pin) {
  for (int i = 0; i < servoCount; i++) if (servoPins[i] == pin) return &servos[i];
  if (servoCount >= 8) return NULL;
  servoPins[servoCount] = pin;
  servos[servoCount].attach(pin);
  return &servos[servoCount++];
}

void handle(String s) {
  char c = s.charAt(0);
  int a = 0, b = 0, v = 0;
  char text[20] = "";
  if (c == 'M' && sscanf(s.c_str(), "M %d %d %d", &a, &b, &v) == 3) {
    pinMode(a, OUTPUT); pinMode(b, OUTPUT);
    v = constrain(v, -100, 100);
    int p = map(abs(v), 0, 100, 0, 255);
    if (v >= 0) { digitalWrite(b, LOW); analogWrite(a, p); }
    else { digitalWrite(b, HIGH); analogWrite(a, 255 - p); }
  } else if (c == 'S' && sscanf(s.c_str(), "S %d %d", &a, &v) == 2) {
    Servo* sv = getServo(a);
    if (sv) sv->write(constrain(v, 0, 180));
  } else if (c == 'D' && sscanf(s.c_str(), "D %d %d", &a, &v) == 2) {
    pinMode(a, OUTPUT); digitalWrite(a, v ? HIGH : LOW);
  } else if (c == 'T' && sscanf(s.c_str(), "T %d %d %d", &a, &b, &v) == 3) {
    tone(a, b, v);
  } else if (c == 'I' && sscanf(s.c_str(), "I %d", &a) == 1) {
    if (inCount < 10) { pinMode(a, INPUT_PULLUP); inPins[inCount] = a; inLast[inCount] = -1; inCount++; }
  }
#if USE_LCD
  else if (c == 'L') {
    int line = s.charAt(s.indexOf(' ', 2) + 1) - '0';
    String t = s.substring(s.indexOf(' ', s.indexOf(' ', 2) + 1) + 1) + "                ";
    lcd.setCursor(0, line - 1); lcd.print(t.substring(0, 16));
  } else if (c == 'C') { lcd.clear(); }
#endif
}

void setup() {
  Serial.begin(115200);
#if USE_LCD
  lcd.init(); lcd.backlight();
#endif
  Serial.println("TSIM READY");
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\\n') { handle(buf); buf = ""; }
    else if (ch != '\\r') buf += ch;
  }
  for (int i = 0; i < inCount; i++) {
    int v = digitalRead(inPins[i]);
    if (v != inLast[i]) {
      inLast[i] = v;
      Serial.print("B "); Serial.print(inPins[i]); Serial.print(" "); Serial.println(v == LOW ? 1 : 0);
    }
  }
}
`;

export const FIRMWARE_MICROBIT = `# 팅커심 실시간 연결 프로그램 (마이크로비트)
# python.microbit.org 에 붙여넣고 마이크로비트에 보내세요.
from microbit import *
import music
P = {0: pin0, 1: pin1, 2: pin2, 8: pin8, 12: pin12, 13: pin13, 14: pin14, 15: pin15, 16: pin16}
inputs = {}
uart.init(baudrate=115200)
display.show(Image.HAPPY)
buf = b''
def handle(s):
    a = s.split(' ')
    c = a[0]
    if c == 'M':
        pa, pb, v = P[int(a[1])], P[int(a[2])], max(-100, min(100, int(a[3])))
        d = int(abs(v) * 1023 / 100)
        if v >= 0:
            pb.write_digital(0); pa.write_analog(d)
        else:
            pb.write_digital(1); pa.write_analog(1023 - d)
    elif c == 'S':
        p = P[int(a[1])]
        p.set_analog_period(20)
        p.write_analog(int(26 + max(0, min(180, int(a[2]))) * 102 / 180))
    elif c == 'D':
        P[int(a[1])].write_digital(int(a[2]))
    elif c == 'T':
        music.pitch(int(a[2]), int(a[3]), P[int(a[1])], wait=False)
    elif c == 'I':
        p = P[int(a[1])]
        p.set_pull(p.PULL_UP)
        inputs[int(a[1])] = -1
while True:
    if uart.any():
        buf += uart.read()
        while b'\\n' in buf:
            line, buf = buf.split(b'\\n', 1)
            try:
                handle(str(line, 'utf-8').strip())
            except Exception:
                pass
    for k in inputs:
        v = 1 if P[k].read_digital() == 0 else 0
        if v != inputs[k]:
            inputs[k] = v
            uart.write('B %d %d\\n' % (k, v))
    sleep(5)
`;

export const FIRMWARE_PICO = `# 팅커심 실시간 연결 프로그램 (라즈베리파이 피코, MicroPython)
# Thonny 대신 웹 편집기(예: viper-ide.org)로 main.py 로 저장하세요.
import sys, select, time
from machine import Pin, PWM
pwms = {}
inputs = {}
def pwm(n, f=1000):
    if n not in pwms:
        pwms[n] = PWM(Pin(n)); pwms[n].freq(f)
    return pwms[n]
def handle(s):
    a = s.split(' ')
    c = a[0]
    if c == 'M':
        pa, pb, v = int(a[1]), int(a[2]), max(-100, min(100, int(a[3])))
        d = int(abs(v) * 65535 / 100)
        Pin(pb, Pin.OUT).value(0 if v >= 0 else 1)
        pwm(pa).duty_u16(d if v >= 0 else 65535 - d)
    elif c == 'S':
        p = pwm(int(a[1]), 50); p.freq(50)
        p.duty_u16(int(1638 + max(0, min(180, int(a[2]))) * 6553 / 180))
    elif c == 'D':
        Pin(int(a[1]), Pin.OUT).value(int(a[2]))
    elif c == 'T':
        p = pwm(int(a[1])); p.freq(int(a[2])); p.duty_u16(32768); time.sleep_ms(int(a[3])); p.duty_u16(0)
    elif c == 'I':
        inputs[int(a[1])] = [Pin(int(a[1]), Pin.IN, Pin.PULL_UP), -1]
poll = select.poll()
poll.register(sys.stdin, select.POLLIN)
buf = ''
while True:
    while poll.poll(0):
        ch = sys.stdin.read(1)
        if ch == '\\n':
            try:
                handle(buf.strip())
            except Exception:
                pass
            buf = ''
        else:
            buf += ch
    for k, it in inputs.items():
        v = 1 if it[0].value() == 0 else 0
        if v != it[1]:
            it[1] = v
            print('B %d %d' % (k, v))
    time.sleep_ms(5)
`;
