// 따라하기 그림을 만들 때 쓰는 장면들 (주소 뒤에 ?shot=이름)
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { newProject, P } from './project.js';
import { importStl } from './stl.js';
import { whenCsgReady } from './shapes.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const clickText = (root, t) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent.includes(t)); if (b) b.click(); return b; };

async function carParts(app) {
  await app.openExample('car');
  const p = app.project;
  return p;
}

async function makerScene(app, name, list) {
  await app.open(newProject(name), { go: 'maker' }); await wait(300);
  const m = app.screens.maker;
  const st = m.struct;
  st.name = name;
  st.shapes = list.map(([type, pos, size, color, hole]) => ({ id: Math.random().toString(36).slice(2), type, pos, size, rot: [0, 0, 0], color: color || '#94a3b8', hole: !!hole }));
  await whenCsgReady();
  app.go('home'); app.go('maker'); await wait(200);
  app.screens.maker.api.select([]);
  return m;
}

const SHOTS = {
  async home(app) { app.go('home'); },
  async 'home-examples'(app) { app.go('home'); await wait(100); $('#exgrid').scrollIntoView(); },
  async 'run-car'(app) {
    await app.openExample('car'); app.go('code'); await wait(800);
    app.world.follow = true; app.screens.code.run(); await wait(2600);
  },
  async save(app) {
    await app.openExample('car'); app.go('assemble'); await wait(500);
    $('#saved').style.outline = '3px solid #facc15';
    $('#btnSave').style.outline = '3px solid #facc15';
  },
  async 'maker-1'(app) {
    await app.open(newProject('나의 자동차'), { go: 'maker' }); await wait(300);
    clickText(app.screens.maker.el, '상자');
  },
  async 'maker-2'(app) {
    const m = await makerScene(app, '나의 자동차', [['box', [0, 15, 0], [150, 30, 70], '#3b82f6']]);
    m.api.select([m.struct.shapes[0].id]); await wait(200);
    m.resizer.update(); m.viewer.fit(m.resizer.frame, { pad: 1.3 });
  },
  async 'maker-resize'(app) {
    const m = await makerScene(app, '나의 자동차', [['box', [0, 15, 0], [150, 30, 70], '#3b82f6']]);
    m.api.select([m.struct.shapes[0].id]); await wait(200);
    m.resizer.update(); m.viewer.fit(m.resizer.frame, { pad: 1.3 });
    await wait(300);
    m.resizer.labels.y.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const inp = m.resizer.labels.y.querySelector('input');
    if (inp) inp.value = '45';
    m.resizer.hover = m.resizer.handles[3];
  },
  async 'maker-3'(app) {
    await app.open(newProject('나의 자동차'), { go: 'maker' }); await wait(300);
    const st = app.project.structures[0];
    clickText(app.screens.maker.el, '상자'); clickText(app.screens.maker.el, '상자'); await wait(100);
    st.name = '자동차 몸통';
    st.shapes[0].size = [150, 30, 70]; st.shapes[0].pos = [0, 15, 0]; st.shapes[0].color = '#3b82f6';
    st.shapes[1].size = [70, 25, 60]; st.shapes[1].pos = [-10, 42.5, 0]; st.shapes[1].color = '#e0f2fe';
    app.go('home'); app.go('maker');
  },
  async 'maker-hole'(app) {
    const m = await makerScene(app, '구멍 연습', [['box', [0, 15, 0], [80, 30, 50], '#f97316'], ['cylinder', [0, 20, 0], [24, 50, 24], null, true]]);
    m.api.select(m.struct.shapes.map((n) => n.id)); await wait(100);
    m.api.groupSel();
  },
  async 'maker-multi'(app) {
    const m = await makerScene(app, '자동차 몸통', [['box', [0, 15, 0], [150, 30, 70], '#3b82f6'], ['box', [-10, 42.5, 0], [70, 25, 60], '#e0f2fe'], ['cylinder', [40, 42, 0], [16, 24, 16], '#facc15']]);
    m.api.select(m.struct.shapes.map((n) => n.id));
  },
  async 'maker-group'(app) {
    const m = await makerScene(app, '도넛 블럭', [['cylinder', [0, 10, 0], [60, 20, 60], '#ec4899'], ['cylinder', [0, 10, 0], [24, 30, 24], null, true], ['box', [0, 10, 0], [70, 8, 8], null, true]]);
    m.api.select(m.struct.shapes.map((n) => n.id)); await wait(50);
    m.api.groupSel();
  },
  async 'maker-link'(app) {
    const m = await makerScene(app, '로봇 머리', [['box', [0, 20, 0], [50, 40, 40], '#cbd5e1'], ['sphere', [-12, 28, 21], [12, 12, 6], '#2563eb'], ['sphere', [12, 28, 21], [12, 12, 6], '#2563eb'], ['cylinder', [0, 46, 0], [4, 12, 4], '#64748b'], ['sphere', [0, 54, 0], [10, 10, 10], '#ef4444']]);
    m.api.select(m.struct.shapes.map((n) => n.id)); await wait(50);
    m.api.linkSel();
  },
  async 'maker-copy'(app) {
    const m = await makerScene(app, '바퀴 4개', [['cylinder', [0, 15, 0], [30, 10, 30], '#1f2937']]);
    m.api.select([m.struct.shapes[0].id]); m.api.copySel(); m.api.paste(); m.api.paste(); m.api.paste();
  },
  async 'maker-align'(app) {
    const m = await makerScene(app, '정렬 연습', [['box', [-30, 10, -10], [20, 20, 20], '#ef4444'], ['cylinder', [0, 15, 15], [20, 30, 20], '#22c55e'], ['star', [35, 3, -5], [30, 6, 30], '#facc15']]);
    m.api.select(m.struct.shapes.map((n) => n.id)); await wait(50);
    m.api.align('z', 'center');
  },
  async 'maker-stl'(app) {
    await app.open(newProject('STL 불러오기'), { go: 'maker' }); await wait(300);
    const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(14, 5, 120, 16));
    mesh.rotation.x = Math.PI / 2;
    mesh.updateMatrixWorld(true);
    const data = new STLExporter().parse(mesh, { binary: true });
    const { shape } = importStl(app.project, data.buffer, 'knot.stl');
    const st = app.project.structures[0];
    st.name = 'knot'; st.icon = '📦';
    st.shapes.push(shape);
    app.go('home'); app.go('maker');
  },
  async 'blocks-1'(app) {
    await app.open(newProject('블럭 연습'), { go: 'blocks' }); await wait(300);
    clickText(app.screens.blocks.el, '새 블럭 만들기');
  },
  async 'blocks-wheel'(app) {
    await app.open(newProject('블럭 연습'), { go: 'blocks' }); await wait(300);
    clickText(app.screens.blocks.el, '새 블럭 만들기'); await wait(200);
    const b = [...app.screens.blocks.el.querySelectorAll('.choice')].find((x) => x.textContent.includes('바퀴') && x.textContent.includes('만들어진'));
    b.click();
  },
  async 'blocks-servo'(app) {
    await app.openExample('arm');
    const b = app.project.blocks.find((x) => x.name.startsWith('어깨'));
    app.screens.blocks.select(b.id);
  },
  async 'assemble-1'(app) {
    const p = newProject('나의 자동차');
    const ex = (await import('./examples.js')).EXAMPLES[0].build();
    p.structures = ex.structures.filter((s) => s.name === '자동차 몸통' || s.name === '바퀴');
    p.blocks = ex.blocks;
    await app.open(p, { go: 'assemble' }); await wait(300);
    clickText(app.screens.assemble.el, '새 로봇 만들기');
  },
  async 'assemble-ghost'(app) {
    await app.openExample('car');
    const p = app.project;
    const keep = p.instances.filter((i) => i.name.includes('앞'));
    p.instances = keep;
    app.world.rebuild();
    app.go('assemble'); await wait(400);
    const robot = [...app.world.robots.values()][0];
    const block = p.blocks[0];
    app.world.showGhost(block, { robotId: robot.data.id, parentId: null, pos: [-45, 40, 35], normal: [0, 0, 1], attachObj: robot.holder });
    const hint = document.querySelector('.place-hint');
    hint.textContent = '🛞 바퀴 블럭 → "자동차"에 붙여요 · R = 돌리기 · Esc = 취소';
    hint.classList.add('show');
    app.world.v.camera.position.set(-160, 230, 420);
    app.world.v.controls.target.set(0, 30, 0);
  },
  async 'assemble-car'(app) {
    const p = await carParts(app);
    app.go('assemble'); await wait(300);
    const i = p.instances.find((x) => x.name === '오른앞바퀴');
    app.screens.assemble.select({ type: 'inst', id: i.id });
  },
  async 'code-car'(app) { await app.openExample('car'); app.go('code'); },
  async 'code-text'(app) {
    await app.openExample('car'); app.go('code'); await wait(400);
    clickText(app.screens.code.el, '글 코딩');
  },
  async 'arm-assemble'(app) {
    await app.openExample('arm'); app.go('assemble'); await wait(300);
    const i = app.project.instances.find((x) => x.name === '팔꿈치');
    app.screens.assemble.select({ type: 'inst', id: i.id });
  },
  async 'arm-run'(app) {
    await app.openExample('arm'); app.go('code'); await wait(600);
    app.screens.code.run(); await wait(3300);
  },
  async 'avoid-run'(app) {
    await app.openExample('avoid'); app.go('code'); await wait(600);
    app.world.follow = false;
    app.world.v.camera.position.set(900, 1300, 1500);
    app.world.v.controls.target.set(0, 0, 0);
    app.screens.code.run(); await wait(4200);
  },
  async 'line-run'(app) {
    await app.openExample('liner'); app.go('code'); await wait(600);
    app.world.follow = false;
    app.world.v.camera.position.set(0, 900, 1000);
    app.world.v.controls.target.set(0, 0, 0);
    app.screens.code.run(); await wait(5000);
  },
  async button(app) {
    await app.openExample('fan'); app.go('code'); await wait(600);
    app.screens.code.run(); await wait(700);
    const io = [...app.world.insts.values()].find((x) => x.block.component === 'button');
    io.state.pressed = true; await wait(300); io.state.pressed = false; await wait(1500);
  },
  async 'board-select'(app) {
    await app.openExample('car'); app.project.board = 'microbit'; app.go('code'); await wait(300);
    const sel = app.screens.code.el.querySelector('.code-top select');
    sel.style.outline = '3px solid #facc15';
  },
  async codeview(app) {
    await app.openExample('avoid'); app.go('code'); await wait(500);
    clickText(app.screens.code.el, '보드 코드 보기');
  },
};

export async function runShot(app, name) {
  try {
    const f = SHOTS[name];
    if (f) await f(app);
    await wait(900);
  } catch (e) { console.error(e); }
  const t = document.querySelector('#toasts');
  if (t) t.remove();
  window.__shotReady = true;
}
void P;
