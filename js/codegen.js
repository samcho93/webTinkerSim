// 블록 코딩: 블록 모양 정의 + 코드 만들기(시뮬레이션용 JS, 글 코드, 아두이노, 마이크로파이썬)
/* global Blockly */
import { P } from './project.js';
import { assignPins, BOARDS, pinLabel } from './boards.js';
import { LED_COLORS } from './components.js';

let getProject = () => null;
export function setProjectGetter(fn) { getProject = fn; }

const COL = { start: '#f59e0b', move: '#2563eb', out: '#d97706', screen: '#059669', sensor: '#dc2626', ctrl: '#7c3aed' };
export const NOTES = { 도: 262, 레: 294, 미: 330, 파: 349, 솔: 392, 라: 440, 시: 494, 높은도: 523 };
const COMP_KO = { dc: '모터', servo: '서보', linear: '밀기모터', led: 'LED', buzzer: '버저', lcd: 'LCD', button: '버튼', distance: '거리센서', line: '라인센서' };

function devOptions(comps) {
  return () => {
    const p = getProject();
    const list = p ? P.instsByComp(p, comps) : [];
    if (!list.length) return [[`(${COMP_KO[comps[0]]} 없음)`, '_none']];
    return list.map((i) => [i.name, i.id]);
  };
}
const dev = (comps) => new Blockly.FieldDropdown(devOptions(comps));

let defined = false;
export function defineBlocks() {
  if (defined) return;
  defined = true;
  const B = Blockly.Blocks;
  const def = (type, init) => { B[type] = { init }; };

  def('tsim_start', function () {
    this.appendDummyInput().appendField('▶ 시작하면');
    this.setNextStatement(true);
    this.setColour(COL.start);
    this.hat = 'cap';
    this.setTooltip('▶ 실행 버튼을 누르면 아래 블록들이 차례대로 실행돼요');
  });
  def('tsim_forever', function () {
    this.appendDummyInput().appendField('🔁 계속 반복하기');
    this.appendStatementInput('DO');
    this.setPreviousStatement(true);
    this.setColour(COL.ctrl);
    this.setTooltip('안에 있는 블록을 멈출 때까지 계속 반복해요');
  });
  def('tsim_wait', function () {
    this.appendValueInput('SEC').setCheck('Number').appendField('⏱️');
    this.appendDummyInput().appendField('초 기다리기');
    this.setInputsInline(true);
    this.setPreviousStatement(true); this.setNextStatement(true);
    this.setColour(COL.ctrl);
  });
  const stmt = (b, col) => { b.setInputsInline(true); b.setPreviousStatement(true); b.setNextStatement(true); b.setColour(col); };
  def('tsim_motor', function () {
    this.appendDummyInput().appendField('⚙️ 모터').appendField(dev(['dc']), 'DEV');
    this.appendValueInput('SPEED').setCheck('Number').appendField('속도');
    this.appendDummyInput().appendField('로 돌리기');
    stmt(this, COL.move);
    this.setTooltip('속도: -100(뒤로) ~ 100(앞으로)');
  });
  def('tsim_motor_stop', function () {
    this.appendDummyInput().appendField('⚙️ 모터').appendField(dev(['dc']), 'DEV').appendField('멈추기');
    stmt(this, COL.move);
  });
  def('tsim_motor_all_stop', function () {
    this.appendDummyInput().appendField('⚙️ 모든 모터 멈추기');
    stmt(this, COL.move);
  });
  def('tsim_servo', function () {
    this.appendDummyInput().appendField('🦾 서보').appendField(dev(['servo']), 'DEV');
    this.appendValueInput('ANGLE').setCheck('Number').appendField('각도');
    this.appendDummyInput().appendField('도로 움직이기');
    stmt(this, COL.move);
    this.setTooltip('각도: 0 ~ 180');
  });
  def('tsim_slide', function () {
    this.appendDummyInput().appendField('↕️ 밀기모터').appendField(dev(['linear']), 'DEV');
    this.appendValueInput('POS').setCheck('Number');
    this.appendDummyInput().appendField('% 위치로 움직이기');
    stmt(this, COL.move);
    this.setTooltip('0 = 다 당기기, 100 = 다 밀기');
  });
  def('tsim_led', function () {
    this.appendDummyInput().appendField('💡 LED').appendField(dev(['led']), 'DEV')
      .appendField(new Blockly.FieldDropdown([['켜기', 'ON'], ['끄기', 'OFF']]), 'STATE');
    stmt(this, COL.out);
  });
  def('tsim_led_color', function () {
    this.appendDummyInput().appendField('💡 LED').appendField(dev(['led']), 'DEV').appendField('을')
      .appendField(new Blockly.FieldDropdown(Object.keys(LED_COLORS).map((k) => [k, k])), 'COLOR').appendField('색으로 켜기');
    stmt(this, COL.out);
  });
  def('tsim_tone', function () {
    this.appendDummyInput().appendField('🎵 버저').appendField(dev(['buzzer']), 'DEV')
      .appendField(new Blockly.FieldDropdown(Object.keys(NOTES).map((k) => [k, k])), 'NOTE').appendField('음을');
    this.appendValueInput('SEC').setCheck('Number');
    this.appendDummyInput().appendField('초 울리기');
    stmt(this, COL.out);
  });
  def('tsim_lcd', function () {
    this.appendDummyInput().appendField('📟 LCD').appendField(dev(['lcd']), 'DEV')
      .appendField(new Blockly.FieldDropdown([['1', '1'], ['2', '2']]), 'LINE').appendField('번째 줄에');
    this.appendValueInput('TEXT');
    this.appendDummyInput().appendField('쓰기');
    stmt(this, COL.screen);
    this.setTooltip('LCD 화면에는 영어와 숫자만 보여요 (한 줄에 16칸)');
  });
  def('tsim_lcd_clear', function () {
    this.appendDummyInput().appendField('📟 LCD').appendField(dev(['lcd']), 'DEV').appendField('지우기');
    stmt(this, COL.screen);
  });
  const sensor = (b, type) => { b.setOutput(true, type); b.setColour(COL.sensor); b.setInputsInline(true); };
  def('tsim_button', function () {
    this.appendDummyInput().appendField('🔘 버튼').appendField(dev(['button']), 'DEV').appendField('눌렸나요?');
    sensor(this, 'Boolean');
  });
  def('tsim_distance', function () {
    this.appendDummyInput().appendField('📏 거리센서').appendField(dev(['distance']), 'DEV').appendField('거리(cm)');
    sensor(this, 'Number');
  });
  def('tsim_line', function () {
    this.appendDummyInput().appendField('⚫ 라인센서').appendField(dev(['line']), 'DEV').appendField('검은 선 위인가요?');
    sensor(this, 'Boolean');
  });
}

const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (t) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
export function toolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: '시작', colour: COL.start, contents: [
        { kind: 'block', type: 'tsim_start' },
        { kind: 'block', type: 'tsim_forever' },
        { kind: 'block', type: 'tsim_wait', inputs: { SEC: num(1) } },
      ] },
      { kind: 'category', name: '움직이기', colour: COL.move, contents: [
        { kind: 'block', type: 'tsim_motor', inputs: { SPEED: num(100) } },
        { kind: 'block', type: 'tsim_motor_stop' },
        { kind: 'block', type: 'tsim_motor_all_stop' },
        { kind: 'block', type: 'tsim_servo', inputs: { ANGLE: num(90) } },
        { kind: 'block', type: 'tsim_slide', inputs: { POS: num(100) } },
      ] },
      { kind: 'category', name: '빛과 소리', colour: COL.out, contents: [
        { kind: 'block', type: 'tsim_led' },
        { kind: 'block', type: 'tsim_led_color' },
        { kind: 'block', type: 'tsim_tone', inputs: { SEC: num(0.5) } },
      ] },
      { kind: 'category', name: '화면', colour: COL.screen, contents: [
        { kind: 'block', type: 'tsim_lcd', inputs: { TEXT: txt('Hello!') } },
        { kind: 'block', type: 'tsim_lcd_clear' },
      ] },
      { kind: 'category', name: '센서', colour: COL.sensor, contents: [
        { kind: 'block', type: 'tsim_button' },
        { kind: 'block', type: 'tsim_distance' },
        { kind: 'block', type: 'tsim_line' },
      ] },
      { kind: 'category', name: '조건', colour: '#5b67a5', contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'logic_compare', inputs: { A: num(0), B: num(10) } },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ] },
      { kind: 'category', name: '반복', colour: '#5ba55b', contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: num(4) } },
        { kind: 'block', type: 'controls_whileUntil' },
      ] },
      { kind: 'category', name: '계산', colour: '#5b80a5', contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: num(1), B: num(1) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: num(1), TO: num(10) } },
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
      ] },
      { kind: 'category', name: '변수', colour: '#a55b80', custom: 'VARIABLE' },
    ],
  };
}

// ======================================================================
// 1) 시뮬레이션/글 코드용 자바스크립트
// ======================================================================
export const TEXT_API = {
  motor: '모터', stop: '멈추기', stopAll: '모두멈추기', servo: '서보', slide: '밀기', led: 'LED', ledColor: 'LED색',
  tone: '소리', lcd: '화면', lcdClear: '화면지우기', wait: '기다리기', button: '버튼', distance: '거리', line: '라인',
};

function jsSetup() {
  const G = window.javascript.javascriptGenerator;
  const O = window.javascript.Order;
  if (G.__tsim) return G;
  G.__tsim = true;
  const devArg = (gen, b) => {
    const id = b.getFieldValue('DEV');
    if (gen.__text) {
      const inst = getProject() && P.inst(getProject(), id);
      return JSON.stringify(inst ? inst.name : id);
    }
    return JSON.stringify(id);
  };
  const call = (gen, name, args) => (gen.__text ? `${TEXT_API[name]}(${args.join(', ')})` : `api.${name}(${args.join(', ')})`);
  const aw = (gen) => (gen.__text ? '' : 'await ');
  const v = (gen, b, n, d = '0') => gen.valueToCode(b, n, O.NONE) || d;
  const F = G.forBlock;
  F.tsim_start = () => '';
  F.tsim_forever = (b, gen) => `while (true) {\n${gen.statementToCode(b, 'DO')}${gen.__text ? '' : gen.INDENT + 'await api.tick();\n'}}\n`;
  F.tsim_wait = (b, gen) => `${aw(gen)}${call(gen, 'wait', [v(gen, b, 'SEC', '1')])};\n`;
  F.tsim_motor = (b, gen) => `${call(gen, 'motor', [devArg(gen, b), v(gen, b, 'SPEED')])};\n`;
  F.tsim_motor_stop = (b, gen) => `${call(gen, 'stop', [devArg(gen, b)])};\n`;
  F.tsim_motor_all_stop = (b, gen) => `${call(gen, 'stopAll', [])};\n`;
  F.tsim_servo = (b, gen) => `${call(gen, 'servo', [devArg(gen, b), v(gen, b, 'ANGLE', '90')])};\n`;
  F.tsim_slide = (b, gen) => `${call(gen, 'slide', [devArg(gen, b), v(gen, b, 'POS')])};\n`;
  F.tsim_led = (b, gen) => `${call(gen, 'led', [devArg(gen, b), b.getFieldValue('STATE') === 'ON' ? 'true' : 'false'])};\n`;
  F.tsim_led_color = (b, gen) => `${call(gen, 'ledColor', [devArg(gen, b), JSON.stringify(b.getFieldValue('COLOR'))])};\n`;
  F.tsim_tone = (b, gen) => `${aw(gen)}${call(gen, 'tone', [devArg(gen, b), JSON.stringify(b.getFieldValue('NOTE')), v(gen, b, 'SEC', '0.5')])};\n`;
  F.tsim_lcd = (b, gen) => `${call(gen, 'lcd', [devArg(gen, b), b.getFieldValue('LINE'), v(gen, b, 'TEXT', "''")])};\n`;
  F.tsim_lcd_clear = (b, gen) => `${call(gen, 'lcdClear', [devArg(gen, b)])};\n`;
  F.tsim_button = (b, gen) => [call(gen, 'button', [devArg(gen, b)]), O.FUNCTION_CALL];
  F.tsim_distance = (b, gen) => [call(gen, 'distance', [devArg(gen, b)]), O.FUNCTION_CALL];
  F.tsim_line = (b, gen) => [call(gen, 'line', [devArg(gen, b)]), O.FUNCTION_CALL];
  return G;
}

function startHats(ws) {
  return ws.getTopBlocks(true).filter((b) => b.type === 'tsim_start' && b.isEnabled());
}

// 시뮬레이션에서 실행할 코드
export function genSim(ws) {
  const G = jsSetup();
  G.__text = false;
  G.STATEMENT_PREFIX = 'api.hl(%1);\n';
  G.INFINITE_LOOP_TRAP = 'await api.tick();\n';
  G.init(ws);
  const hats = startHats(ws).map((h) => `async () => {\n${G.prefixLines(G.blockToCode(h), G.INDENT)}}`);
  let code = `await Promise.all([\n${hats.join(',\n')}\n].map((f) => f()));\n`;
  code = G.finish(code);
  G.STATEMENT_PREFIX = null;
  G.INFINITE_LOOP_TRAP = null;
  return { code, count: hats.length };
}

// 블록 → 글 코드 (한글 자바스크립트)
export function genText(ws) {
  const G = jsSetup();
  G.__text = true;
  G.STATEMENT_PREFIX = null;
  G.INFINITE_LOOP_TRAP = null;
  G.init(ws);
  const parts = startHats(ws).map((h) => G.blockToCode(h));
  let code = parts.join('\n// ---- 다른 시작 블록 ----\n');
  code = G.finish(code);
  G.__text = false;
  return '// ▶ 시작하면 실행돼요\n' + code;
}

// ======================================================================
// 2) 아두이노 (C/C++)
// ======================================================================
const AO = { ATOMIC: 0, CALL: 2, UNARY: 4, MULT: 5, ADD: 6, REL: 8, EQ: 9, AND: 13, OR: 14, NONE: 99 };
let ard = null;
let ctx = null; // 코드 만들 때 쓰는 정보 (핀, 부품 이름)

function devName(id) { return ctx.devs[id] || null; }

function ardSetup() {
  if (ard) return ard;
  ard = new Blockly.CodeGenerator('Arduino');
  ard.INDENT = '  ';
  ard.RESERVED = 'setup,loop,if,else,for,while,int,float,long,char,bool,boolean,true,false,void,return,String,Servo,delay,tone,random,map,abs,min,max,constrain,pinMode,digitalWrite,digitalRead,analogWrite,analogRead,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP';
  ard.init = function (ws) {
    this.definitions_ = Object.create(null);
    this.nameDB_ = new Blockly.Names(this.RESERVED);
    this.nameDB_.setVariableMap(ws.getVariableMap());
    this.nameDB_.populateVariables(ws);
    this.nameDB_.populateProcedures(ws);
    const vars = Blockly.Variables.allUsedVarModels(ws);
    this.vars = vars.map((x) => this.nameDB_.getName(x.getId(), Blockly.Names.NameType.VARIABLE));
    this.isInitialized = true;
  };
  ard.finish = function (code) { this.isInitialized = false; this.nameDB_.reset(); return code; };
  ard.scrub_ = function (block, code, thisOnly) {
    const next = block.nextConnection && block.nextConnection.targetBlock();
    return code + (thisOnly ? '' : this.blockToCode(next));
  };
  ard.scrubNakedValue = (line) => line + ';\n';
  ard.quote_ = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  const F = ard.forBlock;
  const v = (b, n, o = AO.NONE, d = '0') => ard.valueToCode(b, n, o) || d;
  F.math_number = (b) => [String(Number(b.getFieldValue('NUM'))), AO.ATOMIC];
  F.text = (b) => [ard.quote_(b.getFieldValue('TEXT')), AO.ATOMIC];
  F.text_join = (b) => {
    const parts = [];
    for (let i = 0; i < b.itemCount_; i++) parts.push('String(' + v(b, 'ADD' + i, AO.NONE, '""') + ')');
    return [parts.length ? parts.join(' + ') : '""', AO.ADD];
  };
  F.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', AO.ATOMIC];
  F.logic_negate = (b) => ['!' + v(b, 'BOOL', AO.UNARY, 'true'), AO.UNARY];
  F.logic_compare = (b) => {
    const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')];
    const o = op === '==' || op === '!=' ? AO.EQ : AO.REL;
    return [`${v(b, 'A', o)} ${op} ${v(b, 'B', o)}`, o];
  };
  F.logic_operation = (b) => {
    const and = b.getFieldValue('OP') === 'AND';
    const o = and ? AO.AND : AO.OR;
    return [`${v(b, 'A', o, 'false')} ${and ? '&&' : '||'} ${v(b, 'B', o, 'false')}`, o];
  };
  F.math_arithmetic = (b) => {
    const op = b.getFieldValue('OP');
    if (op === 'POWER') return [`pow(${v(b, 'A')}, ${v(b, 'B')})`, AO.CALL];
    const [s, o] = { ADD: ['+', AO.ADD], MINUS: ['-', AO.ADD], MULTIPLY: ['*', AO.MULT], DIVIDE: ['/', AO.MULT] }[op];
    return [`${v(b, 'A', o)} ${s} ${v(b, 'B', o + 0.1)}`, o];
  };
  F.math_random_int = (b) => [`random(${v(b, 'FROM')}, ${v(b, 'TO', AO.ADD)} + 1)`, AO.CALL];
  F.variables_get = (b) => [ard.nameDB_.getName(b.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE), AO.ATOMIC];
  F.variables_set = (b) => `${ard.nameDB_.getName(b.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE)} = ${v(b, 'VALUE')};\n`;
  F.math_change = (b) => `${ard.nameDB_.getName(b.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE)} += ${v(b, 'DELTA', AO.ADD)};\n`;
  F.controls_if = (b) => {
    let n = 0, code = '';
    do {
      code += (n ? ' else ' : '') + `if (${v(b, 'IF' + n, AO.NONE, 'false')}) {\n${ard.statementToCode(b, 'DO' + n)}}`;
      n++;
    } while (b.getInput('IF' + n));
    if (b.getInput('ELSE')) code += ` else {\n${ard.statementToCode(b, 'ELSE')}}`;
    return code + '\n';
  };
  F.controls_repeat_ext = (b) => {
    const i = ard.nameDB_.getDistinctName('i', Blockly.Names.NameType.VARIABLE);
    return `for (int ${i} = 0; ${i} < ${v(b, 'TIMES')}; ${i}++) {\n${ard.statementToCode(b, 'DO')}}\n`;
  };
  F.controls_whileUntil = (b) => {
    let c = v(b, 'BOOL', AO.NONE, 'false');
    if (b.getFieldValue('MODE') === 'UNTIL') c = `!(${c})`;
    return `while (${c}) {\n${ard.statementToCode(b, 'DO')}}\n`;
  };
  F.tsim_start = () => '';
  F.tsim_forever = (b) => `while (true) {\n${ard.statementToCode(b, 'DO')}}\n`;
  F.tsim_wait = (b) => `delay(${v(b, 'SEC', AO.MULT, '1')} * 1000);\n`;
  const D = (b) => devName(b.getFieldValue('DEV'));
  const missing = (b) => `// (${b.getFieldValue('DEV')} 부품이 없어요)\n`;
  F.tsim_motor = (b) => { const d = D(b); if (!d) return missing(b); ctx.use.motor = true; return `motorRun(${d}_PWM, ${d}_DIR, ${d.sign < 0 ? '-' : ''}(${v(b, 'SPEED')}));\n`; };
  F.tsim_motor_stop = (b) => { const d = D(b); if (!d) return missing(b); ctx.use.motor = true; return `motorRun(${d}_PWM, ${d}_DIR, 0);\n`; };
  F.tsim_motor_all_stop = () => { ctx.use.motor = true; return ctx.motors.map((d) => `motorRun(${d}_PWM, ${d}_DIR, 0);\n`).join('') || '// (모터가 없어요)\n'; };
  F.tsim_servo = (b) => { const d = D(b); if (!d) return missing(b); const a = v(b, 'ANGLE', AO.ADD, '90'); return `${d}.write(${d.rev ? `180 - (${a})` : a});\n`; };
  F.tsim_slide = (b) => { const d = D(b); if (!d) return missing(b); return `${d}.write(map(${v(b, 'POS')}, 0, 100, 0, 180));\n`; };
  F.tsim_led = (b) => { const d = D(b); if (!d) return missing(b); return `digitalWrite(${d}_PIN, ${b.getFieldValue('STATE') === 'ON' ? 'HIGH' : 'LOW'});\n`; };
  F.tsim_led_color = (b) => { const d = D(b); if (!d) return missing(b); return `digitalWrite(${d}_PIN, HIGH); // ${b.getFieldValue('COLOR')} (한 가지 색 LED)\n`; };
  F.tsim_tone = (b) => { const d = D(b); if (!d) return missing(b); const ms = `${v(b, 'SEC', AO.MULT, '0.5')} * 1000`; return `tone(${d}_PIN, ${NOTES[b.getFieldValue('NOTE')]}, ${ms});\ndelay(${ms});\n`; };
  F.tsim_lcd = (b) => { const d = D(b); if (!d) return missing(b); ctx.use.lcd = true; return `lcdLine(${d}, ${b.getFieldValue('LINE')}, String(${v(b, 'TEXT', AO.NONE, '""')}));\n`; };
  F.tsim_lcd_clear = (b) => { const d = D(b); if (!d) return missing(b); return `${d}.clear();\n`; };
  F.tsim_button = (b) => { const d = D(b); return [d ? `(digitalRead(${d}_PIN) == LOW)` : 'false', AO.EQ]; };
  F.tsim_distance = (b) => { const d = D(b); if (d) ctx.use.dist = true; return [d ? `readDistance(${d}_TRIG, ${d}_ECHO)` : '400', AO.CALL]; };
  F.tsim_line = (b) => { const d = D(b); return [d ? `(digitalRead(${d}_PIN) == HIGH)` : 'false', AO.EQ]; };
  return ard;
}

// 부품마다 코드에서 쓸 이름 만들기
function makeCtx(project, signs) {
  const pins = assignPins(project);
  const count = {};
  const devs = {};
  const list = [];
  const motors = [];
  const pre = { dc: 'motor', servo: 'servo', linear: 'slider', led: 'led', buzzer: 'buzzer', lcd: 'lcd', button: 'button', distance: 'sonar', line: 'lineSensor' };
  for (const inst of project.instances) {
    const r = pins[inst.id];
    if (!r) continue;
    count[r.comp] = (count[r.comp] || 0) + 1;
    // eslint-disable-next-line no-new-wrappers
    const n = new String(pre[r.comp] + count[r.comp]);
    n.comp = r.comp; n.pins = r.pins; n.addr = r.addr; n.inst = inst; n.ok = r.ok;
    n.sign = r.comp === 'dc' ? (signs[inst.id] || 1) * (inst.reverse ? -1 : 1) : 1;
    n.rev = !!inst.reverse;
    devs[inst.id] = n;
    list.push(n);
    if (r.comp === 'dc') motors.push(n);
  }
  return { devs, list, motors, use: {} };
}

function genArduino(ws, project, signs) {
  const G = ardSetup();
  const board = BOARDS[project.board];
  ctx = makeCtx(project, signs);
  G.init(ws);
  const body = startHats(ws).map((h) => G.blockToCode(h)).join('\n');
  const vars = G.vars;
  G.finish('');
  const L = [];
  const pin = (p) => (/^\d+$/.test(p) ? p : p || '-1');
  L.push('// 팅커심(webTinkerSim)에서 만든 코드');
  L.push(`// 보드: ${board.name}`);
  L.push('');
  if (ctx.list.some((d) => d.comp === 'servo' || d.comp === 'linear')) L.push(project.board === 'esp32' ? '#include <ESP32Servo.h>' : '#include <Servo.h>');
  if (ctx.list.some((d) => d.comp === 'lcd')) { L.push('#include <Wire.h>'); L.push('#include <LiquidCrystal_I2C.h>  // 라이브러리: LiquidCrystal I2C'); }
  L.push('');
  L.push('// ---- 부품 연결 ----');
  for (const d of ctx.list) {
    const nm = d.inst.name;
    if (d.comp === 'dc') { L.push(`const int ${d}_PWM = ${pin(d.pins[0])};  // ${nm} 속도`); L.push(`const int ${d}_DIR = ${pin(d.pins[1])};  // ${nm} 방향`); }
    else if (d.comp === 'servo' || d.comp === 'linear') { L.push(`Servo ${d};  // ${nm}`); L.push(`const int ${d}_PIN = ${pin(d.pins[0])};`); }
    else if (d.comp === 'distance') { L.push(`const int ${d}_TRIG = ${pin(d.pins[0])};  // ${nm}`); L.push(`const int ${d}_ECHO = ${pin(d.pins[1])};`); }
    else if (d.comp === 'lcd') L.push(`LiquidCrystal_I2C ${d}(0x${d.addr.toString(16)}, 16, 2);  // ${nm}`);
    else L.push(`const int ${d}_PIN = ${pin(d.pins[0])};  // ${nm}`);
  }
  if (vars.length) { L.push(''); L.push('// ---- 변수 ----'); for (const x of vars) L.push(`float ${x} = 0;`); }
  L.push('');
  if (ctx.motors.length) {
    L.push('// 모터 돌리기: speed = -100 ~ 100');
    L.push('void motorRun(int pwmPin, int dirPin, int speed) {');
    L.push('  speed = constrain(speed, -100, 100);');
    L.push('  int v = map(abs(speed), 0, 100, 0, 255);');
    L.push('  if (speed >= 0) { digitalWrite(dirPin, LOW); analogWrite(pwmPin, v); }');
    L.push('  else { digitalWrite(dirPin, HIGH); analogWrite(pwmPin, 255 - v); }');
    L.push('}');
    L.push('');
  }
  if (ctx.list.some((d) => d.comp === 'distance')) {
    L.push('// 초음파 거리 재기 (cm)');
    L.push('float readDistance(int trig, int echo) {');
    L.push('  digitalWrite(trig, LOW); delayMicroseconds(2);');
    L.push('  digitalWrite(trig, HIGH); delayMicroseconds(10);');
    L.push('  digitalWrite(trig, LOW);');
    L.push('  long t = pulseIn(echo, HIGH, 30000);');
    L.push('  if (t == 0) return 400;');
    L.push('  return t / 58.0;');
    L.push('}');
    L.push('');
  }
  if (ctx.list.some((d) => d.comp === 'lcd')) {
    L.push('// LCD 한 줄 쓰기 (16칸)');
    L.push('void lcdLine(LiquidCrystal_I2C &lcd, int line, String text) {');
    L.push('  text += "                ";');
    L.push('  lcd.setCursor(0, line - 1);');
    L.push('  lcd.print(text.substring(0, 16));');
    L.push('}');
    L.push('');
  }
  L.push('void setup() {');
  for (const d of ctx.list) {
    if (d.comp === 'dc') L.push(`  pinMode(${d}_PWM, OUTPUT); pinMode(${d}_DIR, OUTPUT);`);
    else if (d.comp === 'servo' || d.comp === 'linear') L.push(`  ${d}.attach(${d}_PIN); ${d}.write(${d.comp === 'servo' ? 90 : 0});`);
    else if (d.comp === 'distance') L.push(`  pinMode(${d}_TRIG, OUTPUT); pinMode(${d}_ECHO, INPUT);`);
    else if (d.comp === 'lcd') L.push(`  ${d}.init(); ${d}.backlight();`);
    else if (d.comp === 'button') L.push(`  pinMode(${d}_PIN, INPUT_PULLUP);`);
    else if (d.comp === 'line') L.push(`  pinMode(${d}_PIN, INPUT);`);
    else L.push(`  pinMode(${d}_PIN, OUTPUT);`);
  }
  if (body.trim()) { L.push(''); L.push('  // ▶ 시작하면'); L.push(G.prefixLines(body.trimEnd(), '  ')); }
  L.push('}');
  L.push('');
  L.push('void loop() {');
  L.push('  // "계속 반복하기" 블록은 setup() 안에서 계속 돌아요');
  L.push('}');
  return L.join('\n') + '\n';
}

// ======================================================================
// 3) 마이크로파이썬 (마이크로비트 / 라즈베리파이 피코)
// ======================================================================
let pySet = false;
function pySetup() {
  const G = window.python.pythonGenerator;
  const O = window.python.Order;
  if (pySet) return G;
  pySet = true;
  const F = G.forBlock;
  const v = (b, n, d = '0') => G.valueToCode(b, n, O.NONE) || d;
  const D = (b) => devName(b.getFieldValue('DEV'));
  const mb = () => ctx.board === 'microbit';
  const missing = (b) => `pass  # (${b.getFieldValue('DEV')} 부품이 없어요)\n`;
  F.tsim_start = () => '';
  F.tsim_forever = (b) => `while True:\n${G.statementToCode(b, 'DO') || G.INDENT + 'pass\n'}`;
  F.tsim_wait = (b) => (mb() ? `sleep(int(${v(b, 'SEC', '1')} * 1000))\n` : `time.sleep(${v(b, 'SEC', '1')})\n`);
  F.tsim_motor = (b) => { const d = D(b); if (!d) return missing(b); return `motor_run(${d}_a, ${d}_b, ${d.sign < 0 ? '-' : ''}(${v(b, 'SPEED')}))\n`; };
  F.tsim_motor_stop = (b) => { const d = D(b); if (!d) return missing(b); return `motor_run(${d}_a, ${d}_b, 0)\n`; };
  F.tsim_motor_all_stop = () => ctx.motors.map((d) => `motor_run(${d}_a, ${d}_b, 0)\n`).join('') || 'pass\n';
  F.tsim_servo = (b) => { const d = D(b); if (!d) return missing(b); const a = v(b, 'ANGLE', '90'); return `servo_write(${d}, ${d.rev ? `180 - (${a})` : a})\n`; };
  F.tsim_slide = (b) => { const d = D(b); if (!d) return missing(b); return `servo_write(${d}, (${v(b, 'POS')}) * 1.8)\n`; };
  F.tsim_led = (b) => { const d = D(b); if (!d) return missing(b); const on = b.getFieldValue('STATE') === 'ON' ? 1 : 0; return mb() ? `${d}.write_digital(${on})\n` : `${d}.value(${on})\n`; };
  F.tsim_led_color = (b) => { const d = D(b); if (!d) return missing(b); return (mb() ? `${d}.write_digital(1)` : `${d}.value(1)`) + `  # ${b.getFieldValue('COLOR')} (한 가지 색 LED)\n`; };
  F.tsim_tone = (b) => { const d = D(b); if (!d) return missing(b); return `play_tone(${d}, ${NOTES[b.getFieldValue('NOTE')]}, ${v(b, 'SEC', '0.5')})\n`; };
  F.tsim_lcd = (b) => { const d = D(b); if (!d) return missing(b); return `${d}.line(${b.getFieldValue('LINE')}, ${v(b, 'TEXT', "''")})\n`; };
  F.tsim_lcd_clear = (b) => { const d = D(b); if (!d) return missing(b); return `${d}.clear()\n`; };
  F.tsim_button = (b) => { const d = D(b); if (!d) return ['False', O.ATOMIC]; return [mb() ? `(${d}.read_digital() == 0)` : `(${d}.value() == 0)`, O.RELATIONAL]; };
  F.tsim_distance = (b) => { const d = D(b); if (!d) return ['400', O.ATOMIC]; return [`read_distance(${d}_trig, ${d}_echo)`, O.FUNCTION_CALL]; };
  F.tsim_line = (b) => { const d = D(b); if (!d) return ['False', O.ATOMIC]; return [mb() ? `(${d}.read_digital() == 1)` : `(${d}.value() == 1)`, O.RELATIONAL]; };
  return G;
}

const LCD_PY = (mb) => `
# LCD (I2C 1602) 간단 드라이버
class LCD:
    def __init__(self, addr):
        self.a = addr
        for c in (0x33, 0x32, 0x28, 0x0C, 0x06, 0x01):
            self.cmd(c)
        ${mb ? 'sleep(5)' : 'time.sleep_ms(5)'}
    def _w(self, b):
        ${mb ? 'i2c.write(self.a, bytes([b | 0x08]))' : 'i2c.writeto(self.a, bytes([b | 0x08]))'}
    def _p(self, b):
        self._w(b | 0x04)
        self._w(b & ~0x04)
    def _s(self, v, rs):
        self._p((v & 0xF0) | rs)
        self._p(((v << 4) & 0xF0) | rs)
    def cmd(self, c):
        self._s(c, 0)
    def line(self, n, t):
        self.cmd(0x80 if n == 1 else 0xC0)
        for ch in (str(t) + ' ' * 16)[:16]:
            self._s(ord(ch) if ord(ch) < 128 else 63, 1)
    def clear(self):
        self.cmd(0x01)
        ${mb ? 'sleep(2)' : 'time.sleep_ms(2)'}
`;

function genPython(ws, project, signs) {
  const G = pySetup();
  const board = BOARDS[project.board];
  ctx = makeCtx(project, signs);
  ctx.board = project.board;
  const mb = project.board === 'microbit';
  G.init(ws);
  let body = startHats(ws).map((h) => G.blockToCode(h)).join('\n');
  body = G.finish(body);
  const L = [];
  L.push('# 팅커심(webTinkerSim)에서 만든 코드');
  L.push(`# 보드: ${board.name}`);
  const has = (c) => ctx.list.some((d) => d.comp === c);
  if (mb) {
    L.push('from microbit import *');
    if (has('buzzer')) L.push('import music');
    if (has('distance')) L.push('import machine');
  } else {
    L.push('from machine import Pin, PWM, I2C, time_pulse_us');
    L.push('import time');
  }
  L.push('');
  if (has('lcd')) L.push(mb ? 'i2c.init(freq=100000)' : 'i2c = I2C(0, sda=Pin(4), scl=Pin(5), freq=100000)');
  if (ctx.motors.length) {
    L.push('');
    L.push('def motor_run(a, b, speed):');
    L.push('    speed = max(-100, min(100, speed))');
    if (mb) {
      L.push('    v = int(abs(speed) * 1023 / 100)');
      L.push('    if speed >= 0:');
      L.push('        b.write_digital(0)');
      L.push('        a.write_analog(v)');
      L.push('    else:');
      L.push('        b.write_digital(1)');
      L.push('        a.write_analog(1023 - v)');
    } else {
      L.push('    v = int(abs(speed) * 65535 / 100)');
      L.push('    if speed >= 0:');
      L.push('        b.value(0)');
      L.push('        a.duty_u16(v)');
      L.push('    else:');
      L.push('        b.value(1)');
      L.push('        a.duty_u16(65535 - v)');
    }
  }
  if (has('servo') || has('linear')) {
    L.push('');
    L.push('def servo_write(p, angle):');
    L.push('    angle = max(0, min(180, angle))');
    if (mb) { L.push('    p.set_analog_period(20)'); L.push('    p.write_analog(int(26 + angle * 102 / 180))'); }
    else L.push('    p.duty_u16(int(1638 + angle * 6553 / 180))');
  }
  if (has('buzzer')) {
    L.push('');
    L.push('def play_tone(p, freq, sec):');
    if (mb) L.push('    music.pitch(int(freq), int(sec * 1000), p)');
    else { L.push('    p.freq(int(freq))'); L.push('    p.duty_u16(32768)'); L.push('    time.sleep(sec)'); L.push('    p.duty_u16(0)'); }
  }
  if (has('distance')) {
    L.push('');
    L.push('def read_distance(trig, echo):');
    if (mb) {
      L.push('    trig.write_digital(0)');
      L.push('    trig.write_digital(1)');
      L.push('    trig.write_digital(0)');
      L.push('    t = machine.time_pulse_us(echo, 1, 30000)');
    } else {
      L.push('    trig.value(0)');
      L.push('    time.sleep_us(2)');
      L.push('    trig.value(1)');
      L.push('    time.sleep_us(10)');
      L.push('    trig.value(0)');
      L.push('    t = time_pulse_us(echo, 1, 30000)');
    }
    L.push('    return 400 if t < 0 else round(t / 58, 1)');
  }
  if (has('lcd')) L.push(LCD_PY(mb));
  L.push('');
  L.push('# ---- 부품 연결 ----');
  const P_ = (p) => (mb ? p : `Pin(${p}, Pin.OUT)`);
  for (const d of ctx.list) {
    const nm = d.inst.name;
    const pp = d.pins.map((x) => x || (mb ? 'pin0' : '0'));
    if (d.comp === 'dc') {
      if (mb) { L.push(`${d}_a = ${pp[0]}  # ${nm} 속도`); L.push(`${d}_b = ${pp[1]}  # ${nm} 방향`); }
      else { L.push(`${d}_a = PWM(Pin(${pp[0]}))  # ${nm} 속도`); L.push(`${d}_a.freq(1000)`); L.push(`${d}_b = Pin(${pp[1]}, Pin.OUT)  # ${nm} 방향`); }
    } else if (d.comp === 'servo' || d.comp === 'linear') {
      if (mb) L.push(`${d} = ${pp[0]}  # ${nm}`);
      else { L.push(`${d} = PWM(Pin(${pp[0]}))  # ${nm}`); L.push(`${d}.freq(50)`); }
      L.push(`servo_write(${d}, ${d.comp === 'servo' ? 90 : 0})`);
    } else if (d.comp === 'buzzer') {
      L.push(mb ? `${d} = ${pp[0]}  # ${nm}` : `${d} = PWM(Pin(${pp[0]}))  # ${nm}`);
    } else if (d.comp === 'distance') {
      if (mb) { L.push(`${d}_trig = ${pp[0]}  # ${nm}`); L.push(`${d}_echo = ${pp[1]}`); }
      else { L.push(`${d}_trig = Pin(${pp[0]}, Pin.OUT)  # ${nm}`); L.push(`${d}_echo = Pin(${pp[1]}, Pin.IN)`); }
    } else if (d.comp === 'lcd') {
      L.push(`${d} = LCD(0x${d.addr.toString(16)})  # ${nm}`);
    } else if (d.comp === 'button') {
      if (mb) { L.push(`${d} = ${pp[0]}  # ${nm}`); L.push(`${d}.set_pull(${d}.PULL_UP)`); }
      else L.push(`${d} = Pin(${pp[0]}, Pin.IN, Pin.PULL_UP)  # ${nm}`);
    } else if (d.comp === 'line') {
      L.push(mb ? `${d} = ${pp[0]}  # ${nm}` : `${d} = Pin(${pp[0]}, Pin.IN)  # ${nm}`);
    } else {
      L.push(`${d} = ${P_(pp[0])}  # ${nm}`);
    }
  }
  L.push('');
  L.push('# ▶ 시작하면');
  L.push(body.trim() ? body.trimEnd() : 'pass');
  return L.join('\n') + '\n';
}

// 보드용 코드 만들기
export function genBoard(ws, project, signs = {}) {
  const board = BOARDS[project.board] || BOARDS.uno;
  try {
    if (board.lang === 'arduino') return { lang: 'arduino', code: genArduino(ws, project, signs), file: (project.name || 'tinkersim') + '.ino' };
    return { lang: 'python', code: genPython(ws, project, signs), file: 'main.py' };
  } catch (e) {
    console.error(e);
    return { lang: 'text', code: '// 코드를 만드는 중 문제가 생겼어요: ' + e.message, file: 'error.txt' };
  }
}

export function boardPinText(project, inst) {
  const r = assignPins(project)[inst.id];
  if (!r) return '';
  if (r.comp === 'lcd') return 'I2C';
  return r.pins.map((p) => (p ? pinLabel(project.board, p) : '❌')).join(', ');
}
