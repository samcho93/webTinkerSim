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
    await app.open(newProject('나의 자동차'), { go: 'maker' }); await wait(300);
    clickText(app.screens.maker.el, '상자'); await wait(200);
    const s = app.project.structures[0].shapes[0];
    s.size = [150, 30, 70]; s.pos = [0, 15, 0];
    app.go('home'); app.go('maker'); await wait(200);
    clickText(app.screens.maker.el, '크기');
    app.screens.maker.el.querySelector('canvas').dispatchEvent(new Event('noop'));
    app.screens.maker.select?.(s.id);
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
    await app.open(newProject('구멍 연습'), { go: 'maker' }); await wait(300);
    clickText(app.screens.maker.el, '상자'); clickText(app.screens.maker.el, '원기둥'); await wait(100);
    const st = app.project.structures[0];
    st.shapes[0].size = [80, 30, 50]; st.shapes[0].pos = [0, 15, 0]; st.shapes[0].color = '#f97316';
    st.shapes[1].size = [24, 50, 24]; st.shapes[1].pos = [0, 20, 0]; st.shapes[1].hole = true;
    await whenCsgReady();
    app.go('home'); app.go('maker'); await wait(100);
    $('#finalBtn').click();
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
  async hw(app) {
    await app.openExample('fan'); app.project.board = 'microbit'; app.go('code'); await wait(500);
    clickText(app.screens.code.el, '보드 연결');
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
